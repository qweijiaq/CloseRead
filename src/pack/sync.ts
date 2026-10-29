import { sentences } from '../analyze/tokenize.js'
import type { LearningItem, LearningPack } from '../types.js'

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).toLowerCase().includes(normalize(needle).toLowerCase())
}

/**
 * Keep word-card and sentence-card contexts consistent after a paragraph edit.
 * Returns the items that must be written back to the review store.
 */
export function syncAfterParagraphEdit(
  pack: LearningPack,
  paragraphIndex: number,
  oldOriginal: string,
): LearningItem[] {
  const paragraph = (pack.reading ?? []).find((entry) => entry.index === paragraphIndex)
  if (!paragraph) return []
  const candidates = sentences(paragraph.original)
  const changed = new Set<LearningItem>()

  for (const itemId of paragraph.itemIds) {
    const item = pack.items.find((entry) => entry.id === itemId)
    if (!item) continue
    for (const context of item.contexts) {
      if (context.resourceId !== pack.resourceId) continue
      if (
        context.segmentIndex !== paragraphIndex &&
        !contains(oldOriginal, context.sentence) &&
        !contains(context.sentence, oldOriginal)
      ) {
        continue
      }
      const match = candidates.find((sentence) => contains(sentence, item.lemma))
      context.segmentIndex = paragraph.index
      context.resourceTitle = pack.title
      context.sentence = match ?? paragraph.original
      context.translation =
        normalize(match ?? paragraph.original) === normalize(paragraph.original)
          ? paragraph.translation
          : undefined
      changed.add(item)
    }
  }

  for (const item of pack.items) {
    if (item.type !== 'sentence' || !item.sentence) continue
    const context = item.contexts[0]
    if (!context || context.resourceId !== pack.resourceId) continue
    if (contains(oldOriginal, item.sentence.original) && !contains(paragraph.original, item.sentence.original)) {
      item.sentence.stale = true
      changed.add(item)
    } else if (contains(paragraph.original, item.sentence.original)) {
      if (item.sentence.stale) delete item.sentence.stale
      changed.add(item)
    }
  }

  return [...changed]
}

/** Remove contexts that point at a deleted paragraph and reindex the remaining ones. */
export function syncAfterParagraphDelete(
  pack: LearningPack,
  deletedIndex: number,
  oldOriginal: string,
): LearningItem[] {
  const changed = new Set<LearningItem>()
  for (const item of pack.items) {
    if (item.type === 'sentence' && item.sentence && contains(oldOriginal, item.sentence.original)) {
      item.sentence.stale = true
      changed.add(item)
    }
    const before = item.contexts.length
    item.contexts = item.contexts
      .filter((context) => {
        if (context.resourceId !== pack.resourceId) return true
        return context.segmentIndex !== deletedIndex && !contains(oldOriginal, context.sentence)
      })
      .map((context) =>
        context.resourceId === pack.resourceId && context.segmentIndex > deletedIndex
          ? { ...context, segmentIndex: context.segmentIndex - 1 }
          : context,
      )
    if (item.contexts.length !== before) changed.add(item)
  }
  return [...changed]
}

/** Keep card source titles aligned after the article title changes. */
export function syncAfterTitleEdit(
  pack: LearningPack,
  oldTitle: string,
): LearningItem[] {
  const newTitle = pack.title
  if (normalize(oldTitle) === normalize(newTitle)) return []
  const changed = new Set<LearningItem>()
  for (const item of pack.items) {
    let dirty = false
    if (item.sourceRef === oldTitle) {
      item.sourceRef = newTitle
      dirty = true
    }
    for (const context of item.contexts) {
      if (context.resourceTitle === oldTitle) {
        context.resourceTitle = newTitle
        dirty = true
      }
    }
    if (dirty) changed.add(item)
  }
  return [...changed]
}

/**
 * Validate manual sentence boundaries: the concatenation must equal the paragraph
 * so a split/merge can never silently rewrite the source text.
 * Returns undefined when the proposal matches automatic segmentation.
 */
export function normalizeSentenceBoundaries(original: string, proposed: unknown): string[] | undefined {
  const list = Array.isArray(proposed)
    ? proposed
        .map((entry) => (typeof entry === 'string' ? normalize(entry) : ''))
        .filter((entry) => entry.length > 0)
    : []
  if (list.length === 0) throw new Error('断句结果不能为空。')
  const squash = (value: string) => value.replace(/\s+/g, '')
  if (squash(list.join(' ')) !== squash(original)) {
    throw new Error('断句只能调整分句位置，不能改动原文。')
  }
  const defaults = sentences(original)
  const sameAsDefault =
    list.length === defaults.length && list.every((entry, at) => squash(entry) === squash(defaults[at] ?? ''))
  return sameAsDefault ? undefined : list
}

/**
 * Re-point word contexts and sentence-card stale flags after paragraph
 * boundaries were merged. Contexts from other resources are untouched.
 */
export function resyncReadingContexts(pack: LearningPack): LearningItem[] {
  const paragraphs = pack.reading ?? []
  const changed = new Set<LearningItem>()
  for (const item of pack.items) {
    if (item.type === 'sentence' && item.sentence?.original) {
      const stale = !paragraphs.some((paragraph) => contains(paragraph.original, item.sentence!.original))
      if (stale !== Boolean(item.sentence.stale)) {
        if (stale) item.sentence.stale = true
        else delete item.sentence.stale
        changed.add(item)
      }
    }
    for (const context of item.contexts) {
      if (context.resourceId !== pack.resourceId) continue
      const paragraph =
        paragraphs.find((entry) => entry.itemIds.includes(item.id) && contains(entry.original, context.sentence)) ??
        paragraphs.find((entry) => entry.itemIds.includes(item.id) && contains(entry.original, item.lemma)) ??
        paragraphs.find((entry) => contains(entry.original, context.sentence)) ??
        paragraphs.find((entry) => contains(entry.original, item.lemma))
      if (!paragraph) continue
      const parts =
        paragraph.customSentences?.length && paragraph.customSentences.length > 0
          ? paragraph.customSentences
          : sentences(paragraph.original)
      const match = parts.find((sentence) => contains(sentence, item.lemma)) ?? paragraph.original
      const translation =
        normalize(match) === normalize(paragraph.original) ? paragraph.translation : undefined
      if (
        context.segmentIndex !== paragraph.index ||
        context.resourceTitle !== pack.title ||
        normalize(context.sentence) !== normalize(match) ||
        context.translation !== translation
      ) {
        context.segmentIndex = paragraph.index
        context.resourceTitle = pack.title
        context.sentence = match
        if (translation) context.translation = translation
        else delete context.translation
        changed.add(item)
      }
    }
  }
  return [...changed]
}
