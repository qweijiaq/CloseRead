import fs from 'node:fs/promises'
import path from 'node:path'

import type { ResourceArticle, Segment } from '../types.js'
import { articleTitleFrom, makeArticle } from './articles.js'
import { segmentsFromText } from './segment.js'

export interface PdfPage {
  page: number
  text: string
}

export interface PdfResult {
  title: string
  pages: PdfPage[]
  text: string
  segments: Segment[]
  articles: ResourceArticle[]
  metadata: Record<string, string | number>
}

export interface PdfReadOptions {
  fallbackTitle: string
  /** Human-readable source name for error messages. */
  label?: string
}

const LIGATURES: Record<string, string> = {
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'ﬅ': 'st',
  'ﬆ': 'st',
}

export function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\uFB00-\uFB06]/g, (character) => LIGATURES[character] ?? character)
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}
/**
 * Rejoin PDF lines into paragraphs. PDF text has hard line breaks in the middle
 * of sentences and sometimes in the middle of hyphenated words.
 */
export function reflowPdfPage(text: string): string {
  const lines = normalizePdfText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const paragraphs: string[] = []
  let current = ''

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const next = lines[index + 1]

    if (/^#{1,6}\s/.test(line)) {
      if (current) paragraphs.push(current)
      paragraphs.push(line)
      current = ''
      continue
    }

    // A short first line without terminal punctuation is usually the document title.
    if (index === 0 && line.length <= 120 && !/[.!?]$/.test(line) && next && /^[A-Z0-9]/.test(next)) {
      paragraphs.push(line)
      continue
    }

    if (!current) {
      current = line
      continue
    }

    // A trailing hyphen at a line break is either a split word or a real compound;
    // joining without the space keeps both readable ("under-standing", "well-known").
    if (/-$/.test(current) && /^[a-z]/.test(line)) {
      current += line
      continue
    }

    // Some PDF generators split a word across lines without a hyphen ("t / hey").
    // A line ending in a single lowercase letter (other than "a") is such a split.
    const lastWord = current.slice(current.lastIndexOf(' ') + 1)
    if (lastWord.length === 1 && /^[a-z]$/.test(lastWord) && lastWord !== 'a' && /^[a-z]/.test(line)) {
      current += line
      continue
    }

    const endsSentence = /[.!?:;]$/.test(current) && /^[A-Z0-9"'(]/.test(line)
    if (endsSentence) {
      paragraphs.push(current)
      current = line
      continue
    }
    current += ` ${line}`
  }

  if (current) paragraphs.push(current)
  return paragraphs.join('\n\n').replace(/\s+([,.;:!?])/g, '$1')
}

function runningLineKey(line: string): string {
  return line.trim().replace(/\d+/g, '#').replace(/\s+/g, ' ').toLowerCase()
}

function isPageNumberLine(line: string): boolean {
  return /^(?:page|p\.?)?\s*[-–—]?\s*\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?$/i.test(line)
}

function looksLikeNumberedHeader(line: string): boolean {
  return line.length <= 60 && /(?:\||·|—|–|-)\s*\d{1,4}$/.test(line)
}

/**
 * Drop repeated running headers/footers such as the book title or page numbers.
 * Exact duplicates are safe to remove anywhere. Lines whose only variation is a
 * page number are only considered near the top or bottom of a page, so a
 * numbered sentence in the body is not mistaken for a header.
 */
export function stripRunningLines(pages: PdfPage[]): PdfPage[] {
  if (pages.length < 4) return pages

  const exactCounts = new Map<string, number>()
  const numberedCounts = new Map<string, number>()

  for (const page of pages) {
    const lines = page.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const edgeLines = new Set(
      lines.length > 4 ? [...lines.slice(0, 2), ...lines.slice(-2)] : lines,
    )
    const seenExact = new Set<string>()
    const seenNumbered = new Set<string>()

    for (const line of lines) {
      if (!line || line.length > 100) continue
      if (!seenExact.has(line)) {
        seenExact.add(line)
        exactCounts.set(line, (exactCounts.get(line) ?? 0) + 1)
      }
      if (!edgeLines.has(line)) continue
      if (!isPageNumberLine(line) && !looksLikeNumberedHeader(line)) continue
      const key = runningLineKey(line)
      if (seenNumbered.has(key)) continue
      seenNumbered.add(key)
      numberedCounts.set(key, (numberedCounts.get(key) ?? 0) + 1)
    }
  }

  const threshold = Math.max(3, Math.ceil(pages.length * 0.6))
  const repeatedExact = new Set(
    [...exactCounts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line),
  )
  const repeatedNumbered = new Set(
    [...numberedCounts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key),
  )
  if (repeatedExact.size === 0 && repeatedNumbered.size === 0) return pages

  return pages.map((page) => ({
    page: page.page,
    text: page.text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        if (!trimmed) return true
        if (repeatedExact.has(trimmed)) return false
        return !repeatedNumbered.has(runningLineKey(trimmed))
      })
      .join('\n'),
  }))
}

function pdfError(error: unknown, label: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('No selectable text') || message.startsWith('Could not read')) {
    return error instanceof Error ? error : new Error(message)
  }
  if (/password|encrypt/i.test(message)) {
    return new Error(`Could not read ${label}: the PDF is password-protected. Remove the password and retry.`)
  }
  return new Error(`Could not read ${label}: ${message}`)
}

interface OutlineEntry {
  title: string
  page: number
}

/**
 * Resolve PDF bookmarks to page numbers. pdf-parse exposes raw destination
 * references, which are object numbers rather than page indices; pdf.js can
 * resolve them through getPageIndex().
 */
async function resolveOutline(buffer: Buffer): Promise<OutlineEntry[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    isOffscreenCanvasSupported: false,
    verbosity: 0,
  }).promise

  try {
    const outline = await document.getOutline()
    const entries: OutlineEntry[] = []
    for (const item of outline ?? []) {
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      if (!title) continue
      let dest = item.dest
      if (typeof dest === 'string') dest = await document.getDestination(dest)
      if (!Array.isArray(dest) || dest.length === 0) continue
      try {
        const pageIndex = await document.getPageIndex(dest[0] as never)
        entries.push({ title, page: pageIndex + 1 })
      } catch {
        // Skip a bookmark whose destination cannot be resolved.
      }
    }
    return entries
  } finally {
    await document.destroy()
  }
}

/** Turn top-level PDF bookmarks into article-sized page ranges. */
function outlineArticles(entries: OutlineEntry[], pages: PdfPage[]): ResourceArticle[] {
  const unique = entries
    .filter((entry) => entry.page >= 1)
    .sort((a, b) => a.page - b.page)
    .filter((entry, index, sorted) => index === 0 || entry.page !== sorted[index - 1]!.page)

  const lastPage = pages[pages.length - 1]?.page ?? 0
  const articles: ResourceArticle[] = []

  for (let index = 0; index < unique.length; index++) {
    const start = unique[index]!.page
    const end = index + 1 < unique.length ? unique[index + 1]!.page - 1 : lastPage
    if (end < start) continue
    const articlePages = pages.filter((page) => page.page >= start && page.page <= end)
    if (articlePages.length === 0) continue

    const text = articlePages.map((page) => page.text).join('\n\n').trim()
    if (text.replace(/\s/g, '').length < 100) continue

    const segments: Segment[] = []
    for (const page of articlePages) {
      segments.push(...segmentsFromText(page.text, segments.length, page.page))
    }
    articles.push(
      makeArticle(articles.length, articleTitleFrom(text, unique[index]!.title, articles.length), text, segments),
    )
  }

  return articles
}

export async function readPdfBuffer(buffer: Buffer, options: PdfReadOptions): Promise<PdfResult> {
  const label = options.label ?? options.fallbackTitle
  const { PDFParse } = await import('pdf-parse')
  let parser: InstanceType<typeof PDFParse> | undefined

  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) })
    const info = await parser.getInfo()
    const result = await parser.getText({ pageJoiner: '' })

    const rawPages: PdfPage[] = result.pages
      .map((page) => ({ page: page.num, text: normalizePdfText(page.text) }))
      .filter((page) => page.text.trim().length > 0)
    const cleanedPages = stripRunningLines(rawPages)
    const pages: PdfPage[] = cleanedPages
      .map((page) => ({ page: page.page, text: reflowPdfPage(page.text) }))
      .filter((page) => page.text.length > 0)

    const totalChars = pages.reduce((total, page) => total + page.text.length, 0)
    if (totalChars < 200) {
      throw new Error(
        `No selectable text found in ${label} (${info.total ?? rawPages.length} pages). ` +
          'It may be a scanned PDF; OCR is not supported yet. Use a text-layer PDF or paste the text instead.',
      )
    }

    const segments: Segment[] = []
    for (const page of pages) {
      const pageSegments = segmentsFromText(page.text, segments.length, page.page)
      segments.push(...pageSegments)
    }

    let articles: ResourceArticle[] = []
    try {
      articles = outlineArticles(await resolveOutline(buffer), pages)
    } catch {
      // Bookmark resolution is optional; text extraction still works without it.
    }

    const titleFromInfo = typeof info.info?.Title === 'string' ? info.info.Title.trim() : ''
    const firstLine = pages[0]?.text.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim()
    const title =
      titleFromInfo ||
      (firstLine && firstLine.length <= 120 && !/[.!?]$/.test(firstLine) ? firstLine : options.fallbackTitle)

    return {
      title,
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      segments,
      articles,
      metadata: {
        pages: info.total ?? pages.length,
        extractablePages: pages.length,
        articles: articles.length,
        sizeBytes: buffer.byteLength,
      },
    }
  } catch (error) {
    throw pdfError(error, label)
  } finally {
    await parser?.destroy().catch(() => {})
  }
}

export async function readPdf(filePath: string): Promise<PdfResult> {
  const buffer = await fs.readFile(filePath)
  return readPdfBuffer(buffer, {
    fallbackTitle: path.basename(filePath, path.extname(filePath)),
    label: path.basename(filePath),
  })
}
