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
  return normalizePdfText(text)
    .split(/\n\s*\n/)
    .map((block) => reflowBlock(block))
    .filter(Boolean)
    .join('\n\n')
}

function reflowBlock(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const paragraphs: string[] = []
  let current = ''

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!

    if (/^#{1,6}\s/.test(line)) {
      if (current) paragraphs.push(current)
      paragraphs.push(line)
      current = ''
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


interface RawTextItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}

interface TextLine {
  text: string
  x: number
  endX: number
  y: number
  height: number
}

interface LayoutPage {
  page: number
  lines: TextLine[]
  twoColumn: boolean
}

interface LayoutExtraction {
  pages: LayoutPage[]
  totalPages: number
  title: string
}

/** Group loose text runs into visual lines, keeping the horizontal gaps as spaces. */
function groupLines(items: RawTextItem[]): TextLine[] {
  const runs = items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => ({
      text: item.str!.replace(/\s+/g, ' '),
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? 0,
      height: item.height ?? 10,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: TextLine[] = []
  let row: typeof runs = []
  let rowY = Number.NaN

  const flush = () => {
    if (!row.length) return
    row.sort((a, b) => a.x - b.x)
    let text = ''
    let cursor: number | null = null
    for (const run of row) {
      if (cursor !== null && run.x - cursor > Math.max(1.2, run.height * 0.14)) text += ' '
      text += run.text
      cursor = run.x + run.width
    }
    const first = row[0]!
    const height = Math.max(...row.map((run) => run.height))
    lines.push({ text: text.trim(), x: first.x, endX: cursor ?? first.x, y: first.y, height })
    row = []
  }

  for (const run of runs) {
    if (row.length && Math.abs(run.y - rowY) > Math.max(2, run.height * 0.4)) flush()
    if (!row.length) rowY = run.y
    row.push(run)
  }
  flush()
  return lines.filter((line) => line.text)
}

/**
 * Put a two-column page back into reading order. Full-width lines (titles,
 * headers, figures) split the page into bands; within a band the left column
 * is read before the right one.
 */
function orderColumns(lines: TextLine[], width: number): { lines: TextLine[]; twoColumn: boolean } {
  const left: TextLine[] = []
  const right: TextLine[] = []
  const full = new Set<TextLine>()

  for (const line of lines) {
    if (line.x < width * 0.15 && line.endX > width * 0.85) full.add(line)
    else if (line.endX <= width * 0.55) left.push(line)
    else if (line.x >= width * 0.45) right.push(line)
    else full.add(line)
  }

  if (left.length < 4 || right.length < 4) return { lines, twoColumn: false }
  const leftTop = Math.max(...left.map((line) => line.y))
  const leftBottom = Math.min(...left.map((line) => line.y))
  const rightTop = Math.max(...right.map((line) => line.y))
  const rightBottom = Math.min(...right.map((line) => line.y))
  const overlap = Math.min(leftTop, rightTop) - Math.max(leftBottom, rightBottom)
  if (overlap < 80) return { lines, twoColumn: false }

  const all = [...lines].sort((a, b) => b.y - a.y || a.x - b.x)
  const ordered: TextLine[] = []
  let index = 0
  while (index < all.length) {
    if (full.has(all[index]!)) {
      ordered.push(all[index]!)
      index++
      continue
    }
    const band: TextLine[] = []
    while (index < all.length && !full.has(all[index]!)) band.push(all[index++]!)
    const bandLeft = band.filter((line) => line.endX <= width * 0.55)
    const bandRight = band.filter((line) => line.x >= width * 0.45)
    ordered.push(...bandLeft, ...bandRight)
    for (const line of band) {
      if (!bandLeft.includes(line) && !bandRight.includes(line)) ordered.push(line)
    }
  }

  return { lines: ordered, twoColumn: true }
}

/** Extract pages through pdf.js so multi-column layouts keep their reading order. */
async function extractLayout(buffer: Buffer): Promise<LayoutExtraction> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    isOffscreenCanvasSupported: false,
    verbosity: 0,
  }).promise

  try {
    const pages: LayoutPage[] = []
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const lines = orderColumns(groupLines(content.items as unknown as RawTextItem[]), viewport.width)
      pages.push({ page: number, lines: lines.lines, twoColumn: lines.twoColumn })
      page.cleanup()
    }
    let title = ''
    try {
      const metadata = (await document.getMetadata()) as unknown as { info?: { Title?: unknown } }
      if (typeof metadata.info?.Title === 'string') title = metadata.info.Title.trim()
    } catch {
      // Metadata is optional.
    }
    return { pages, totalPages: document.numPages, title }
  } finally {
    await document.destroy()
  }
}


/** Preserve paragraph gaps as blank lines so reflow does not merge a whole page. */
function layoutPageText(page: LayoutPage): string {
  const heights = page.lines.map((line) => line.height).sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)] ?? 12
  const output: string[] = []
  let previousY: number | null = null
  for (const line of page.lines) {
    if (previousY !== null && previousY - line.y > median * 1.6) output.push('')
    output.push(line.text)
    previousY = line.y
  }
  return output.join('\n')
}

function lineCount(pages: PdfPage[]): number {
  return pages.reduce((total, page) => total + page.text.split('\n').filter((line) => line.trim()).length, 0)
}

function isContentsPage(page: PdfPage): boolean {
  const lines = page.text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length < 6) return false
  const withPageNumbers = lines.filter((line) => /(?:\.{2,}|…{2,}|\s)\s*\d{1,4}$/.test(line)).length
  const average = lines.reduce((total, line) => total + line.length, 0) / lines.length
  return withPageNumbers >= Math.max(4, Math.ceil(lines.length * 0.35)) && average < 90
}

function headingOf(page: PdfPage): string {
  const first = page.text.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
  if (!first || first.length > 80) return ''
  if (/[.!?,;:]$/.test(first)) return ''
  const words = first.split(/\s+/)
  if (words.length < 1 || words.length > 11) return ''
  if (/^(chapter|part|section|第.+[章节])/i.test(first)) return first
  const capitalised = words.filter((word) => /^[A-Z0-9"'(]/.test(word)).length
  if (capitalised / words.length < 0.6) return ''
  return first
}

/** Drop front matter, tables of contents, indexes and reference lists. */
function trimStructure(pages: PdfPage[]): { pages: PdfPage[]; skipped: number } {
  if (pages.length < 4) return { pages, skipped: 0 }
  let trimmed = pages.slice()
  const frontWindow = Math.max(3, Math.ceil(trimmed.length * 0.15))
  const contents = new Set(
    trimmed.slice(0, frontWindow).filter(isContentsPage).map((page) => page.page),
  )
  trimmed = trimmed.filter((page) => !contents.has(page.page))

  let cursor = 0
  while (cursor < 2 && trimmed.length - cursor > 4) {
    const page = trimmed[cursor]!
    const words = page.text.trim().split(/\s+/).filter(Boolean).length
    if (words >= 60) break
    cursor++
  }
  trimmed = trimmed.slice(cursor)

  const tailStart = Math.floor(trimmed.length * 0.6)
  const backMatter = trimmed.slice(tailStart).find((page) =>
    page.text
      .split('\n')
      .slice(-3)
      .some((line) => /^(references|bibliography|works cited|works consulted|index|参考文献|参考书目)$/i.test(line.trim())),
  )
  if (backMatter) {
    const position = trimmed.indexOf(backMatter)
    if (position >= tailStart && trimmed.length - position >= 1) trimmed = trimmed.slice(0, position)
  }

  return { pages: trimmed, skipped: pages.length - trimmed.length }
}

function headingArticles(pages: PdfPage[]): ResourceArticle[] {
  if (pages.length < 12) return []
  const starts = pages
    .map((page, index) => ({ page, index, heading: headingOf(page) }))
    .filter((entry) => entry.heading)
  if (starts.length < 3) return []

  const articles: ResourceArticle[] = []
  for (let index = 0; index < starts.length; index++) {
    const start = starts[index]!
    const end = index + 1 < starts.length ? starts[index + 1]!.index : pages.length
    if (end - start.index < 2) continue
    const slice = pages.slice(start.index, end)
    const text = slice.map((page) => page.text).join('\n\n').trim()
    if (text.replace(/\s/g, '').length < 200) continue
    const segments: Segment[] = []
    for (const page of slice) segments.push(...segmentsFromText(page.text, segments.length, page.page))
    articles.push(makeArticle(articles.length, articleTitleFrom(text, start.heading, articles.length), text, segments))
  }
  return articles.length >= 2 ? articles : []
}

export async function readPdfBuffer(buffer: Buffer, options: PdfReadOptions): Promise<PdfResult> {
  const label = options.label ?? options.fallbackTitle
  let parser: InstanceType<(typeof import('pdf-parse'))['PDFParse']> | undefined

  try {
    let layout: LayoutExtraction | null = null
    let layoutError: unknown = null
    try {
      layout = await extractLayout(buffer)
    } catch (error) {
      layoutError = error
    }

    let rawPages: PdfPage[]
    let totalPages: number
    let titleFromInfo = ''

    if (layout && layout.pages.some((page) => page.lines.length > 0)) {
      rawPages = layout.pages
        .map((page) => ({ page: page.page, text: layoutPageText(page) }))
        .filter((page) => page.text.trim().length > 0)
      totalPages = layout.totalPages
      titleFromInfo = layout.title
    } else {
      if (layoutError) throw layoutError
      const { PDFParse } = await import('pdf-parse')
      parser = new PDFParse({ data: new Uint8Array(buffer) })
      const info = await parser.getInfo()
      const result = await parser.getText({ pageJoiner: '' })
      rawPages = result.pages
        .map((page) => ({ page: page.num, text: normalizePdfText(page.text) }))
        .filter((page) => page.text.trim().length > 0)
      totalPages = info.total ?? rawPages.length
      titleFromInfo = typeof info.info?.Title === 'string' ? info.info.Title.trim() : ''
    }

    const deduped = stripRunningLines(rawPages)
    const removedLines = lineCount(rawPages) - lineCount(deduped)
    const trimmed = trimStructure(deduped)
    const pages: PdfPage[] = trimmed.pages
      .map((page) => ({ page: page.page, text: reflowPdfPage(page.text) }))
      .filter((page) => page.text.length > 0)

    const totalChars = pages.reduce((total, page) => total + page.text.length, 0)
    if (totalChars < 200) {
      throw new Error(
        `No selectable text found in ${label} (${totalPages} pages). ` +
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
    if (articles.length === 0) articles = headingArticles(pages)

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
        pages: totalPages,
        extractablePages: pages.length,
        articles: articles.length,
        sizeBytes: buffer.byteLength,
        twoColumnPages: layout?.pages.filter((page) => page.twoColumn).length ?? 0,
        removedLines,
        skippedPages: trimmed.skipped,
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
