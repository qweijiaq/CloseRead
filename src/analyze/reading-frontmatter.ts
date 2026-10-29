import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'
import type { LearningPack, PackFrontMatter } from '../types.js'

const frontMatterSchema = z.object({
  titleZh: z.string().nullable().optional(),
  titleNote: z.string().nullable().optional(),
  summaryZh: z.string().nullable().optional(),
  lead: z.string().nullable().optional(),
  leadZh: z.string().nullable().optional(),
  leadNote: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
})

const SYSTEM = `You are preparing the article head for a Chinese learner's intensive reading page.
Given the article title, summary and source text, return:
- titleZh: natural Chinese translation of the title
- titleNote: one concise Chinese note on the title's wording, image, or stance
- summaryZh: natural Chinese translation of the provided summary, kept to 2-3 sentences
- lead: the standfirst/deck printed directly under the headline in the source, or "" if there is none.
  A standfirst is a short subtitle/rubric, not the first sentence of the body. Never take a body sentence.
- leadZh: natural Chinese translation of lead ("" if no lead)
- leadNote: one concise Chinese note on the lead's structure or rhetorical job ("" if no lead)
- section: the magazine section/column if evident, otherwise ""
Rules: never invent a lead. If the input provides a standfirst, copy it exactly; if it says none, return "". Keep Chinese natural and learner-friendly. Return JSON only:
{"titleZh":"...","titleNote":"...","summaryZh":"...","lead":"...","leadZh":"...","leadNote":"...","section":"..."}`

const DATE_PATTERN = /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/i

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Quote-insensitive comparison while keeping character offsets stable. */
function canonical(value: string): string {
  return value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
}

/**
 * The publication's standfirst is the short deck between the headline and the
 * date. If there is no dated header, do not guess: a body sentence must never
 * be promoted to a lead.
 */
export function extractStandfirst(sourceText: string, title: string): string | undefined {
  const source = canonical(sourceText)
  const articleTitle = canonical(title)
  const titleIndex = source.indexOf(articleTitle)
  if (titleIndex < 0) return undefined
  const afterStart = titleIndex + articleTitle.length
  const afterTitle = source.slice(afterStart, afterStart + 900)
  const date = DATE_PATTERN.exec(afterTitle)
  if (!date) return undefined
  const deck = normalize(sourceText.slice(afterStart, afterStart + date.index)).replace(/^[-–—:·|]\s*/, '')
  if (deck.length < 8 || deck.length > 240) return undefined
  if (deck.split(/\s+/).length > 30) return undefined
  if (!/[A-Za-z]{3}/.test(deck)) return undefined
  if (canonical(deck).toLowerCase() === articleTitle.toLowerCase()) return undefined
  return deck
}

/**
 * A stored lead that is actually the opening body sentence: it sits after the
 * publication date and is absent from the reading paragraphs.
 */
export function detectBodyLead(pack: LearningPack): string | undefined {
  const lead = normalize(pack.frontMatter?.lead ?? '')
  if (!lead) return undefined
  const source = canonical(pack.sourceText ?? '')
  if (!source) return undefined
  const needle = canonical(lead)
  const index = source.indexOf(needle)
  if (index < 0) return undefined
  const alreadyInReading = (pack.reading ?? []).some((paragraph) =>
    canonical(paragraph.original).toLowerCase().includes(needle.toLowerCase()),
  )
  if (alreadyInReading) return undefined
  const before = source.slice(Math.max(0, index - 140), index)
  if (DATE_PATTERN.test(before)) return lead
  const standfirst = extractStandfirst(pack.sourceText!, pack.title)
  if (standfirst && canonical(standfirst).toLowerCase() !== needle.toLowerCase()) {
    const standfirstIndex = source.toLowerCase().indexOf(canonical(standfirst).toLowerCase())
    if (standfirstIndex >= 0 && index > standfirstIndex) return lead
  }
  return undefined
}

/**
 * The PDF/EPUB header often glues the date and the first body sentence onto the
 * same line. Split after the date so the reading pass cannot skip the opening
 * sentence as part of the heading.
 */
export function splitDatedBody(sourceText: string, title: string): string {
  const source = canonical(sourceText)
  const articleTitle = canonical(title)
  const titleIndex = source.indexOf(articleTitle)
  if (titleIndex < 0) return sourceText
  const head = source.slice(0, 1600)
  const date = DATE_PATTERN.exec(head)
  if (!date || date.index < titleIndex) return sourceText
  const after = date.index + date[0].length
  const lineEnd = source.indexOf('\n', after)
  const end = lineEnd === -1 ? source.length : lineEnd
  const trailing = sourceText.slice(after, end).trim()
  if (trailing.length < 12 || !/[A-Za-z]{3}/.test(trailing)) return sourceText
  const rest = sourceText.slice(end)
  const nextStart = rest.search(/\S/)
  const restFromNext = nextStart >= 0 ? rest.slice(nextStart) : ''
  const nextBreak = restFromNext.indexOf('\n\n')
  const nextParagraph = (nextBreak >= 0 ? restFromNext.slice(0, nextBreak) : restFromNext).trim()
  // The extractor often leaves the first body sentence on the header line and
  // the rest of that paragraph after a blank line; rejoin them when the next
  // block is clearly prose (not a short heading).
  const looksLikeProse =
    nextParagraph.split(/\s+/).length >= 8 &&
    /^[A-Z"“']/.test(nextParagraph) &&
    !/^(?:#{1,6}\s|\d+[.)]\s|[-*•]\s)/.test(nextParagraph)
  if (looksLikeProse) {
    const consumed = end + nextStart + nextParagraph.length
    return `${sourceText.slice(0, after)}\n\n${trailing} ${nextParagraph}${sourceText.slice(consumed)}`
  }
  return `${sourceText.slice(0, after)}\n\n${trailing}${rest}`
}

export async function generateFrontMatter(
  pack: LearningPack,
  signal?: AbortSignal,
): Promise<PackFrontMatter | undefined> {
  if (!hasLlm()) throw new Error('生成标题和导语翻译需要配置 LLM。')
  const source = normalize(
    pack.sourceText ??
      (pack.reading ?? [])
        .slice(0, 4)
        .map((paragraph) => paragraph.original)
        .join(' '),
  )
  if (!source) return undefined
  const standfirst = extractStandfirst(
    pack.sourceText ??
      (pack.reading ?? [])
        .slice(0, 4)
        .map((paragraph) => paragraph.original)
        .join('\n\n'),
    pack.title,
  )
  const result = await chatJson(
    frontMatterSchema,
    SYSTEM,
    `Article title: ${pack.title}
Summary: ${pack.summary}
Standfirst: ${standfirst ?? '(none found in the source header)'}

Source head:
"""
${source.slice(0, 6000)}
"""

Return JSON only.`,
    { maxTokens: 1200, signal },
  )
  const duplicateInReading =
    standfirst &&
    (pack.reading ?? []).some((paragraph) =>
      normalize(paragraph.original).toLowerCase().includes(standfirst.toLowerCase()),
    )
  const groundedLead =
    standfirst && !duplicateInReading && source.toLowerCase().includes(standfirst.toLowerCase())
      ? standfirst
      : ''
  const aiLeadMatches =
    Boolean(groundedLead) &&
    canonical(normalize(result.lead ?? '')).toLowerCase() === canonical(groundedLead).toLowerCase()
  return {
    title: pack.title,
    itemIds: pack.frontMatter?.itemIds ?? [],
    ...(result.titleZh?.trim() ? { titleZh: normalize(result.titleZh) } : {}),
    ...(result.titleNote?.trim() ? { titleNote: normalize(result.titleNote) } : {}),
    ...(result.summaryZh?.trim() ? { summaryZh: normalize(result.summaryZh) } : {}),
    ...(groundedLead ? { lead: groundedLead } : {}),
    ...(groundedLead && aiLeadMatches && result.leadZh?.trim() ? { leadZh: normalize(result.leadZh) } : {}),
    ...(groundedLead && aiLeadMatches && result.leadNote?.trim() ? { leadNote: normalize(result.leadNote) } : {}),
    ...(result.section?.trim() ? { section: normalize(result.section) } : {}),
  }
}
