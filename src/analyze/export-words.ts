import { z } from 'zod'

import { hasLlm } from '../config.js'
import type { LearningItem, LearningPack } from '../types.js'
import { chatJson } from './chat.js'

const exportWordsSchema = z.object({
  indices: z.array(z.number().int().min(0)),
})

const SYSTEM = `You are choosing which vocabulary cards to keep in a shareable intensive-reading export.
You receive the pack title, its words/phrases, and a target count. Choose the most useful items for a Chinese learner who wants to read this article closely.
Prioritise:
- collocations, idioms and phrases that carry meaning in context;
- words used in an unusual or easy-to-miss sense;
- high-frequency academic, political, business or opinion vocabulary;
- words whose meaning is not obvious from the Chinese translation.
Deprioritise near-duplicates, very easy words, and cards with little context.
Return exactly the requested number of unique indices, in any order. Return JSON only:
{"indices":[0,3,5]}`

function wordItems(pack: LearningPack): LearningItem[] {
  return pack.items.filter((item) => item.type !== 'sentence')
}

/**
 * Deterministic fallback: core cards first, then cards with more contexts, then
 * original pack order. Used when the LLM is unavailable or returns a bad plan.
 */
export function rankExportWords(pack: LearningPack, limit: number): LearningItem[] {
  const words = wordItems(pack)
  if (limit >= words.length) return words
  return [...words]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const tier = Number(b.item.tier === 'core') - Number(a.item.tier === 'core')
      if (tier !== 0) return tier
      const contexts = (b.item.contexts?.length ?? 0) - (a.item.contexts?.length ?? 0)
      if (contexts !== 0) return contexts
      return a.index - b.index
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item)
}

export async function selectExportWords(pack: LearningPack, limit: number): Promise<LearningItem[]> {
  const words = wordItems(pack)
  const count = Math.max(0, Math.min(words.length, Math.floor(limit)))
  if (count >= words.length) return words
  if (count === 0) return []
  const fallback = rankExportWords(pack, count)
  if (!hasLlm()) return fallback
  try {
    const listing = words
      .map((item, index) => {
        const context = item.contexts?.[0]?.sentence?.replace(/\s+/g, ' ').trim() ?? ''
        return `${index}. ${item.lemma} | ${item.sense} | ${item.definitionZh ?? ''}${
          context ? ` | context: ${context.slice(0, 140)}` : ''
        }`
      })
      .join('\n')
    const result = await chatJson(
      exportWordsSchema,
      SYSTEM,
      `Pack: ${pack.title}\nChoose ${count} words/phrases.\n\n${listing}\n\nReturn JSON only.`,
      { maxTokens: 800 },
    )
    const indices = [...new Set(result.indices)].filter((index) => index >= 0 && index < words.length)
    if (indices.length !== count) return fallback
    return indices.map((index) => words[index]!)
  } catch {
    return fallback
  }
}

/** Keep only selected word cards and all sentence cards for an export copy. */
export function filterPackForExport(pack: LearningPack, selectedWords: LearningItem[]): LearningPack {
  const selectedIds = new Set(selectedWords.map((item) => item.id))
  const keep = new Set(selectedIds)
  for (const item of pack.items) if (item.type === 'sentence') keep.add(item.id)
  const frontMatter = pack.frontMatter
    ? { ...pack.frontMatter, itemIds: pack.frontMatter.itemIds.filter((id) => selectedIds.has(id)) }
    : undefined
  const items = pack.items.filter((item) => keep.has(item.id))
  return {
    ...pack,
    items,
    stats: { ...pack.stats, itemCount: items.length },
    ...(frontMatter ? { frontMatter } : {}),
  }
}
