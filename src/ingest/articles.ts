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

/** Split older resources that have no stored chapter boundaries, using level-1 Markdown headings. */
export function splitResourceByHeadings(resource: Resource): ResourceArticle[] {
  const chunks: Array<{ title: string; lines: string[] }> = []
  let title = resource.title
  let lines: string[] = []

  const push = () => {
    const text = lines.join('\n').trim()
    if (text.replace(/\s/g, '').length >= 40) chunks.push({ title, lines: [...lines] })
  }

  for (const line of resource.text.split('\n')) {
    const heading = /^#\s+(.+)$/.exec(line)
    if (heading) {
      push()
      title = heading[1]!.trim() || resource.title
      lines = [line]
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
