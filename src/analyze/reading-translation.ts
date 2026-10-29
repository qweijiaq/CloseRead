import { z } from 'zod'

import { hasLlm } from '../config.js'
import type { ReadingParagraph } from '../types.js'
import { chatJson } from './chat.js'
import { translateMany } from './translate.js'

const translationSchema = z.object({
  translations: z.array(
    z.object({
      index: z.number().int().min(0),
      translation: z.string().min(1),
    }),
  ),
})

export function missingTranslationIndexes(reading: ReadingParagraph[]): number[] {
  return reading
    .filter((paragraph) => !paragraph.translation?.trim())
    .map((paragraph) => paragraph.index)
}

/** Apply translations by paragraph index. Returns how many were filled. */
export function applyReadingTranslations(
  reading: ReadingParagraph[],
  translations: Map<number, string>,
): number {
  let filled = 0
  for (const paragraph of reading) {
    if (paragraph.translation?.trim()) continue
    const value = translations.get(paragraph.index)?.trim()
    if (!value) continue
    paragraph.translation = value
    filled += 1
  }
  return filled
}

export interface ReadingTranslationResult {
  filled: number
  remaining: number[]
  source: 'none' | 'llm' | 'free' | 'mixed'
}

/**
 * A reading pass can fall back to raw segments when the LLM call fails; those
 * segments have no translations. Fill them before a pack is written, so a
 * broken article is never silently presented as a finished intensive reading.
 */
export async function ensureReadingTranslations(
  reading: ReadingParagraph[],
  options: { signal?: AbortSignal } = {},
): Promise<ReadingTranslationResult> {
  const missing = reading.filter((paragraph) => !paragraph.translation?.trim())
  if (missing.length === 0) return { filled: 0, remaining: [], source: 'none' }

  let filled = 0
  let usedLlm = false
  if (hasLlm()) {
    for (let offset = 0; offset < missing.length; offset += 10) {
      const batch = missing.slice(offset, offset + 10)
      const listing = batch
        .map((paragraph) => `${paragraph.index}. ${paragraph.original.replace(/\s+/g, ' ').trim()}`)
        .join('\n\n')
      try {
        const result = await chatJson(
          translationSchema,
          'You translate English article paragraphs into natural, accurate Chinese for a learner. Return JSON only.',
          `Translate every paragraph below. Keep the original index exactly. Do not merge or split paragraphs. Return JSON:
{"translations":[{"index":0,"translation":"..."}]}

${listing}`,
          { maxTokens: 5000, signal: options.signal },
        )
        const map = new Map(
          result.translations.map((entry) => [entry.index, entry.translation.trim()] as const),
        )
        filled += applyReadingTranslations(batch, map)
        usedLlm = true
      } catch {
        // The free translation pass below is the last resort.
      }
    }
  }

  const stillMissing = reading.filter((paragraph) => !paragraph.translation?.trim())
  if (stillMissing.length > 0) {
    const translated = await translateMany(stillMissing.map((paragraph) => paragraph.original))
    const map = new Map<number, string>()
    for (const paragraph of stillMissing) {
      const value = translated.get(paragraph.original.replace(/\s+/g, ' ').trim())
      if (value) map.set(paragraph.index, value)
    }
    filled += applyReadingTranslations(stillMissing, map)
  }

  const remaining = missingTranslationIndexes(reading)
  return {
    filled,
    remaining,
    source: filled === 0 ? 'none' : usedLlm ? (remaining.length ? 'mixed' : 'llm') : 'free',
  }
}
