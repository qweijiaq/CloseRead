import * as cheerio from 'cheerio'

export interface FeedItem {
  title: string
  link: string
  published?: string
  summary?: string
}

export interface ParsedFeed {
  title: string
  items: FeedItem[]
}

export function looksLikeFeed(value: string): boolean {
  const head = value.trimStart().slice(0, 500).toLowerCase()
  return (
    head.startsWith('<?xml') &&
    (head.includes('<rss') || head.includes('<feed') || head.includes('<rdf'))
  )
}

function textOf($: cheerio.CheerioAPI, node: any, selector: string): string {
  return $(node).find(selector).first().text().replace(/\s+/g, ' ').trim()
}

function linkOf($: cheerio.CheerioAPI, node: any, baseUrl: string): string {
  const links = $(node).find('link')
  let href = ''
  links.each((_, link) => {
    const rel = $(link).attr('rel')
    const candidate = $(link).attr('href') ?? $(link).text()
    if (!href && candidate && (!rel || rel === 'alternate')) href = candidate
  })
  if (!href) return ''
  try {
    return new URL(href.trim(), baseUrl).toString()
  } catch {
    return ''
  }
}

function publishedOf($: cheerio.CheerioAPI, node: any): string {
  for (const selector of ['pubDate', 'published', 'updated', 'dc\\:date']) {
    const value = textOf($, node, selector)
    if (value) return value
  }
  return ''
}

function summaryOf($: cheerio.CheerioAPI, node: any): string {
  for (const selector of ['description', 'summary', 'content']) {
    const value = textOf($, node, selector)
    if (value) return value.slice(0, 400)
  }
  return ''
}

/** Read the latest items from an RSS 2.0, Atom or RDF feed. */
export function parseFeed(xml: string, baseUrl: string): ParsedFeed {
  const $ = cheerio.load(xml, { xmlMode: true })
  const title =
    $('channel > title').first().text().replace(/\s+/g, ' ').trim() ||
    $('feed > title').first().text().replace(/\s+/g, ' ').trim() ||
    (() => {
      try {
        return new URL(baseUrl).hostname
      } catch {
        return 'Feed'
      }
    })()

  const nodes: any[] = []
  $('item').each((_, node) => {
    nodes.push(node)
  })
  $('entry').each((_, node) => {
    nodes.push(node)
  })

  const items = nodes
    .map((node) => ({
      title: textOf($, node, 'title'),
      link: linkOf($, node, baseUrl),
      published: publishedOf($, node),
      summary: summaryOf($, node),
    }))
    .filter((item) => item.link)

  // Newest first when the feed gives parseable dates. Stable order otherwise.
  items.sort((a, b) => {
    const left = Date.parse(a.published ?? '')
    const right = Date.parse(b.published ?? '')
    if (Number.isNaN(left) || Number.isNaN(right)) return 0
    return right - left
  })

  return { title, items }
}
