import type { LearningPack } from '../types.js'

export interface StudyPoint {
  label: string
  detail?: string
}

function compact(value: string, max = 90): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * The "学习要点" preview is derived from the same cards the reader will meet,
 * so it stays consistent with the page instead of being another generated blurb.
 */
export function buildStudyPoints(pack: LearningPack): StudyPoint[] {
  const points: StudyPoint[] = []
  const words = [
    ...pack.items.filter((item) => item.type !== 'sentence' && item.tier === 'core'),
    ...pack.items.filter((item) => item.type !== 'sentence' && item.tier !== 'core'),
  ]
  for (const item of words) {
    if (points.length >= 3) break
    const meaning = compact(item.definitionZh ?? item.sense, 60)
    if (!meaning) continue
    points.push({
      label: `「${item.lemma}」在语境里怎么用？`,
      detail: meaning,
    })
  }

  for (const paragraph of pack.reading ?? []) {
    const grammar = paragraph.note?.grammar?.trim()
    if (!grammar) continue
    points.push({ label: '句型 / 语法', detail: compact(grammar) })
    break
  }

  const pattern = pack.items.find((item) => item.sentence?.pattern)?.sentence?.pattern?.trim()
  if (pattern) points.push({ label: '可复用句型', detail: compact(pattern) })
  return points.slice(0, 5)
}
