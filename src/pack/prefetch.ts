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
  const save = async (): Promise<void> => {
    await savePackFiles(contents, dir)
    dirty = 0
  }

  if (options.answers) {
    const pending = (contents.reading ?? []).filter(
      (paragraph) => paragraph.note?.question && !paragraph.note.answer,
    )
    for (const [index, paragraph] of pending.entries()) {
      onProgress?.(`预生成答案 ${index + 1}/${pending.length}`)
      try {
        paragraph.note!.answer = await answerReadingQuestion(
          paragraph.original,
          paragraph.note!.question!,
          contents.title,
        )
        result.answers += 1
        dirty += 1
        if (dirty >= 3) await save()
      } catch {
        // Keep going: one failed answer must not stop the rest.
      }
    }
    if (dirty) await save()
  }

  if (options.expand) {
    const pending = (contents.items ?? []).filter((item) => !item.derivation)
    for (const [index, item] of pending.entries()) {
      onProgress?.(`预生成单词展开 ${index + 1}/${pending.length}`)
      try {
        item.derivation = await generateDerivationGraph(item)
        result.expand += 1
        dirty += 1
        if (dirty >= 3) await save()
      } catch {
        // Skip words the model refuses.
      }
    }
    if (dirty) await save()
  }

  if (options.sentences) {
    const store = (contents.sentenceTranslations ??= {})
    const pending: Array<{ sentence: string; context: string }> = []
    for (const paragraph of contents.reading ?? []) {
      for (const sentence of splitSentences(paragraph.original)) {
        if (store[sentenceLookupKey(sentence)]) continue
        pending.push({ sentence, context: paragraph.original })
      }
    }
    for (const [index, entry] of pending.entries()) {
      onProgress?.(`预生成句子翻译 ${index + 1}/${pending.length}`)
      try {
        store[sentenceLookupKey(entry.sentence)] = await translateSentence(
          entry.sentence,
          entry.context,
        )
        result.sentences += 1
        dirty += 1
        if (dirty >= 5) await save()
      } catch {
        // Skip sentences that fail.
      }
    }
    if (dirty) await save()
  }

  return result
}
