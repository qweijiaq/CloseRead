import type { AnalysisResult, LearningItem, Resource } from '../types.js'
import { lookupWords } from './dictionary.js'
import { fallbackExercises } from './exercises.js'
import { itemId } from './item-id.js'
import { fallbackReading } from './reading.js'
import {
  estimateDifficulty,
  extractCandidates,
  extractCollocations,
  findContextSentence,
  sentences,
} from './tokenize.js'

function fallbackSummary(text: string): string {
  return sentences(text).slice(0, 3).join(' ').slice(0, 800)
}

export async function analyzeHeuristic(resource: Resource, limit: number): Promise<AnalysisResult> {
  const candidates = extractCandidates(resource.text, limit)
  const dictionary = await lookupWords(candidates.map((candidate) => candidate.lemma))
  const difficulty = estimateDifficulty(resource.text)
  const now = new Date().toISOString()

  const items: LearningItem[] = candidates.map((candidate) => {
    const info = dictionary.get(candidate.lemma)
    const contextSentence = candidate.exampleSentence || findContextSentence(resource.text, candidate.lemma)
    const segment = resource.segments.find((entry) =>
      entry.text.toLowerCase().includes(candidate.lemma.toLowerCase()),
    )
    const collocations = extractCollocations(resource.text, candidate.lemma)
    const definition = info?.definition ?? `the meaning of "${candidate.lemma}" in this context`
    const examples = [
      ...(contextSentence ? [{ text: contextSentence, origin: 'source' as const }] : []),
      ...(info?.examples ?? []).map((text) => ({ text, origin: 'dictionary' as const })),
    ]

    return {
      id: itemId(candidate.lemma, definition),
      type: 'word_sense',
      lemma: candidate.lemma,
      sense: definition,
      pos: info?.partOfSpeech ?? candidate.pos,
      ipa: info?.phonetic,
      definition,
      cefr: undefined,
      contexts: [
        {
          resourceId: resource.id,
          resourceTitle: resource.title,
          segmentIndex: segment?.index ?? 0,
          sentence: contextSentence,
          page: segment?.page,
          timestamp: segment?.timestamp,
        },
      ],
      collocations,
      examples,
      relations: {
        synonyms: info?.synonyms ?? [],
        antonyms: info?.antonyms ?? [],
        confusables: [],
        wordFamily: [],
      },
      notes: info?.definition ? undefined : '词典未收录这个词；请结合原文语境理解，或配置 LLM 生成释义。',
      tags: candidate.pos ? [candidate.pos] : [],
      sourceRef: `${resource.title}${segment?.page ? `, p.${segment.page}` : ''}${
        segment?.timestamp ? ` @ ${segment.timestamp}` : ''
      }`,
      createdAt: now,
      updatedAt: now,
    }
  })

  return {
    summary: fallbackSummary(resource.text),
    difficulty,
    items,
    exercises: fallbackExercises(items),
    reading: fallbackReading(resource, items),
    notes: [
      '当前为启发式模式：释义来自免费词典 API，搭配从原文中抽取；配置 LLM 后可获得更准确的义项判断、中文释义和练习。',
    ],
  }
}
