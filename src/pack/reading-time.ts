import type { LearningPack } from '../types.js'

export interface ReadingTimeInput {
  wordCount: number
  paragraphs?: number
  items?: number
}

/**
 * Intensive reading is much slower than skimming: it includes re-reading,
 * dictionary checks, sentence analysis and the generated notes/cards.
 */
export function intensiveReadingMinutes(input: ReadingTimeInput): number {
  const words = Math.max(0, input.wordCount)
  const paragraphs = Math.max(0, input.paragraphs ?? 0)
  const items = Math.max(0, input.items ?? 0)
  const minutes = words / 70 + paragraphs * 0.5 + items * 0.4 + 2
  return Math.max(3, Math.round(minutes))
}

export function packReadingMinutes(pack: LearningPack): number {
  return intensiveReadingMinutes({
    wordCount: pack.stats.wordCount,
    paragraphs: pack.reading?.length ?? 0,
    items: pack.items.length,
  })
}
