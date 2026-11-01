import type { LearningItem } from '../types.js'

export interface SentencePuzzle {
  id: string
  translation: string
  answer: string[]
}

export interface WordPuzzle {
  id: string
  lemma: string
  meaning: string
  answer: string[]
  hints: Record<string, string>
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function sentenceTokens(original: string, chunks: string[]): string[] {
  if (chunks.length >= 2 && normalize(chunks.join(' ')) === normalize(original)) return chunks
  const words = original.trim().split(/\s+/)
  if (words.length <= 2) return words
  const groups = Math.min(5, Math.max(2, Math.ceil(words.length / 3)))
  const size = Math.ceil(words.length / groups)
  const tokens: string[] = []
  for (let index = 0; index < words.length; index += size) {
    tokens.push(words.slice(index, index + size).join(' '))
  }
  return tokens
}

export function buildSentencePuzzle(item: LearningItem): SentencePuzzle | undefined {
  if (item.type !== 'sentence' || !item.sentence) return undefined
  const answer = sentenceTokens(
    item.sentence.original,
    item.sentence.chunks.map((chunk) => chunk.text).filter(Boolean),
  ).filter(Boolean)
  if (answer.length < 2) return undefined
  return {
    id: item.id,
    translation: item.sentence.translation,
    answer,
  }
}

export function buildWordPuzzle(item: LearningItem): WordPuzzle | undefined {
  if (item.type === 'sentence' || !item.wordFormation) return undefined
  const formation = item.wordFormation
  const parts = [
    ...formation.prefixes.map((part) => ({ form: part.form, meaning: part.meaning })),
    ...formation.roots.map((part) => ({ form: part.form, meaning: part.meaning })),
    ...formation.suffixes.map((part) => ({ form: part.form, meaning: part.meaning })),
  ].filter((part) => part.form.trim())
  if (parts.length < 2) return undefined
  return {
    id: item.id,
    lemma: item.lemma,
    meaning: item.definitionZh ?? item.sense,
    answer: parts.map((part) => part.form),
    hints: Object.fromEntries(parts.map((part) => [part.form, part.meaning])),
  }
}

export function collectGames(items: LearningItem[]): { sentences: SentencePuzzle[]; words: WordPuzzle[] } {
  const sentences = items.map(buildSentencePuzzle).filter((entry): entry is SentencePuzzle => Boolean(entry)).slice(0, 12)
  const words = items.map(buildWordPuzzle).filter((entry): entry is WordPuzzle => Boolean(entry)).slice(0, 12)
  return { sentences, words }
}
