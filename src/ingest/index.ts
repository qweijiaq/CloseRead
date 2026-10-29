import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'
import type { Resource, ResourceArticle, ResourceKind, Segment } from '../types.js'
import { readPdf, readPdfBuffer } from './pdf.js'
import { readEpub, readEpubBuffer } from './epub.js'
import { readMobi, readMobiBuffer } from './mobi.js'
import { parseTranscript, segmentsFromText } from './segment.js'
import { countWords } from './summary.js'
import { detectBlockedPage, extractArticle, fetchUrl, titleFromUrl } from './web.js'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.webm', '.avi'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.opus'])
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.text'])
const TRANSCRIPT_EXTENSIONS = new Set(['.srt', '.vtt'])

/** Extensions that mean "this is a path", even when the file does not exist. */
const PATH_EXTENSIONS = new Set([
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...TRANSCRIPT_EXTENSIONS,
  '.pdf',
  '.epub',
  '.html',
  '.htm',
  '.doc',
  '.docx',
  '.rtf',
  '.mobi',
  '.azw',
  '.azw3',
])

export interface IngestOptions {
  /** Override the title derived from the file, page, or first line. */
  title?: string
  /** Where pasted text came from, for pack references. */
  source?: string
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resource'
  )
}

function timestampId(): string {
  const now = new Date()
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex')
}

function titleFromText(text: string, fallback: string): string {
  const heading = text.split('\n').find((line) => /^#{1,6}\s+/.test(line))
  if (heading) return heading.replace(/^#{1,6}\s+/, '').trim()

  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (firstLine && firstLine.length <= 90 && !/[.!?。！？]$/.test(firstLine)) return firstLine
  return fallback
}

/** Accept `example.com/article` as well as explicit http(s) URLs. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/\s/.test(trimmed)) return null
  const extension = path.extname(trimmed).toLowerCase()
  if (PATH_EXTENSIONS.has(extension) && !trimmed.includes('/')) return null
  if (/^[\w-]+(?:\.[\w-]+)+(?::\d+)?(?:[/?#]\S*)?$/i.test(trimmed)) return `https://${trimmed}`
  return null
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function persistResource(input: {
  title: string
  kind: ResourceKind
  source: string
  text: string
  segments: Segment[]
  articles?: ResourceArticle[]
  metadata?: Record<string, string | number>
}): Promise<Resource> {
  const text = input.text.replace(/\r\n?/g, '\n').trim()
  if (text.length < 100) throw new Error('The input produced too little text to build a learning pack.')

  const title = input.title.trim() || 'Untitled resource'
  const id = `${timestampId()}-${slugify(title)}`
  const articles = input.articles && input.articles.length > 0 ? input.articles : undefined
  const resource: Resource = {
    id,
    title,
    kind: input.kind,
    source: input.source,
    text,
    wordCount: countWords(text),
    segments: input.segments,
    ...(articles ? { articles } : {}),
    metadata: {
      ...input.metadata,
      chars: text.length,
      hash: contentHash(text),
      ...(articles ? { articles: articles.length } : {}),
    },
    createdAt: new Date().toISOString(),
  }

  const resourceDir = path.join(config.dataDir, 'resources')
  await fs.mkdir(resourceDir, { recursive: true })
  await fs.writeFile(path.join(resourceDir, `${resource.id}.json`), JSON.stringify(resource, null, 2), 'utf8')
  return resource
}

/** Ingest pasted text that did not come from a file or URL. */
export async function ingestText(raw: string, options: IngestOptions = {}): Promise<Resource> {
  const text = raw.replace(/\r\n?/g, '\n').trim()
  if (!text) throw new Error('No text provided. Paste an article or pass a file path or URL.')

  return persistResource({
    title: options.title?.trim() || titleFromText(text, 'Pasted text'),
    kind: 'text',
    source: options.source ?? 'pasted',
    text,
    segments: segmentsFromText(text),
    metadata: { format: 'pasted' },
  })
}

export interface IngestPdfOptions extends IngestOptions {
  filename?: string
}

export interface IngestEbookOptions extends IngestOptions {
  filename?: string
}

/** Ingest a PDF uploaded from the browser, without writing a temporary file. */
export async function ingestPdfBuffer(buffer: Buffer, options: IngestPdfOptions = {}): Promise<Resource> {
  if (buffer.length === 0) throw new Error('The uploaded PDF is empty.')
  if (!buffer.toString('latin1', 0, 1024).includes('%PDF-')) {
    throw new Error('The uploaded file is not a valid PDF.')
  }
  const filename = options.filename?.trim() || 'uploaded.pdf'
  const fallbackTitle = path.basename(filename, path.extname(filename)).trim() || 'Uploaded PDF'
  const pdf = await readPdfBuffer(buffer, { fallbackTitle, label: filename })

  return persistResource({
    title: options.title?.trim() || pdf.title,
    kind: 'pdf',
    source: `upload:${filename}`,
    text: pdf.text,
    segments: pdf.segments,
    articles: pdf.articles,
    metadata: { ...pdf.metadata, format: 'pdf', filename },
  })
}

/** Ingest an EPUB uploaded from the browser. */
export async function ingestEpubBuffer(buffer: Buffer, options: IngestEbookOptions = {}): Promise<Resource> {
  if (buffer.length === 0) throw new Error('The uploaded EPUB is empty.')
  const filename = options.filename?.trim() || 'uploaded.epub'
  const fallbackTitle = path.basename(filename, path.extname(filename)).trim() || 'Uploaded EPUB'
  const epub = await readEpubBuffer(buffer, fallbackTitle)

  return persistResource({
    title: options.title?.trim() || epub.title,
    kind: 'epub',
    source: `upload:${filename}`,
    text: epub.text,
    segments: epub.segments,
    articles: epub.articles,
    metadata: {
      ...epub.metadata,
      format: 'epub',
      filename,
      ...(epub.creator ? { creator: epub.creator } : {}),
    },
  })
}

/** Ingest a MOBI/AZW/AZW3 uploaded from the browser. */
export async function ingestMobiBuffer(buffer: Buffer, options: IngestEbookOptions = {}): Promise<Resource> {
  if (buffer.length === 0) throw new Error('The uploaded ebook is empty.')
  const filename = options.filename?.trim() || 'uploaded.mobi'
  const extension = path.extname(filename).toLowerCase().replace('.', '') || 'mobi'
  const fallbackTitle = path.basename(filename, path.extname(filename)).trim() || 'Uploaded ebook'
  const mobi = await readMobiBuffer(buffer, { fallbackTitle, label: filename })

  return persistResource({
    title: options.title?.trim() || mobi.title,
    kind: 'mobi',
    source: `upload:${filename}`,
    text: mobi.text,
    segments: mobi.segments,
    articles: mobi.articles,
    metadata: {
      ...mobi.metadata,
      format: extension,
      filename,
      ...(mobi.creator ? { creator: mobi.creator } : {}),
    },
  })
}

async function ingestFile(filePath: string, options: IngestOptions): Promise<Resource> {
  const extension = path.extname(filePath).toLowerCase()
  const fallbackTitle = path.basename(filePath, extension)

  if (extension === '.pdf') {
    const pdf = await readPdf(filePath)
    return persistResource({
      title: options.title?.trim() || pdf.title,
      kind: 'pdf',
      source: filePath,
      text: pdf.text,
      segments: pdf.segments,
      articles: pdf.articles,
      metadata: { ...pdf.metadata, format: 'pdf' },
    })
  }

  if (extension === '.epub') {
    const epub = await readEpub(filePath)
    return persistResource({
      title: options.title?.trim() || epub.title,
      kind: 'epub',
      source: filePath,
      text: epub.text,
      segments: epub.segments,
      articles: epub.articles,
      metadata: { ...epub.metadata, format: 'epub', ...(epub.creator ? { creator: epub.creator } : {}) },
    })
  }

  if (extension === '.mobi' || extension === '.azw' || extension === '.azw3') {
    const mobi = await readMobi(filePath)
    return persistResource({
      title: options.title?.trim() || mobi.title,
      kind: 'mobi',
      source: filePath,
      text: mobi.text,
      segments: mobi.segments,
      articles: mobi.articles,
      metadata: {
        ...mobi.metadata,
        format: extension.slice(1),
        ...(mobi.creator ? { creator: mobi.creator } : {}),
      },
    })
  }

  if (TRANSCRIPT_EXTENSIONS.has(extension)) {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = parseTranscript(raw)
    return persistResource({
      title: options.title?.trim() || fallbackTitle,
      kind: 'transcript',
      source: filePath,
      text: parsed.text,
      segments: parsed.segments,
      metadata: { format: extension.slice(1) },
    })
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    const raw = await fs.readFile(filePath, 'utf8')
    return persistResource({
      title: options.title?.trim() || titleFromText(raw, fallbackTitle),
      kind: 'text',
      source: filePath,
      text: raw,
      segments: segmentsFromText(raw),
      metadata: { format: extension.slice(1) },
    })
  }

  if (extension === '.html' || extension === '.htm') {
    const raw = await fs.readFile(filePath, 'utf8')
    const article = extractArticle(raw, fallbackTitle)
    return persistResource({
      title: options.title?.trim() || article.title,
      kind: 'web',
      source: filePath,
      text: article.text,
      segments: segmentsFromText(article.text),
      metadata: { format: 'html', extraction: article.selector },
    })
  }

  if (VIDEO_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension)) {
    const base = filePath.slice(0, -extension.length)
    let transcript: string | null = null
    for (const candidate of ['.srt', '.vtt', '.txt', '.md']) {
      try {
        const content = await fs.readFile(base + candidate, 'utf8')
        if (content.trim()) {
          transcript = content
          break
        }
      } catch {
        // Try the next extension.
      }
    }
    if (!transcript) {
      throw new Error(
        `No transcript found for ${path.basename(
          filePath,
        )}. Put a matching .srt, .vtt, .txt or .md file next to it, or transcribe it first.`,
      )
    }
    const parsed = parseTranscript(transcript)
    return persistResource({
      title: options.title?.trim() || fallbackTitle,
      kind: 'transcript',
      source: filePath,
      text: parsed.text,
      segments: parsed.segments,
      metadata: { format: extension.slice(1), transcript: 'sibling' },
    })
  }

  throw new Error(
    `Unsupported file type: ${extension || '(no extension)'}. Supported: .pdf, .epub, .mobi, .azw, .azw3, .txt, .md, .srt, .vtt, .html, .htm, URLs, and audio/video with a sibling transcript.`,
  )
}

async function ingestUrl(url: string, options: IngestOptions): Promise<Resource> {
  const fetched = await fetchUrl(url)

  if (fetched.pdf) {
    const fallbackTitle = titleFromUrl(fetched.finalUrl)
    const pdf = await readPdfBuffer(Buffer.from(fetched.pdf), {
      fallbackTitle,
      label: fetched.finalUrl,
    })
    return persistResource({
      title: options.title?.trim() || pdf.title,
      kind: 'pdf',
      source: url,
      text: pdf.text,
      segments: pdf.segments,
      metadata: { ...pdf.metadata, format: 'pdf', url: fetched.finalUrl },
    })
  }

  if (fetched.html !== undefined) {
    const article = extractArticle(fetched.html, titleFromUrl(fetched.finalUrl))
    if (article.text.length < 200) {
      const hint = detectBlockedPage(fetched.html)
      throw new Error(
        `The page did not contain enough extractable article text.${
          hint ? ` ${hint}` : ''
        } Save the article as HTML or paste its text instead.`,
      )
    }
    return persistResource({
      title: options.title?.trim() || article.title || titleFromUrl(fetched.finalUrl),
      kind: 'web',
      source: url,
      text: article.text,
      segments: segmentsFromText(article.text),
      metadata: { url: fetched.finalUrl, extraction: article.selector },
    })
  }

  if (fetched.text !== undefined) {
    return ingestText(fetched.text, {
      title: options.title?.trim() || titleFromUrl(fetched.finalUrl),
      source: url,
    })
  }

  throw new Error(`Could not determine what ${url} contains.`)
}

export async function ingestSource(input: string, options: IngestOptions = {}): Promise<Resource> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('No input provided.')

  if (/^https?:\/\//i.test(trimmed)) return ingestUrl(trimmed, options)

  const filePath = path.resolve(trimmed)
  if (await fileExists(filePath)) return ingestFile(filePath, options)

  const url = normalizeUrl(trimmed)
  if (url) return ingestUrl(url, options)

  const extension = path.extname(trimmed).toLowerCase()
  if (PATH_EXTENSIONS.has(extension)) throw new Error(`File not found: ${trimmed}`)

  throw new Error(
    `"${trimmed}" is not a readable file or URL. To add pasted text, run "pnpm dev add" and paste it, or use --text / --clipboard.`,
  )
}
