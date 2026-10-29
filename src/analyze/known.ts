const SUFFIXES = ['ing', 'ed', 'es', 's', 'ly', 'ment', 'ness', 'er', 'est']

function candidates(token: string): string[] {
  const values = [token]
  for (const suffix of SUFFIXES) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      values.push(token.slice(0, -suffix.length))
    }
  }
  return values
}

/** Rough per-article known-word ratio used to tune the automatic item count. */
export function knownRatioInText(text: string, knownLemmas: string[]): number {
  if (knownLemmas.length === 0) return 0
  const known = new Set(knownLemmas.map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))
  const tokens = text.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []
  if (tokens.length === 0) return 0
  let hits = 0
  for (const token of tokens) {
    if (candidates(token).some((candidate) => known.has(candidate))) hits += 1
  }
  return hits / tokens.length
}

/** Keep the exclusion block short enough for the extraction prompt. */
export function promptKnownLemmas(knownLemmas: string[], limit = 160): string[] {
  return [...new Set(knownLemmas.map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))].slice(0, limit)
}
