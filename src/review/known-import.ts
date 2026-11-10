function cleanWord(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/^\s*(?:\d+[.)、]\s*|[-*•]\s*)/, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Accept a plain word list, one-per-line, or a CSV/TSV export.
 * CSV rows use the first cell; a single comma-separated line is split into words.
 */
export function parseKnownWords(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const values: string[] = []
  if (lines.length === 1 && /[,;，；\t]/.test(lines[0]!)) {
    values.push(...lines[0]!.split(/[,;，；\t]/))
  } else {
    for (const line of lines) {
      const first = line.split(/[,;\t，；]/)[0] ?? ''
      values.push(first)
    }
  }
  return [...new Set(values.map(cleanWord).filter((word) => word.length > 0 && word.length <= 80))].slice(0, 5000)
}
