import { generateDerivationGraph } from '../analyze/derivation.js'
import { answerReadingQuestion } from '../analyze/note-answer.js'
import { sentenceLookupKey, translateSentence } from '../analyze/sentence-translation.js'
import { sentences as splitSentences } from '../analyze/tokenize.js'
import type { LearningPack } from '../types.js'
import { savePackFiles } from './mutate.js'

export interface PrefetchOptions {
  /** Paragraph "think about it" answers. */
  answers?: boolean
  /** Word derivation graphs. */
  expand?: boolean
  /** Sentence translations. */
  sentences?: boolean
}

export interface PrefetchResult {
  answers: number
  expand: number
  sentences: number
}

/**
 * Prefetch is a long tail of independent model calls, so it runs them in
 * parallel. The limit is deliberately lower than the build's: several packs can
 * be prefetching at the same time.
 */
const PREFETCH_CONCURRENCY = Math.max(1, Math.min(6, Math.round(Number(process.env.LEARN_LLM_CONCURRENCY ?? 4) || 4)))

async function runLimited<T>(items: T[], fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(PREFETCH_CONCURRENCY, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      await fn(items[index]!, index)
    }
  })
  await Promise.all(workers)
}

/**
 * Fill in the content the reader would otherwise generate on click, so a pack
 * can be shared with people who have no model key. Progress is saved every few
 * items: an interrupted run keeps what it already produced.
 */
export async function prefetchPack(
  contents: LearningPack,
  dir: string,
  options: PrefetchOptions,
  onProgress?: (message: string) => void,
): Promise<PrefetchResult> {
  const result: PrefetchResult = { answers: 0, expand: 0, sentences: 0 }
  let dirty = 0
  // Saves share one queue: three groups finish at different times but only one
  // write may touch the pack directory at a time.
  let saveChain: Promise<void> = Promise.resolve()
  const save = (): Promise<void> => {
    dirty = 0
    saveChain = saveChain.then(() => savePackFiles(contents, dir)).catch(() => {})
    return saveChain
  }
  const maybeSave = async (threshold: number): Promise<void> => {
    if (dirty >= threshold) await save()
  }

  const answerTask = (async () => {
    if (!options.answers) return
    const pending = (contents.reading ?? []).filter(
      (paragraph) => paragraph.note?.question && !paragraph.note.answer,
    )
    let done = 0
    await runLimited(pending, async (paragraph) => {
      try {
        paragraph.note!.answer = await answerReadingQuestion(
          paragraph.original,
          paragraph.note!.question!,
          contents.title,
        )
        result.answers += 1
        dirty += 1
      } catch {
        // Keep going: one failed answer must not stop the rest.
      } finally {
        done += 1
        onProgress?.(`预生成答案 ${done}/${pending.length}`)
        await maybeSave(3)
      }
    })
  })()

  const expandTask = (async () => {
    if (!options.expand) return
    const pending = (contents.items ?? []).filter((item) => !item.derivation)
    let done = 0
    await runLimited(pending, async (item) => {
      try {
        item.derivation = await generateDerivationGraph(item)
        result.expand += 1
        dirty += 1
      } catch {
        // Skip words the model refuses.
      } finally {
        done += 1
        onProgress?.(`预生成单词展开 ${done}/${pending.length}`)
        await maybeSave(3)
      }
    })
  })()

  const sentenceTask = (async () => {
    if (!options.sentences) return
    const store = (contents.sentenceTranslations ??= {})
    const pending: Array<{ sentence: string; context: string }> = []
    const seen = new Set<string>()
    for (const paragraph of contents.reading ?? []) {
      for (const sentence of splitSentences(paragraph.original)) {
        const key = sentenceLookupKey(sentence)
        if (store[key] || seen.has(key)) continue
        seen.add(key)
        pending.push({ sentence, context: paragraph.original })
      }
    }
    let done = 0
    await runLimited(pending, async (entry) => {
      try {
        store[sentenceLookupKey(entry.sentence)] = await translateSentence(entry.sentence, entry.context)
        result.sentences += 1
        dirty += 1
      } catch {
        // Skip sentences that fail.
      } finally {
        done += 1
        onProgress?.(`预生成句子翻译 ${done}/${pending.length}`)
        await maybeSave(5)
      }
    })
  })()

  await Promise.all([answerTask, expandTask, sentenceTask])
  if (dirty) await save()
  await saveChain
  return result
}
