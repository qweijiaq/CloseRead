import * as cheerio from 'cheerio'

export interface ChapterMarkdown {
  markdown: string
  title?: string
}

/** Shared chapter extraction for EPUB and MOBI/KF8 HTML. */
export function chapterMarkdown(html: string): ChapterMarkdown {
  const $ = cheerio.load(html)
  $('script, style, nav').remove()

  const parts: string[] = []
  const seen = new Set<string>()
  let title: string | undefined

  $('h1, h2, h3, h4, p, li, blockquote').each((_, element) => {
    const tag = element.tagName?.toLowerCase() ?? ''
    const text = $(element).text().replace(/\s+/g, ' ').trim()
    if (!text || seen.has(text)) return
    seen.add(text)

    if (tag === 'h1' && !title) title = text
    const prefix =
      tag === 'h1' ? '# ' : tag === 'h2' ? '## ' : tag === 'h3' ? '### ' : tag === 'h4' ? '#### ' : tag === 'li' ? '- ' : tag === 'blockquote' ? '> ' : ''
    parts.push(`${prefix}${text}`)
  })

  if (parts.length === 0) {
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    if (text) parts.push(text)
  }

  return { markdown: parts.join('\n\n'), title }
}
