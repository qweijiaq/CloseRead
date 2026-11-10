import { loadPack } from '../pack/mutate.js'
import { loadReadingProgress } from '../reading/progress.js'
import type { Store } from '../store/store.js'

export interface WeeklyMissed {
  id: string
  lemma: string
  definition: string
  misses: number
}

export interface WeeklyPayload {
  range: { start: string; end: string; days: number }
  level?: string
  articles: { finished: number; titles: string[]; words: number }
  reviews: {
    total: number
    correct: number
    accuracy: number
    firstTotal: number
    firstCorrect: number
    firstAccuracy: number
  }
  newItems: number
  outputs: { count: number; latest?: { text: string; date: string } }
  studyDays: number
  missed: WeeklyMissed[]
  due: number
  backlog: number
  goals: { articles: number; studyDays: number }
  suggestion: string
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function ratio(correct: number, total: number): number {
  return total > 0 ? correct / total : 0
}

/** Aggregate the last seven local days for the weekly review page. */
export async function weeklyPayload(store: Store, now: Date = new Date()): Promise<WeeklyPayload> {
  const start = new Date(now)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  const startIso = start.toISOString()
  const startKey = localDayKey(start)
  const days = new Set<string>()

  const logs = store.logsSince(startIso)
  const correct = logs.filter((log) => log.rating >= 3).length
  const firstByItem = new Map<string, number>()
  for (const log of logs) {
    if (!firstByItem.has(log.itemId)) firstByItem.set(log.itemId, log.rating)
    days.add(localDayKey(new Date(log.reviewedAt)))
  }
  const firstValues = [...firstByItem.values()]
  const firstCorrect = firstValues.filter((rating) => rating >= 3).length

  const misses = new Map<string, number>()
  for (const log of logs) {
    if (log.rating <= 2) misses.set(log.itemId, (misses.get(log.itemId) ?? 0) + 1)
  }
  const items = new Map(store.listItems().map((item) => [item.id, item]))
  const missed: WeeklyMissed[] = [...misses.entries()]
    .map(([id, count]) => {
      const item = items.get(id)
      if (!item) return null
      return {
        id,
        lemma: item.lemma,
        definition: item.definitionZh || item.definition,
        misses: count,
      }
    })
    .filter((entry): entry is WeeklyMissed => entry !== null)
    .sort((a, b) => b.misses - a.misses || a.lemma.localeCompare(b.lemma))
    .slice(0, 8)

  const finished: Array<{ title: string; words: number; finishedAt: string }> = []
  for (const pack of store.packs()) {
    const progress = await loadReadingProgress(pack.dir, pack.id, 0)
    const touched = progress.readParagraphs.length > 0 || Boolean(progress.startedAt) || Boolean(progress.finishedAt)
    if (touched && progress.updatedAt >= startIso) days.add(localDayKey(new Date(progress.updatedAt)))
    if (!progress.finishedAt || progress.finishedAt < startIso) continue
    let words = 0
    try {
      words = (await loadPack(pack.dir)).stats.wordCount
    } catch {
      // A missing pack still counts by title, just without its word count.
    }
    finished.push({
      title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
      words,
      finishedAt: progress.finishedAt,
    })
  }
  for (const article of finished) days.add(localDayKey(new Date(article.finishedAt)))

  const outputs = store.listOutputs(500, now).filter((entry) => entry.date >= startKey)
  for (const output of outputs) days.add(output.date)
  const latest = outputs[0]

  const newItems = store.listItems().filter((item) => item.createdAt >= startIso && item.staged !== true).length
  const stats = store.stats(now)
  const due = stats.reviewDue
  const backlog = stats.backlog
  const preferences = store.preferences()
  const level = preferences.diagnosis?.level

  let suggestion: string
  if (missed.length > 0) {
    suggestion = `下周先复盘 ${missed
      .slice(0, 3)
      .map((entry) => entry.lemma)
      .join('、')}，再读一篇新文章，把旧词放回语境。`
  } else if (due > 0) {
    suggestion = `下周先清 ${due} 张到期卡、每天学 10 个新词，再读一篇新文章。`
  } else if (backlog > 0) {
    suggestion = `待学池还有 ${backlog} 个词；下周按每日 10 个的节奏释放，不要一次全部加入复习。`
  } else if (finished.length === 0) {
    suggestion = '下周先完成一篇精读，再写三句输出。'
  } else {
    suggestion = '保持节奏：每天一篇精读 + 10 张复习卡。'
  }

  return {
    range: { start: startKey, end: localDayKey(now), days: 7 },
    ...(level ? { level } : {}),
    articles: {
      finished: finished.length,
      titles: finished.slice(0, 5).map((entry) => entry.title),
      words: finished.reduce((sum, entry) => sum + entry.words, 0),
    },
    reviews: {
      total: logs.length,
      correct,
      accuracy: ratio(correct, logs.length),
      firstTotal: firstValues.length,
      firstCorrect,
      firstAccuracy: ratio(firstCorrect, firstValues.length),
    },
    newItems,
    outputs: {
      count: outputs.length,
      ...(latest ? { latest: { text: latest.text.slice(0, 180), date: latest.date } } : {}),
    },
    studyDays: days.size,
    missed,
    due,
    backlog,
    goals: {
      articles: preferences.weeklyArticleGoal,
      studyDays: preferences.weeklyStudyDaysGoal,
    },
    suggestion,
  }
}
