import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { packSchema } from '../src/pack/schema.js'

describe('pack schema', () => {
  it('accepts build metadata and page-aware paragraphs', () => {
    const result = packSchema.safeParse({
      id: 'pack-test',
      resourceId: 'resource-test',
      title: 'Test',
      source: 'test',
      mode: 'heuristic',
      generatedAt: new Date().toISOString(),
      summary: 'Summary',
      difficulty: { cefr: 'B2', reason: 'test' },
      stats: { wordCount: 100, itemCount: 1, readingMinutes: 3 },
      items: [],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [
        { index: 0, original: 'A paragraph.', translation: '一段。', itemIds: [], page: 3 },
      ],
      build: {
        inputHash: 'abc',
        mode: 'heuristic',
        provider: 'heuristic',
        model: 'dictionary',
        promptVersion: '2026-11-01',
        generatedAt: new Date().toISOString(),
        warnings: [],
      },
    })
    assert.equal(result.success, true)
  })

  it('rejects an invalid page number', () => {
    const result = packSchema.safeParse({
      id: 'pack-test',
      resourceId: 'resource-test',
      title: 'Test',
      source: 'test',
      mode: 'heuristic',
      generatedAt: new Date().toISOString(),
      summary: 'Summary',
      difficulty: { cefr: 'B2', reason: 'test' },
      stats: { wordCount: 100, itemCount: 0, readingMinutes: 3 },
      items: [],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [{ index: 0, original: 'A paragraph.', itemIds: [], page: 0 }],
    })
    assert.equal(result.success, false)
  })
})

describe('pack item schema', () => {
  const base = {
    id: 'pack-test',
    resourceId: 'resource-test',
    title: 'Test',
    source: 'test',
    mode: 'heuristic' as const,
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 100, itemCount: 1, readingMinutes: 3 },
    exercises: { cloze: [], comprehension: [], discussion: [] },
  }

  it('accepts the fields the reader dereferences', () => {
    const result = packSchema.safeParse({
      ...base,
      items: [
        {
          id: 'item-1',
          type: 'word_sense',
          lemma: 'attention',
          sense: 'focus',
          definition: 'the act of focusing',
          contexts: [
            {
              resourceId: 'resource-test',
              resourceTitle: 'Test',
              segmentIndex: 0,
              sentence: 'Attention is scarce.',
            },
          ],
        },
      ],
    })
    assert.equal(result.success, true)
  })

  it('rejects malformed or null items before the renderer sees them', () => {
    for (const items of [[null], [{ id: 'x' }], [{ ...base, id: 'x' }]]) {
      const result = packSchema.safeParse({ ...base, items })
      assert.equal(result.success, false)
    }
  })
})
