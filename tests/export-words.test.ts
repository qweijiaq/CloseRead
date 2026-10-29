import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filterPackForExport, rankExportWords } from '../src/analyze/export-words.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function word(id: string, lemma: string, tier: 'core' | 'bonus'): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: '释义',
    definition: 'definition',
    definitionZh: '释义',
    tier,
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(): LearningPack {
  const items = [
    word('b1', 'bonus-one', 'bonus'),
    word('c1', 'core-one', 'core'),
    word('c2', 'core-two', 'core'),
    word('b2', 'bonus-two', 'bonus'),
    word('c3', 'core-three', 'core'),
    word('b3', 'bonus-three', 'bonus'),
  ]
  return {
    id: 'pack-export',
    resourceId: 'r',
    title: 'Export selection',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 100, itemCount: items.length, readingMinutes: 5 },
    items: [
      ...items,
      {
        ...word('s1', 'A sentence card.', 'bonus'),
        type: 'sentence',
        sentence: {
          original: 'A sentence card.',
          translation: '一张句子卡。',
          chunks: [],
          variants: [],
        },
      },
    ],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [],
    frontMatter: {
      title: 'Export selection',
      itemIds: ['b1', 'c1', 's1'],
    },
  }
}

describe('export word selection', () => {
  it('falls back to core cards first', () => {
    const selected = rankExportWords(makePack(), 3)
    assert.deepEqual(
      selected.map((item) => item.id),
      ['c1', 'c2', 'c3'],
    )
  })

  it('keeps all words when the limit is at least the collection size', () => {
    assert.equal(rankExportWords(makePack(), 20).length, 6)
  })

  it('filters word cards, keeps sentence cards and prunes front matter', () => {
    const pack = makePack()
    const selected = rankExportWords(pack, 2)
    const filtered = filterPackForExport(pack, selected)
    assert.deepEqual(
      filtered.items.filter((item) => item.type !== 'sentence').map((item) => item.id),
      ['c1', 'c2'],
    )
    assert.ok(filtered.items.some((item) => item.type === 'sentence'))
    assert.deepEqual(filtered.frontMatter?.itemIds, ['c1'])
    assert.equal(filtered.stats.itemCount, 3)
  })
})
