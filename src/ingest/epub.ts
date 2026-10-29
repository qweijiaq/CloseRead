import fs from 'node:fs/promises'
import path from 'node:path'

import * as cheerio from 'cheerio'
import { unzipSync } from 'fflate'

import type { ResourceArticle, Segment } from '../types.js'
import { articleTitleFrom, makeArticle } from './articles.js'
import { chapterMarkdown } from './ebook-html.js'
import { segmentsFromText } from './segment.js'

export interface EpubResult {
  title: string
  creator?: string
  text: string
  segments: Segment[]
  articles: ResourceArticle[]
  metadata: Record<string, string | number>
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function readText(files: Record<string, Uint8Array>, name: string): string | null {
  const data = files[name]
  return data ? decode(data) : null
}

function resolveHref(opfPath: string, href: string): string {
  let decoded = href
  try {
    decoded = decodeURIComponent(href)
  } catch {
    // Keep the raw href when it is not valid percent-encoding.
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(opfPath), decoded))
}

function parseToc(
  files: Record<string, Uint8Array>,
  rootPath: string,
  manifest: Map<string, { href: string; properties?: string; mediaType?: string }>,
): Map<string, string> {
  const nav = [...manifest.values()].find(
    (item) => /(^|\s)nav(\s|$)/i.test(item.properties ?? '') || item.mediaType?.includes('dtbncx'),
  )
  if (!nav) return new Map()
  const navPath = resolveHref(rootPath, nav.href)
  const content = readText(files, navPath)
  if (!content) return new Map()

  const $ = cheerio.load(content, { xmlMode: true })
  const titles = new Map<string, string>()
  const add = (href: string | undefined, label: string | undefined) => {
    if (!href || !label?.trim()) return
    const clean = href.split('#')[0]?.trim()
    if (!clean) return
    const fullPath = resolveHref(navPath, clean)
    if (!titles.has(fullPath)) titles.set(fullPath, label.trim())
  }

  $('a[href]').each((_, element) => {
    add($(element).attr('href'), $(element).text())
  })
  $('navPoint, navpoint').each((_, element) => {
    const point = $(element)
    const label = point.find('navLabel text, navlabel text').first().text()
    const src = point.find('content').first().attr('src')
    add(src, label)
  })
  return titles
}

export async function readEpubBuffer(buffer: Buffer, fallbackTitle: string): Promise<EpubResult> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('EPUB is not a valid ZIP archive, or it is DRM-protected.')
  }

  const container = readText(files, 'META-INF/container.xml')
  if (!container) throw new Error('EPUB is missing META-INF/container.xml')

  const rootPath = /full-path="([^"]+)"/i.exec(container)?.[1]
  if (!rootPath) throw new Error('EPUB container has no rootfile')

  const opf = readText(files, rootPath)
  if (!opf) throw new Error(`EPUB OPF not found: ${rootPath}`)

  const title = decodeEntities(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf)?.[1]?.trim() ?? '')
  const creator = decodeEntities(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i.exec(opf)?.[1]?.trim() ?? '')

  const manifest = new Map<string, { href: string; properties?: string; mediaType?: string }>()
  for (const tag of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = /\bid="([^"]+)"/i.exec(tag[0])?.[1]
    const href = /\bhref="([^"]+)"/i.exec(tag[0])?.[1]
    const properties = /\bproperties="([^"]*)"/i.exec(tag[0])?.[1]
    const mediaType = /\bmedia-type="([^"]*)"/i.exec(tag[0])?.[1]
    if (id && href) manifest.set(id, { href, properties, mediaType })
  }

  const spine: string[] = []
  for (const match of opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/gi)) {
    spine.push(match[1]!)
  }

  const tocTitles = parseToc(files, rootPath, manifest)

  const chapters: string[] = []
  const chapterTitles: string[] = []
  const articles: ResourceArticle[] = []

  for (const idref of spine) {
    const item = manifest.get(idref)
    if (!item) continue
    const fullPath = resolveHref(rootPath, item.href)
    const html = readText(files, fullPath)
    if (!html) continue

    const { markdown, title: chapterTitle } = chapterMarkdown(html)
    if (markdown.replace(/\s/g, '').length < 40) continue
    chapters.push(markdown)
    const tocTitle = tocTitles.get(fullPath)
    if (chapterTitle || tocTitle) chapterTitles.push(tocTitle ?? chapterTitle ?? '')
    const title = articleTitleFrom(markdown, tocTitle ?? chapterTitle, articles.length)
    articles.push(makeArticle(articles.length, title, markdown))
  }

  const text = chapters.join('\n\n').trim()
  if (text.length < 100) throw new Error('EPUB produced too little extractable text.')

  return {
    title: title || fallbackTitle,
    creator: creator || undefined,
    text,
    segments: segmentsFromText(text),
    articles,
    metadata: {
      format: 'epub',
      chapters: chapters.length,
      articles: articles.length,
      sizeBytes: buffer.byteLength,
      ...(chapterTitles.length ? { chapterTitles: chapterTitles.slice(0, 50).join(' | ') } : {}),
    },
  }
}

export async function readEpub(filePath: string): Promise<EpubResult> {
  const buffer = await fs.readFile(filePath)
  return readEpubBuffer(buffer, path.basename(filePath, path.extname(filePath)))
}
