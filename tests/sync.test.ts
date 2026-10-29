import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeSentenceBoundaries,
  syncAfterParagraphDelete,
  syncAfterParagraphEdit,
  syncAfterTitleEdit,
} from '../src/pack/sync.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'word-1',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'focus',
    definition: 'focus',
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Old title',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
      },
      {
        resourceId: 'other',
        resourceTitle: 'Other',
        segmentIndex: 0,
        sentence: 'Other context.',
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Old title',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(): LearningPack {
  return {
    id: 'pack-sync',
    resourceId: 'r',
    title: 'Old title',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 10, itemCount: 2, readingMinutes: 1 },
    items: [
      makeItem(),
      {
        id: 'sentence-1',
        type: 'sentence',
        lemma: 'Attention is scarce.',
        sense: '注意力稀缺。',
        definition: 'Attention is scarce.',
        contexts: [
          {
            resourceId: 'r',
            resourceTitle: 'Old title',
            segmentIndex: 0,
            sentence: 'Attention is scarce.',
          },
        ],
        collocations: [],
        examples: [],
        relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
        sentence: {
          original: 'Attention is scarce.',
          translation: '注意力稀缺。',
          chunks: [],
          variants: [],
        },
        tags: ['sentence'],
        sourceRef: 'Old title',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      { index: 1, original: 'Attention is scarce.', itemIds: ['word-1'] },
      { index: 0, original: 'Other paragraph.', itemIds: [] },
    ],
  }
}

describe('pack reading sync', () => {
  it('updates word-card contexts after a paragraph edit', () => {
    const pack = makePack()
    pack.reading = [
      { index: 1, original: 'Attention remains scarce in modern life.', itemIds: ['word-1'] },
      { index: 0, original: 'Other paragraph.', itemIds: [] },
    ]
    const changed = syncAfterParagraphEdit(pack, 1, 'Attention is scarce.')
    assert.ok(changed.some((item) => item.id === 'word-1'))
    const word = pack.items.find((item) => item.id === 'word-1')!
    assert.equal(word.contexts[0]?.sentence, 'Attention remains scarce in modern life.')
    assert.equal(word.contexts[0]?.segmentIndex, 1)
    const sentence = pack.items.find((item) => item.id === 'sentence-1')!
    assert.equal(sentence.sentence?.stale, true)
  })

  it('removes deleted paragraph contexts and reindexes the rest', () => {
    const pack = makePack()
    const changed = syncAfterParagraphDelete(pack, 1, 'Attention is scarce.')
    assert.ok(changed.length > 0)
    const word = pack.items.find((item) => item.id === 'word-1')!
    assert.equal(word.contexts.some((context) => context.resourceId === 'r'), false)
    assert.equal(word.contexts.some((context) => context.resourceId === 'other'), true)
    assert.equal(pack.items.find((item) => item.id === 'sentence-1')?.sentence?.stale, true)
  })

  it('updates source titles after a title edit', () => {
    const pack = makePack()
    pack.title = 'New title'
    const changed = syncAfterTitleEdit(pack, 'Old title')
    assert.ok(changed.length > 0)
    const word = pack.items.find((item) => item.id === 'word-1')!
    assert.equal(word.sourceRef, 'New title')
    assert.equal(word.contexts[0]?.resourceTitle, 'New title')
    assert.equal(word.contexts[1]?.resourceTitle, 'Other')
  })
})

describe('manual sentence boundaries', () => {
  it('accepts a merged split as long as the text is unchanged', () => {
    const boundaries = normalizeSentenceBoundaries('Attention is scarce. Focus is hard.', [
      'Attention is scarce. Focus is hard.',
    ])
    assert.deepEqual(boundaries, ['Attention is scarce. Focus is hard.'])
  })

  it('accepts a finer split and treats the automatic split as default', () => {
    const finer = normalizeSentenceBoundaries('Attention is scarce. Focus is hard.', [
      'Attention is scarce.',
      'Focus is hard.',
    ])
    assert.equal(finer, undefined)

    const custom = normalizeSentenceBoundaries('Attention is scarce. Focus is hard.', [
      'Attention is',
      'scarce. Focus is hard.',
    ])
    assert.deepEqual(custom, ['Attention is', 'scarce. Focus is hard.'])
  })

  it('rejects rewrites and empty boundaries', () => {
    assert.throws(
      () => normalizeSentenceBoundaries('Attention is scarce.', ['Attention matters.']),
      /不能改动原文/,
    )
    assert.throws(() => normalizeSentenceBoundaries('Attention is scarce.', []), /不能为空/)
  })
})
