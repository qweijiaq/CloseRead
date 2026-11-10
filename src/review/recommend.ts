import { loadPack } from '../pack/mutate.js'
import { loadReadingProgress } from '../reading/progress.js'
import type { Store } from '../store/store.js'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface Recommendation {
  id: string
  title: string
  titleZh?: string
  cefr: string
  wordCount: number
  readingMinutes: number
  reason: string
  url: string
  started: boolean
  finished: boolean
}

function levelIndex(value: string | undefined): number {
  const index = LEVELS.indexOf((value ?? '').toUpperCase())
  return index >= 0 ? index : 3
}

function reasonFor(delta: number, lengthRatio: number, started: boolean, finished: boolean, sameBook: boolean): string {
  if (finished) return '读过一遍，可以重读巩固'
  if (started) return '你已经读过开头，接着读完'
  if (sameBook) return '同一本书的下一篇'
  if (delta === 0 && lengthRatio <= 0.35) return '难度和长度都接近'
  if (delta > 0) return '难度略高，适合进阶'
  if (delta < 0) return '比当前这篇轻松一些'
  return '难度接近，篇幅不同'
}

/** Rank unread or in-progress packs near the current article's difficulty and length. */
export async function recommendNext(store: Store, currentId: string, limit = 3): Promise<Recommendation[]> {
  const records = store.packs()
  const currentRecord = records.find((record) => record.id === currentId)
  if (!currentRecord) return []

  let current
  try {
    current = await loadPack(currentRecord.dir)
  } catch {
    return []
  }
  const currentLevel = levelIndex(current.difficulty.cefr)
  const currentWords = Math.max(1, current.stats.wordCount)

  const candidates = await Promise.all(
    records
      .filter((record) => record.id !== currentId)
      .map(async (record): Promise<(Recommendation & { score: number }) | null> => {
        try {
          const pack = await loadPack(record.dir)
          const progress = await loadReadingProgress(record.dir, record.id, pack.reading?.length ?? 0)
          const finished = Boolean(progress.finishedAt)
          const started = !finished && (progress.readParagraphs.length > 0 || Boolean(progress.startedAt))
          const level = levelIndex(pack.difficulty.cefr)
          const delta = level - currentLevel
          const words = Math.max(1, pack.stats.wordCount)
          const lengthRatio = Math.abs(Math.log((words + 40) / (currentWords + 40)))
          const sameBook = record.resourceId === currentRecord.resourceId
          const score =
            (finished ? -30 : started ? 10 : 4) +
            (sameBook ? 4 : 0) -
            Math.abs(delta) * 16 -
            Math.min(24, lengthRatio * 18)
          return {
            score,
            id: record.id,
            title: pack.frontMatter?.title ?? pack.title ?? record.title ?? record.id,
            ...(pack.frontMatter?.titleZh ? { titleZh: pack.frontMatter.titleZh } : {}),
            cefr: pack.difficulty.cefr,
            wordCount: pack.stats.wordCount,
            readingMinutes: pack.stats.readingMinutes,
            reason: reasonFor(delta, lengthRatio, started, finished, sameBook),
            url: `/read/${encodeURIComponent(record.id)}`,
            started,
            finished,
          }
        } catch {
          return null
        }
      }),
  )

  return candidates
    .filter((entry): entry is Recommendation & { score: number } => entry !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, limit))
    .map(({ score: _score, ...entry }) => entry)
}
