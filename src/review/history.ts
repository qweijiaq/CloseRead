import type { Store } from '../store/store.js'

export interface ReviewHistoryDay {
  date: string
  reviews: number
  correct: number
  unique: number
  retention: number
}

export interface ReviewHistoryGroup {
  label: string
  reviews: number
  correct: number
  retention: number
}

export interface ReviewHistory {
  range: { start: string; end: string; days: number }
  totals: { reviews: number; correct: number; retention: number; unique: number; activeDays: number }
  days: ReviewHistoryDay[]
  sources: ReviewHistoryGroup[]
  cefr: ReviewHistoryGroup[]
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function ratio(correct: number, total: number): number {
  return total > 0 ? correct / total : 0
}

function groupStats(
  logs: Array<{ itemId: string; rating: number }>,
  items: Map<string, { sourceRef: string; cefr?: string }>,
  key: 'source' | 'cefr',
): ReviewHistoryGroup[] {
  const groups = new Map<string, { reviews: number; correct: number }>()
  for (const log of logs) {
    const item = items.get(log.itemId)
    if (!item) continue
    const label = key === 'source' ? item.sourceRef : item.cefr
    if (!label) continue
    const entry = groups.get(label) ?? { reviews: 0, correct: 0 }
    entry.reviews += 1
    if (log.rating >= 3) entry.correct += 1
    groups.set(label, entry)
  }
  return [...groups.entries()]
    .map(([label, value]) => ({
      label,
      reviews: value.reviews,
      correct: value.correct,
      retention: ratio(value.correct, value.reviews),
    }))
    .filter((entry) => entry.reviews >= 2)
    .sort((a, b) => b.reviews - a.reviews || a.label.localeCompare(b.label))
    .slice(0, 8)
}

/** Aggregate the review log into a short daily trend and source/CEFR accuracy groups. */
export function reviewHistory(store: Store, requestedDays = 14, now: Date = new Date()): ReviewHistory {
  const days = Math.max(1, Math.min(60, Math.round(requestedDays)))
  const buckets = new Map<string, { reviews: number; correct: number; unique: Set<string> }>()
  const dayKeys: string[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - offset)
    date.setHours(0, 0, 0, 0)
    const key = localDayKey(date)
    dayKeys.push(key)
    buckets.set(key, { reviews: 0, correct: 0, unique: new Set() })
  }

  const start = new Date(now)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  const logs = store.logsSince(start.toISOString())
  const items = new Map(store.listItems().map((item) => [item.id, item]))
  const overallUnique = new Set<string>()
  for (const log of logs) {
    const key = localDayKey(new Date(log.reviewedAt))
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.reviews += 1
    bucket.unique.add(log.itemId)
    overallUnique.add(log.itemId)
    if (log.rating >= 3) bucket.correct += 1
  }

  const daily = dayKeys.map((date) => {
    const bucket = buckets.get(date)!
    return {
      date,
      reviews: bucket.reviews,
      correct: bucket.correct,
      unique: bucket.unique.size,
      retention: ratio(bucket.correct, bucket.reviews),
    }
  })
  const correct = logs.filter((log) => log.rating >= 3).length
  return {
    range: { start: dayKeys[0]!, end: dayKeys[dayKeys.length - 1]!, days },
    totals: {
      reviews: logs.length,
      correct,
      retention: ratio(correct, logs.length),
      unique: overallUnique.size,
      activeDays: daily.filter((day) => day.reviews > 0).length,
    },
    days: daily,
    sources: groupStats(logs, items, 'source'),
    cefr: groupStats(logs, items, 'cefr'),
  }
}
