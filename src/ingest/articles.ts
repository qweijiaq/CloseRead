import type { Resource, ResourceArticle, Segment } from '../types.js'
import { segmentsFromText } from './segment.js'
import { countWords } from './summary.js'

function cleanTitle(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[>\-•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function articleTitleFrom(markdown: string, explicit: string | undefined, index: number): string {
  const preferred = cleanTitle(explicit ?? '')
  if (preferred) return preferred.slice(0, 120)

  const heading = markdown.split('\n').find((line) => /^#{1,3}\s+/.test(line))
  if (heading) return cleanTitle(heading).slice(0, 120)

  const first = markdown
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (first) {
    const clean = cleanTitle(first)
    if (clean) {
      return clean.length > 90 ? `${clean.slice(0, 90).replace(/\s+\S*$/, '')}…` : clean
    }
  }
  return `Section ${index + 1}`
}

export function makeArticle(
  index: number,
  title: string,
  text: string,
  segments?: Segment[],
): ResourceArticle {
  const body = text.trim()
  return {
    index,
    title: title.trim() || `Section ${index + 1}`,
    text: body,
    wordCount: countWords(body),
    segments: segments ?? segmentsFromText(body),
  }
}

/**
 * Chapter headings that survive in plain text: `# Title`, `第3章 ...`,
 * `Chapter IV`, `【标题】`, and the usual front/back matter.
 */
const CHAPTER_HEADING =
  /^(?:#{1,4}\s+.+|第\s*[0-9一二三四五六七八九十百千零两]+\s*[章回卷部篇节](?:\s+.*)?|[上下中]篇(?:\s+.*)?|序言?|自序|前言|引言|导言|后记|尾声|结语|附录(?:\s+.*)?|Chapter\s+[0-9ivxlcdm]+(?:\s+.*)?|Part\s+[0-9ivxlcdm]+(?:\s+.*)?|【[^】]{2,40}】)$/i

/** Back matter that is never worth reading in an intensive-reading pack. */
const REFERENCE_HEADING =
  /^(?:参考文献|参考书目|引用文献|文献目录|书目|注释|尾注|脚注|索引|延伸阅读|推荐阅读|进一步阅读|注释与参考|References?|Bibliography|Notes?|Endnotes?|Footnotes?|Index|Further\s+Reading)(?:$|[与和及、\s：:].*)/i

export function isChapterHeading(line: string): boolean {
  const text = line.trim()
  return text.length >= 2 && text.length <= 90 && CHAPTER_HEADING.test(text)
}

function isReferenceHeading(line: string): boolean {
  return REFERENCE_HEADING.test(cleanTitle(line))
}

/**
 * Split a text resource into articles. Handles Markdown headings plus the
 * chapter markers people actually use in .txt books, and drops reference
 * sections instead of shipping them as a chapter.
 */
export function splitResourceByHeadings(resource: Resource): ResourceArticle[] {
  const chunks: Array<{ title: string; lines: string[] }> = []
  let title = resource.title
  let lines: string[] = []
  let skippingReferences = false

  const push = () => {
    const text = lines.join('\n').trim()
    if (text.replace(/\s/g, '').length >= 40) chunks.push({ title, lines: [...lines] })
  }

  const skipReferences = () => {
    push()
    lines = []
    skippingReferences = true
  }

  for (const line of resource.text.split('\n')) {
    if (isReferenceHeading(line)) {
      // References usually sit at the end of a section; drop them without
      // splitting the chapter they belong to.
      skipReferences()
      continue
    }
    if (skippingReferences) continue
    if (isChapterHeading(line)) {
      push()
      title = cleanTitle(line) || resource.title
      lines = []
      continue
    }
    lines.push(line)
  }
  push()

  return chunks.map((chunk, index) => {
    const text = chunk.lines.join('\n').trim()
    return makeArticle(index, articleTitleFrom(text, chunk.title, index), text)
  })
}

/** Editorial filter for entries that are navigation, ads, cartoons or data pages. */
export function isStudyArticle(article: ResourceArticle): boolean {
  const title = article.title.trim()
  if (article.wordCount < 120) return false
  if (/^cartoon\b/i.test(title)) return false
  if (/^(table of contents|contents)$/i.test(title)) return false
  if (/^economic (data|&|\/)/i.test(title)) return false
  if (/^the world this week$/i.test(title) && article.wordCount < 300) return false

  // "The world this week" chapters are multi-story news digests, not one article.
  const head = article.text.slice(0, 200).replace(/^#+\s*/, '').trim()
  if (/^the world this week\b/i.test(head)) return false
  return true
}

export function getResourceArticles(resource: Resource): ResourceArticle[] {
  if (resource.articles && resource.articles.length > 0) return resource.articles

  const derived = splitResourceByHeadings(resource)
  if (derived.length > 0) return derived

  return [makeArticle(0, resource.title, resource.text, resource.segments)]
}

export function resourceArticleCount(resource: Resource): number {
  const overrides = resource.articleOverrides ?? {}
  return getResourceArticles(resource).filter(
    (article) => overrides[String(article.index)] ?? isStudyArticle(article),
  ).length
}

function isSectionMarker(article: ResourceArticle): boolean {
  if (article.wordCount >= 120 || article.title.trim().length > 40) return false
  const title = article.title.trim()
  if (/^cartoon\b/i.test(title)) return false
  if (/^(table of contents|contents)$/i.test(title)) return false
  if (/^economic (data|&|\/)/i.test(title)) return false
  if (/优质|英阅阅读器/i.test(title)) return false
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(title)) {
    return false
  }
  return true
}

/** Map each article to the most recent short section-heading page before it. */
export function articleSections(articles: ResourceArticle[]): Map<number, string> {
  const sections = new Map<number, string>()
  let current = ''
  for (const article of articles) {
    if (isSectionMarker(article)) {
      current = article.title.trim()
      continue
    }
    if (current) sections.set(article.index, current)
  }
  return sections
}

/** A single article presented as a resource so the normal build pipeline can run on it. */
export function scopedResourceForArticle(resource: Resource, article: ResourceArticle): Resource {
  return {
    ...resource,
    id: `${resource.id}--a${article.index}`,
    title: article.title,
    text: article.text,
    wordCount: article.wordCount,
    segments: article.segments.length > 0 ? article.segments : segmentsFromText(article.text),
    source: `${resource.title} · ${article.title}`,
    metadata: {
      ...resource.metadata,
      parentResourceId: resource.id,
      articleIndex: article.index,
      articleTitle: article.title,
    },
  }
}
