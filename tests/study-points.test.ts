import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildStudyPoints } from '../src/pack/study-points.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function word(id: string, lemma: string, zh: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: zh,
    definition: zh,
    definitionZh: zh,
    tier: 'core',
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
  return {
    id: 'pack-study',
    resourceId: 'r',
    title: 'Study points',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 100, itemCount: 3, readingMinutes: 5 },
    items: [
      word('w1', 'endorsement', '代言'),
      word('w2', 'cut ties', '断绝关系'),
      {
        ...word('s1', 'The quote matters.', '这句话很重要'),
        type: 'sentence',
        sentence: {
          original: 'The quote matters.',
          translation: '这句话很重要。',
          chunks: [],
          pattern: 'It is not X but Y that matters.',
          variants: [],
        },
      },
    ],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      {
        index: 0,
        original: 'The quote matters.',
        translation: '这句话很重要。',
        itemIds: ['w1'],
        note: {
          summary: '段落作用。',
          grammar: 'not ... but ... 强调结构',
          connectors: [],
        },
      },
    ],
  }
}

describe('study points', () => {
  it('turns core cards and notes into a short preview', () => {
    const points = buildStudyPoints(makePack())
    assert.ok(points.length >= 3)
    assert.match(points[0]!.label, /endorsement/)
    assert.equal(points[0]!.detail, '代言')
    assert.ok(points.some((point) => point.label === '句型 / 语法' && point.detail?.includes('not')))
    assert.ok(points.some((point) => point.label === '可复用句型'))
  })
})
