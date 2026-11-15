import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import { hasLlm } from '../config.js'
import type { StoredItem } from '../types.js'
import type { Store } from '../store/store.js'
import { isDue, isNew } from './scheduler.js'

export interface DailyWordSelection {
  ids: string[]
  theme: string
  reason: string
  source: 'cached' | 'ai' | 'heuristic'
}

const selectionSchema = z.object({
  theme: z.string().min(1).max(40),
  reason: z.string().min(1).max(240),
  ids: z.array(z.string()).min(1),
})

function candidateLine(item: StoredItem): string {
  const context = item.contexts[0]?.sentence.replace(/\s+/g, ' ').trim().slice(0, 160) ?? ''
  return [
    `id=${item.id}`,
    `word=${item.lemma}`,
    item.pos ? `pos=${item.pos}` : '',
    item.cefr ? `cefr=${item.cefr}` : '',
    item.definitionZh || item.sense ? `meaning=${item.definitionZh || item.sense}` : '',
    item.sourceRef ? `source=${item.sourceRef}` : '',
    context ? `context=${context}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
}

function themeLabel(sourceRef: string): string {
  const book = /(CET-4|CET-6|TOEFL|IELTS)/i.exec(sourceRef)
  if (book) return `${book[1]!.toUpperCase()} 词书`
  const clean = sourceRef.split(/\s*·\s*/)[0]?.trim() || sourceRef.trim()
  return clean.slice(0, 30) || '今日词组'
}

function heuristicSelection(pool: StoredItem[], count: number): DailyWordSelection {
  const groups = new Map<string, StoredItem[]>()
  for (const item of pool) {
    const key = item.sourceRef?.trim() || item.cefr?.trim() || '今日词组'
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  const ranked = [...groups.entries()]
    .map(([theme, items]) => ({ theme, items }))
    .sort((a, b) => b.items.length - a.items.length)
  const chosenGroup = ranked[0]
  const chosen = (chosenGroup?.items ?? pool).slice(0, count)
  const remain = pool.filter((item) => !chosen.includes(item)).slice(0, Math.max(0, count - chosen.length))
  return {
    ids: [...chosen, ...remain].map((item) => item.id),
    theme: chosenGroup ? themeLabel(chosenGroup.theme) : '今日词组',
    reason: chosenGroup && chosenGroup.items.length > 1
      ? '这些词来自同一来源，放在一起复习更容易建立联系。'
      : '从今天到期和新词里选出一组，先保持稳定节奏。',
    source: 'heuristic',
  }
}

/**
 * Pick a small, thematically related set of due/new words for today's session.
 * A cached selection is reused until the local day changes or `force` is set.
 */
export async function selectDailyWords(
  store: Store,
  count: number,
  options: { force?: boolean; useLlm?: boolean } = {},
): Promise<DailyWordSelection> {
  const now = new Date()
  const wanted = Math.max(1, Math.min(100, Math.round(count)))
  if (!options.force) {
    const cached = store.dailyWordSelection(now)
    if (cached?.ids.length && cached.ids.length >= wanted) return { ...cached, source: 'cached' }
  }

  const items = store.listItems().filter((item) => item.type !== 'sentence' && item.status === 'active')
  const due = items.filter((item) => !isNew(item.review) && isDue(item.review, now))
  const fresh = items.filter((item) => isNew(item.review) && item.staged !== true)
  due.sort((a, b) => a.review.due.localeCompare(b.review.due))
  fresh.sort((a, b) => (b.introducedAt ?? '').localeCompare(a.introducedAt ?? '') || a.createdAt.localeCompare(b.createdAt))
  const pool = [...due, ...fresh].slice(0, 90)
  if (pool.length === 0) throw new Error('词库里还没有可背的单词。')

  if (options.useLlm ?? hasLlm()) {
    try {
      const result = await chatJson(
        selectionSchema,
        'You choose a small daily vocabulary set for a Chinese learner of English. Pick words that are meaningfully related: same topic, situation, semantic field, or useful together in one conversation. Prefer due words when they fit the theme. Use only ids from the candidate list. Return concise Chinese for theme and reason.',
        JSON.stringify({
          count: wanted,
          candidates: pool.map((item) => candidateLine(item)),
        }),
      )
      const allowed = new Set(pool.map((item) => item.id))
      const ids = [...new Set(result.ids)].filter((id) => allowed.has(id)).slice(0, wanted)
      if (ids.length > 0) {
        const selection = {
          ids,
          theme: result.theme.trim().slice(0, 40),
          reason: result.reason.trim().slice(0, 240),
          source: 'ai' as const,
        }
        await store.saveDailyWordSelection({ ...selection, source: 'ai' }, now)
        return selection
      }
    } catch {
      // Fall back to a local grouping instead of blocking the review session.
    }
  }

  const selection = heuristicSelection(pool, wanted)
  await store.saveDailyWordSelection({ ...selection, source: 'heuristic' }, now)
  return selection
}
