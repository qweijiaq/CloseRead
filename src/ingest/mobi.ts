import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { ResourceArticle, Segment } from '../types.js'
import { articleTitleFrom, makeArticle } from './articles.js'
import { chapterMarkdown } from './ebook-html.js'
import { segmentsFromText } from './segment.js'

export interface MobiResult {
  title: string
  creator?: string
  text: string
  segments: Segment[]
  articles: ResourceArticle[]
  metadata: Record<string, string | number>
}

export interface MobiReadOptions {
  fallbackTitle: string
  label?: string
}

interface MobiMetadataLike {
  title?: string
  author?: string[]
  publisher?: string
  language?: string
  published?: string
}

interface MobiTocItemLike {
  label: string
  href: string
  children?: MobiTocItemLike[]
}

interface MobiBookLike {
  getMetadata(): MobiMetadataLike
  getSpine(): Array<{ id: string }>
  loadChapter(id: string): { html: string } | undefined
  getToc?(): MobiTocItemLike[]
  resolveHref?(href: string): { id: string; selector: string } | undefined
  destroy(): void
}

type MobiInitializer = (data: Uint8Array, resourceSaveDir: string) => Promise<MobiBookLike>

interface Attempt {
  format: 'mobi' | 'azw3'
  init: MobiInitializer
}

/**
 * The upstream KF8 loader assumes every <link> matches a Kindle resource pattern.
 * Some real books contain a plain CSS link, which makes loadChapter throw before
 * returning the body. Falling back to the raw body is enough for text extraction.
 */
function patchKf8Loader(book: MobiBookLike): void {
  const target = book as unknown as {
    replace?: (html: string) => { html: string; css: unknown[] }
  }
  const original = target.replace
  if (typeof original !== 'function') return
  target.replace = function (html: string) {
    try {
      return original.call(this, html)
    } catch {
      const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
      return { html: body, css: [] }
    }
  }
}

async function parseWith(
  buffer: Buffer,
  attempt: Attempt,
  fallbackTitle: string,
): Promise<MobiResult | null> {
  const resourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'elc-mobi-'))
  let book: MobiBookLike | undefined
  try {
    book = await attempt.init(new Uint8Array(buffer), resourceDir)
    if (attempt.format === 'azw3') patchKf8Loader(book)
    const chapters: string[] = []
    const chapterTitles: string[] = []
    const articles: ResourceArticle[] = []
    const tocTitles = new Map<string, string>()
    const visitToc = (items: MobiTocItemLike[] | undefined) => {
      for (const item of items ?? []) {
        try {
          const resolved = book?.resolveHref?.(item.href)
          if (resolved?.id && !tocTitles.has(resolved.id)) tocTitles.set(resolved.id, item.label)
        } catch {
          // A broken TOC link should not discard the rest of the book.
        }
        visitToc(item.children)
      }
    }
    visitToc(book.getToc?.())

    for (const chapter of book.getSpine()) {
      let loaded: { html: string } | undefined
      try {
        loaded = book.loadChapter(chapter.id)
      } catch {
        // Some chapters reference resources the parser cannot resolve; keep the rest.
        continue
      }
      if (!loaded?.html) continue
      const parsed = chapterMarkdown(loaded.html)
      if (parsed.markdown.replace(/\s/g, '').length < 40) continue
      chapters.push(parsed.markdown)
      if (parsed.title) chapterTitles.push(parsed.title)
      const title = articleTitleFrom(
        parsed.markdown,
        tocTitles.get(chapter.id) ?? parsed.title,
        articles.length,
      )
      articles.push(makeArticle(articles.length, title, parsed.markdown))
    }

    const text = chapters.join('\n\n').trim()
    if (text.length < 100) return null

    const metadata = book.getMetadata()
    const creator = (metadata.author ?? []).map((author) => author.trim()).filter(Boolean).join(', ')
    return {
      title: metadata.title?.trim() || fallbackTitle,
      creator: creator || undefined,
      text,
      segments: segmentsFromText(text),
      articles,
      metadata: {
        format: attempt.format,
        parser: attempt.format,
        chapters: chapters.length,
        articles: articles.length,
        sizeBytes: buffer.byteLength,
        ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
        ...(metadata.language ? { language: metadata.language } : {}),
        ...(metadata.published ? { published: metadata.published } : {}),
        ...(chapterTitles.length ? { chapterTitles: chapterTitles.slice(0, 50).join(' | ') } : {}),
      },
    }
  } finally {
    book?.destroy()
    await fs.rm(resourceDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function readMobiBuffer(buffer: Buffer, options: MobiReadOptions): Promise<MobiResult> {
  const extension = path.extname(options.label ?? options.fallbackTitle).toLowerCase()
  const { initMobiFile, initKf8File } = await import('@lingo-reader/mobi-parser')

  const mobile: Attempt = { format: 'mobi', init: initMobiFile as MobiInitializer }
  const kf8: Attempt = { format: 'azw3', init: initKf8File as MobiInitializer }
  const attempts = extension === '.azw3' ? [kf8, mobile] : [mobile, kf8]

  let best: MobiResult | null = null
  for (const attempt of attempts) {
    try {
      const result = await parseWith(buffer, attempt, options.fallbackTitle)
      if (result && (!best || result.text.length > best.text.length)) best = result
      // A normal book has plenty of text; skip the second, slower container pass.
      if (best && best.text.length >= 1000) break
    } catch {
      // Try the other container format: `.mobi` files can contain either MOBI or KF8.
    }
  }

  if (!best) {
    throw new Error(
      `Could not read ${options.label ?? options.fallbackTitle}. It may be DRM-protected, corrupt, or an unsupported MOBI/AZW variant.`,
    )
  }
  return best
}

export async function readMobi(filePath: string): Promise<MobiResult> {
  const buffer = await fs.readFile(filePath)
  return readMobiBuffer(buffer, {
    fallbackTitle: path.basename(filePath, path.extname(filePath)),
    label: path.basename(filePath),
  })
}
