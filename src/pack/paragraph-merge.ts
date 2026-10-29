/** Layout-aware paragraph repair for PDF/EPUB text with artificial line breaks. */

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

const DATE_PATTERN =
  /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/i
const CONTRAST_START = /^(?:Instead|But|Yet|However|Still|Rather|By contrast|Meanwhile|Even so|For now|In fact|After all)\b/i

function isHeadingLike(value: string): boolean {
  const text = value.trim()
  if (!text) return true
  if (/^#{1,6}\s/.test(text)) return true
  if (/^\d+[.)]\s/.test(text)) return true
  if (/^[-*•]\s/.test(text)) return true
  if (/^This article was downloaded\b/i.test(text)) return true
  if (/^https?:\/\//i.test(text)) return true
  if (words(text) <= 14 && /^[A-Z0-9][A-Z0-9\s&|:'’\-–—]+$/.test(text)) return true
  if (words(text) <= 10 && /\|/.test(text)) return true
  return false
}

function isShortTransition(value: string): boolean {
  const text = value.trim()
  if (!text || isHeadingLike(text) || DATE_PATTERN.test(text)) return false
  if (/^["“]/.test(text) || ATTRIBUTION.test(text)) return false
  return words(text) <= 28
}

const ATTRIBUTION =
  /\b(?:says|said|asks|asked|adds|added|notes|noted|explains|explained|writes|wrote|tells|told|according to)\b/i

/**
 * True when the next block is a layout fragment of the previous paragraph:
 * a short quote/attribution, a quote following a colon, a lower-case
 * continuation, or a line after an unfinished sentence.
 */
export function shouldMergeFragment(previous: string, current: string): boolean {
  const prev = previous.trim()
  const next = current.trim()
  if (!prev || !next || isHeadingLike(next)) return false
  if (DATE_PATTERN.test(prev) && words(prev) <= 60) return false
  const count = words(next)
  if (/[:：]\s*$/.test(prev)) return true
  if (/^["“]/.test(next) && (ATTRIBUTION.test(next) || count <= 30)) return true
  if (/^[a-z]/.test(next)) return true
  if (
    count <= 60 &&
    /(?:^|\s)(?:the|a|an|and|or|but|of|to|in|on|at|for|with|from|by|as|that|which|who|whose|where|when|if|because|although|while|than)\s*$/i.test(
      prev,
    )
  ) {
    return true
  }
  if (CONTRAST_START.test(next) && count <= 25) return true
  if (isShortTransition(prev) && !isHeadingLike(next) && words(next) >= 8 && !DATE_PATTERN.test(next)) {
    return true
  }
  return false
}

function key(value: string): string {
  return value.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Join layout fragments before the reading model sees the source. */
export function normalizeSourceParagraphs(text: string, title?: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const titleKey = title ? key(title) : ''
  const isHeaderBlock = (block: string): boolean => {
    if (!titleKey) return false
    const normalized = key(block)
    if (normalized === titleKey || (normalized.startsWith(titleKey) && words(block) <= 40)) return true
    return DATE_PATTERN.test(block) && words(block) <= 60
  }
  const paragraphs: string[] = []
  let previousIsHeader = false
  for (const block of blocks) {
    const header = isHeaderBlock(block)
    const previous = paragraphs[paragraphs.length - 1]
    if (previous && !header && !previousIsHeader && shouldMergeFragment(previous, block)) {
      paragraphs[paragraphs.length - 1] = `${previous} ${block}`
    } else {
      paragraphs.push(block)
      previousIsHeader = header
    }
  }
  return paragraphs.join('\n\n')
}
