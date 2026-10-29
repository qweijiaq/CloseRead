import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { analyzeSelection } from '../src/pack/selection.js'
import type { LearningPack } from '../src/types.js'

function makePack(): LearningPack {
  return {
    id: 'pack-selection-test',
    resourceId: 'r',
    title: 'Selection Test',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 20, itemCount: 0, readingMinutes: 1 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      {
        index: 0,
        original: 'The quick brown fox jumps over the lazy dog. Take a toll on attention.',
        translation: '敏捷的棕色狐狸跳过懒狗。对注意力造成损害。',
        itemIds: [],
      },
    ],
    sourceText: 'The quick brown fox jumps over the lazy dog. Take a toll on attention.',
  }
}

describe('selection analysis', () => {
  it('treats a single word as a phrase', async () => {
    const analysis = await analyzeSelection(makePack(), 'attention', { useLlm: false })
    assert.equal(analysis.recommendation, 'phrase')
    assert.equal(analysis.phrase, 'attention')
    assert.deepEqual(analysis.parts, [])
  })

  it('splits a non-phrase into content words', async () => {
    const analysis = await analyzeSelection(makePack(), 'the quick brown fox', { useLlm: false })
    assert.equal(analysis.recommendation, 'separate')
    assert.deepEqual(
      analysis.parts.map((part) => part.text),
      ['quick', 'brown', 'fox'],
    )
  })

  it('keeps content words from a multi-word selection', async () => {
    const analysis = await analyzeSelection(makePack(), 'take a toll on', { useLlm: false })
    assert.deepEqual(
      analysis.parts.map((part) => part.text),
      ['take', 'toll'],
    )
  })
})
