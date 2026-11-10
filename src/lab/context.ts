import type { LearningPack, ReadingParagraph, StoredItem } from '../types.js'
import type { Store } from '../store/store.js'
import { isDue, isLeech, isNew } from '../review/scheduler.js'

export interface LabPackInfo {
  id: string
  title: string
  cefr: string
  wordCount: number
  itemCount: number
  summary: string
  paragraphs: Array<{ index: number; original: string; translation?: string }>
  snippets: Array<{ text: string; paragraph: number }>
}

export interface LabPack {
  pack: LearningPack
  info: LabPackInfo
  words: StoredItem[]
}

export interface LabScope extends LabPackInfo {
  newCount: number
  dueCount: number
  leechCount: number
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function scopeWords(store: Store, scope: string): StoredItem[] {
  const words = store.listItems().filter((item) => item.type !== 'sentence' && item.status === 'active')
  if (scope === 'new') return words.filter((item) => isNew(item.review))
  if (scope === 'due') return words.filter((item) => !isNew(item.review) && isDue(item.review))
  if (scope === 'leech') return words.filter((item) => isLeech(item.review))
  if (scope === 'favorites') return words.filter((item) => item.favorite)
  return words
}

function hasRealSentence(word: StoredItem): boolean {
  return word.contexts.some((entry) => entry.sentence.trim().length >= 8) ||
    word.examples.some((entry) => entry.text.trim().length >= 8)
}

function chooseWords(words: StoredItem[], limit = 24): StoredItem[] {
  return words
    .filter(hasRealSentence)
    .sort((a, b) => {
      const score = (item: StoredItem) => (isLeech(item.review) ? 3 : isDue(item.review) ? 2 : 1)
      return score(b) - score(a) || a.review.due.localeCompare(b.review.due)
    })
    .slice(0, limit)
}

function sentenceFor(word: StoredItem): { text: string; translation?: string } {
  const context = word.contexts.find((entry) => entry.sentence.trim())
  if (context) {
    return { text: clip(context.sentence, 360), ...(context.translation ? { translation: clip(context.translation, 360) } : {}) }
  }
  const example = word.examples.find((entry) => entry.text.trim())
  if (example) return { text: clip(example.text, 360) }
  throw new Error('这个单词还没有例句。')
}

function cefrFor(words: StoredItem[]): string {
  const counts = new Map<string, number>()
  for (const word of words) {
    if (word.cefr) counts.set(word.cefr, (counts.get(word.cefr) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length > 1 ? `混合 ${sorted[0]![0]}` : sorted[0]?.[0] ?? 'B2'
}

function buildInfo(scope: string, title: string, words: StoredItem[]): LabScope {
  const chosen = chooseWords(words)
  const paragraphs = chosen.map((word, index) => {
    const sentence = sentenceFor(word)
    return {
      index,
      original: sentence.text,
      ...(sentence.translation ? { translation: sentence.translation } : {}),
    }
  })
  const snippets = paragraphs.map((paragraph) => ({ text: paragraph.original, paragraph: paragraph.index }))
  return {
    id: scope,
    title,
    cefr: cefrFor(chosen),
    wordCount: words.length,
    itemCount: chosen.length,
    summary: `${title}：从词库选出 ${chosen.length} 个词，围绕词义、搭配和例句练习。`,
    paragraphs,
    snippets,
    newCount: words.filter((item) => isNew(item.review)).length,
    dueCount: words.filter((item) => !isNew(item.review) && isDue(item.review)).length,
    leechCount: words.filter((item) => isLeech(item.review)).length,
  }
}

const SCOPES: Array<{ id: string; title: string }> = [
  { id: 'all', title: '全部学习词' },
  { id: 'new', title: '新词' },
  { id: 'due', title: '到期词' },
  { id: 'leech', title: '易忘词' },
  { id: 'favorites', title: '收藏词' },
]

export function labPacks(store: Store): LabScope[] {
  const result: LabScope[] = []
  for (const scope of SCOPES) {
    const words = scopeWords(store, scope.id)
    if (scope.id !== 'all' && words.length === 0) continue
    if (scope.id === 'all' && words.length === 0) {
      result.push(buildInfo(scope.id, scope.title, words))
      continue
    }
    result.push(buildInfo(scope.id, scope.title, words))
  }
  return result
}

export function loadLabPack(store: Store, scope = 'all'): LabPack {
  const known = SCOPES.find((entry) => entry.id === scope)
  const scopeId = known?.id ?? 'all'
  const words = chooseWords(scopeWords(store, scopeId))
  if (words.length === 0) throw new Error('还没有带例句的学习词。先读一篇文章，或加入带例句的词书（如 IELTS）。')
  const title = known?.title ?? '全部学习词'
  const info = buildInfo(scopeId, title, scopeWords(store, scopeId))
  const reading: ReadingParagraph[] = info.paragraphs.map((paragraph, index) => ({
    index,
    original: paragraph.original,
    ...(paragraph.translation ? { translation: paragraph.translation } : {}),
    itemIds: [words[index]?.id ?? ''],
  }))
  const now = new Date().toISOString()
  const pack: LearningPack = {
    id: `vocab:${scopeId}`,
    resourceId: 'vocab',
    title,
    source: 'vocabulary',
    mode: 'heuristic',
    generatedAt: now,
    summary: info.summary,
    difficulty: { cefr: info.cefr, reason: '来自词库' },
    stats: { wordCount: info.wordCount, itemCount: words.length, readingMinutes: 1 },
    items: words,
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading,
    styleName: 'vocabulary',
  }
  return { pack, info, words }
}

export function packPrompt(pack: LearningPack, maxChars = 9000): string {
  const words = pack.items
    .filter((item) => item.type !== 'sentence')
    .slice(0, 24)
    .map((item) => {
      const family = item.relations.wordFamily.length ? ` | family: ${item.relations.wordFamily.join(', ')}` : ''
      return `- ${item.lemma}${item.pos ? ` (${item.pos})` : ''}: ${clip(item.definitionZh ?? item.sense, 120)}${family}`
    })
    .join('\n')
  const sentences = (pack.reading ?? [])
    .map((paragraph) => `[${paragraph.index}] ${paragraph.original}`)
    .join('\n')
    .slice(0, Math.max(1000, maxChars - words.length))
  return `Vocabulary set: ${pack.title}
CEFR: ${pack.difficulty.cefr || 'B2'}
Summary: ${clip(pack.summary, 400)}
Target words:
${words}
Context sentences:
${sentences}`
}

export function sourceTitle(_record: unknown, pack: LearningPack): string {
  return pack.title
}
