import fs from 'node:fs/promises'
import path from 'node:path'

import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { looksLikeFeed } from './feed.js'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

turndown.remove(['script', 'style', 'noscript', 'iframe', 'form'])

const BOILERPLATE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'iframe',
  'form',
  'nav',
  'header',
  'footer',
  'aside',
  'button',
  'figure',
  'figcaption',
  '[role="banner"]',
  '[role="complementary"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[class*="paywall"]',
  '[class*="newsletter"]',
  '[class*="subscribe"]',
  '[class*="advert"]',
  '[class*="ad-slot"]',
  '[class*="share"]',
  '[id*="share"]',
  '[class*="social-share"]',
  '[class*="social-links"]',
  '[class*="related"]',
  '[class*="recommend"]',
  '[class*="promo"]',
  '[class*="preferred"]',
  '[class*="caption"]',
  '[class*="credit"]',
].join(', ')

/** Short labels that stay in the article container but are page furniture, not prose. */
const NOISE_BLOCK_PATTERNS = [
  /^(?:add|make) us (?:as )?(?:a )?(?:preferred|favourite|favorite) source\.?$/i,
  /^#{0,6}\s*(?:read|see) more\b/i,
  /^related(?:\s+articles?|\s+reading)?\s*:?$/i,
  /^more from\b/i,
  /^sign up\b/i,
  /^subscribe\b/i,
  /^follow us\b/i,
  /^share (?:this|on)\b/i,
  /^listen to this article\b/i,
  /^advertisement\b/i,
  /^comments?\b/i,
  /^most popular\b/i,
  /^home\s*\/\s*[a-z]/i,
  /^(?:image|photo|credit|illustration|caption)\s*:/i,
]

const IMAGE_CREDIT_PATTERN =
  /\|\s*[^|]{2,80}\/(?:Getty|Reuters|AP|AFP|Shutterstock|Alamy|Bloomberg|Corbis)/i
const AGENCY_CREDIT_PATTERN = /\/(?:Getty|Reuters|AP|AFP|Shutterstock|Alamy|Bloomberg|Corbis)/i

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

/** True for image captions, credit lines, share buttons and other non-prose blocks. */
function isNoiseBlock(block: string): boolean {
  const text = block.replace(/\s+/g, ' ').trim()
  if (!text) return true

  // A block that is only URLs, percent-encoding or punctuation has no prose.
  const letters = text.replace(/[^A-Za-z]/g, '').length
  if (letters < 2) return true

  // Empty Markdown links are always leftovers from share/bookmark widgets.
  if (/\[\s*\]\(/.test(text) && letters < 40) return true

  // Share widgets often arrive as a run of links with almost no prose around them.
  if (/https?:\/\//i.test(text)) {
    const outsideUrls = text.replace(/https?:\/\/\S+/gi, '').replace(/\[\s*\]\([^)]*\)/g, '')
    if (outsideUrls.replace(/[^A-Za-z]/g, '').length < 12) return true
  }

  const count = wordCount(text)
  if (count <= 12 && NOISE_BLOCK_PATTERNS.some((pattern) => pattern.test(text))) return true
  if (count <= 18 && IMAGE_CREDIT_PATTERN.test(text)) return true
  if (count <= 12 && AGENCY_CREDIT_PATTERN.test(text)) return true
  return false
}

function normalizeBlocks(markdown: string): string {
  const seen = new Set<string>()
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => {
      if (!block || isNoiseBlock(block)) return false
      const key = block.toLowerCase().replace(/\s+/g, ' ')
      if (key.length >= 80 && seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n\n')
    .trim()
}

const CONTENT_CANDIDATES = ['.article-body', '.post-content', '.entry-content', '.content', 'article', 'main', '[role="main"]']

const BLOCKED_PATTERN =
  /captcha|cf-challenge|enable javascript|access denied|just a moment|verify you are human|sign in to continue|subscribe to continue|create a free account/i

export interface ArticleExtraction {
  title: string
  text: string
  selector: string
  chars: number
}

export interface FetchedUrl {
  finalUrl: string
  contentType: string
  html?: string
  text?: string
  xml?: string
  pdf?: Uint8Array
}

function cleanMarkdown(markdown: string): string {
  const withoutLinks = markdown
    // Images first: a site often leaves the image's empty link wrapper behind.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // `[](url)` is a share/bookmark wrapper, not prose.
    .replace(/\[\s*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<https?:\/\/[^>\s]+>/g, '')
    .replace(/^\s*(?:https?:\/\/|www\.)\S+\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
  return normalizeBlocks(withoutLinks)
}

function pickTitle($: cheerio.CheerioAPI, fallbackTitle: string): string {
  return (
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    fallbackTitle
  )
}

/**
 * Turn a page into Markdown. Returns which container was used so the CLI can warn
 * when no article element was found and the whole body was extracted.
 */
export function extractArticle(html: string, fallbackTitle: string): ArticleExtraction {
  const $ = cheerio.load(html)
  const title = pickTitle($, fallbackTitle)

  $(BOILERPLATE_SELECTORS).remove()

  let selector = 'body'
  let bestLength = 0
  let bestHtml = ''

  for (const candidate of CONTENT_CANDIDATES) {
    const node = $(candidate).first()
    if (node.length === 0) continue
    const textLength = node.text().trim().length
    if (textLength > bestLength) {
      bestLength = textLength
      selector = candidate
      bestHtml = node.html() ?? ''
    }
  }

  if (bestLength < 300) {
    selector = 'body'
    bestHtml = $('body').html() ?? ''
  }

  const text = cleanMarkdown(turndown.turndown(bestHtml))
  return { title, text, selector, chars: text.length }
}

/** Only called after extraction failed; a hint, not proof, of a blocked page. */
export function detectBlockedPage(html: string): string | null {
  const $ = cheerio.load(html)
  const title = $('title').text().trim()
  const body = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 1200)
  if (BLOCKED_PATTERN.test(`${title} ${body}`)) {
    return 'The page looks like a paywall, login wall, bot check, or a JavaScript-only page.'
  }
  return null
}

function fetchFailure(url: string, status: number, statusText: string): Error {
  let hint = ''
  if (status === 401 || status === 403) {
    hint = ' The site may require a login or block automated requests; save the page as HTML and add the file instead.'
  } else if (status === 404) {
    hint = ' Check the URL.'
  }
  return new Error(`Fetch failed: HTTP ${status} ${statusText || '(no status text)'} for ${url}.${hint}`)
}

/** Fetch a URL once and classify it as HTML, plain text, or PDF. */
export async function fetchUrl(url: string): Promise<FetchedUrl> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9,*/*;q=0.1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`Timed out fetching ${url} after 20 seconds. Check the connection or try again.`)
    }
    throw new Error(`Could not fetch ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!response.ok) throw fetchFailure(url, response.status, response.statusText)

  const finalUrl = response.url || url
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()

  if (contentType.includes('application/pdf')) {
    return { finalUrl, contentType, pdf: new Uint8Array(await response.arrayBuffer()) }
  }
  if (
    contentType.includes('application/rss+xml') ||
    contentType.includes('application/atom+xml') ||
    contentType.includes('application/rdf+xml') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml')
  ) {
    return { finalUrl, contentType, xml: await response.text() }
  }
  if (!contentType || contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    const body = await response.text()
    // Some feeds are served as text/html; the XML declaration is the reliable signal.
    return looksLikeFeed(body) ? { finalUrl, contentType, xml: body } : { finalUrl, contentType, html: body }
  }
  if (contentType.startsWith('text/plain')) {
    return { finalUrl, contentType, text: await response.text() }
  }

  throw new Error(
    `Unsupported content type "${contentType.split(';')[0]}" at ${finalUrl}. Supported: HTML articles, RSS/Atom feeds, plain text, and PDF.`,
  )
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '')
    const base = last.replace(/\.(pdf|html?|txt|md|markdown)$/i, '').replace(/[-_]+/g, ' ').trim()
    return base ? base.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : parsed.hostname
  } catch {
    return url
  }
}

export async function fetchArticle(url: string): Promise<{ title: string; text: string; metadata: Record<string, string> }> {
  const fetched = await fetchUrl(url)
  if (fetched.html === undefined) {
    throw new Error(`${url} is not an HTML page. Add it as a file or use a direct article URL.`)
  }
  const article = extractArticle(fetched.html, new URL(fetched.finalUrl).hostname)
  if (article.text.length < 200) {
    const hint = detectBlockedPage(fetched.html)
    throw new Error(
      `The page did not contain enough extractable article text.${hint ? ` ${hint}` : ''} Save the article as HTML or paste its text instead.`,
    )
  }
  return { title: article.title, text: article.text, metadata: { url: fetched.finalUrl, extraction: article.selector } }
}

export async function readHtmlFile(filePath: string): Promise<ArticleExtraction> {
  const html = await fs.readFile(filePath, 'utf8')
  return extractArticle(html, path.basename(filePath, path.extname(filePath)))
}
