import fs from 'node:fs/promises'
import path from 'node:path'

export interface ReadingProgress {
  packId: string
  totalParagraphs: number
  readParagraphs: number[]
  lastParagraph: number
  /** Zero-based index into the flattened sentence list of the pack. */
  lastSentence?: number
  startedAt?: string
  updatedAt: string
  finishedAt?: string
}

function progressFile(packDir: string): string {
  return path.join(packDir, 'reading.json')
}

function cleanIndices(values: unknown, total: number): number[] {
  if (!Array.isArray(values)) return []
  const indices = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && (total <= 0 || value < total))
  return [...new Set(indices)].sort((a, b) => a - b)
}

function emptyProgress(packId: string, totalParagraphs: number): ReadingProgress {
  return {
    packId,
    totalParagraphs: Math.max(0, totalParagraphs),
    readParagraphs: [],
    lastParagraph: 0,
    updatedAt: new Date().toISOString(),
  }
}

export async function loadReadingProgress(
  packDir: string,
  packId: string,
  totalParagraphs: number,
): Promise<ReadingProgress> {
  const fallback = emptyProgress(packId, totalParagraphs)
  try {
    const raw = JSON.parse(await fs.readFile(progressFile(packDir), 'utf8')) as Partial<ReadingProgress>
    const total =
      totalParagraphs > 0
        ? totalParagraphs
        : typeof raw.totalParagraphs === 'number' && raw.totalParagraphs > 0
          ? raw.totalParagraphs
          : fallback.totalParagraphs
    const last =
      typeof raw.lastParagraph === 'number' && Number.isFinite(raw.lastParagraph)
        ? Math.max(0, Math.min(Math.max(0, total - 1), Math.floor(raw.lastParagraph)))
        : 0
    return {
      packId,
      totalParagraphs: total,
      readParagraphs: cleanIndices(raw.readParagraphs, total),
      lastParagraph: last,
      ...(typeof raw.lastSentence === 'number' && Number.isFinite(raw.lastSentence)
        ? { lastSentence: Math.max(0, Math.floor(raw.lastSentence)) }
        : {}),
      ...(typeof raw.startedAt === 'string' ? { startedAt: raw.startedAt } : {}),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
      ...(typeof raw.finishedAt === 'string' ? { finishedAt: raw.finishedAt } : {}),
    }
  } catch {
    return fallback
  }
}

export async function saveReadingProgress(packDir: string, progress: ReadingProgress): Promise<void> {
  await fs.mkdir(packDir, { recursive: true })
  const temp = `${progressFile(packDir)}.tmp`
  const payload: ReadingProgress = {
    ...progress,
    totalParagraphs: Math.max(0, progress.totalParagraphs),
    readParagraphs: cleanIndices(progress.readParagraphs, progress.totalParagraphs),
    lastParagraph: Math.max(
      0,
      Math.min(
        Math.max(0, progress.totalParagraphs - 1),
        Math.floor(progress.lastParagraph || 0),
      ),
    ),
    ...(typeof progress.lastSentence === 'number' && Number.isFinite(progress.lastSentence)
      ? { lastSentence: Math.max(0, Math.floor(progress.lastSentence)) }
      : {}),
    updatedAt: new Date().toISOString(),
  }
  await fs.writeFile(temp, JSON.stringify(payload, null, 2), 'utf8')
  await fs.rename(temp, progressFile(packDir))
}

export function readingPercent(progress: ReadingProgress): number {
  if (progress.finishedAt) return 100
  if (progress.totalParagraphs <= 0) return 0
  return Math.min(99, Math.round((progress.readParagraphs.length / progress.totalParagraphs) * 100))
}

/** Clear progress so the learner can read the article again. */
export async function resetReadingProgress(
  packDir: string,
  packId: string,
  totalParagraphs: number,
): Promise<ReadingProgress> {
  const progress: ReadingProgress = {
    packId,
    totalParagraphs,
    readParagraphs: [],
    lastParagraph: 0,
    lastSentence: 0,
    updatedAt: new Date().toISOString(),
  }
  await saveReadingProgress(packDir, progress)
  return progress
}

export function readingSummary(progress: ReadingProgress) {
  return {
    packId: progress.packId,
    read: progress.readParagraphs.length,
    readParagraphs: progress.readParagraphs,
    total: progress.totalParagraphs,
    lastParagraph: progress.lastParagraph,
    lastSentence: progress.lastSentence ?? 0,
    startedAt: progress.startedAt ?? null,
    finishedAt: progress.finishedAt ?? null,
    updatedAt: progress.updatedAt,
    percent: readingPercent(progress),
    finished: Boolean(progress.finishedAt),
  }
}
