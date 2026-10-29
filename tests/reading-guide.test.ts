import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readingGuideMarkdown } from '../src/pack/reading-guide.js'
import type { LearningPack } from '../src/types.js'

function makePack(): LearningPack {
  const now = new Date().toISOString()
  return {
    id: 'pack-guide',
    resourceId: 'r',
    title: 'Guide Test',
    source: 'sample',
    mode: 'llm',
    generatedAt: now,
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 100, itemCount: 1, readingMinutes: 1 },
    items: [
      {
        id: 'w1',
        type: 'word_sense',
        lemma: 'inflame',
        sense: '激化',
        pos: 'verb',
        definition: 'make worse',
        definitionZh: '激化',
        contexts: [],
        collocations: [],
        examples: [],
        relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
        tags: [],
        sourceRef: 'Resource',
        createdAt: now,
        updatedAt: now,
      },
    ],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [],
    editorial: '读前先看作者如何用词。\n\n## 01 inflame\n这里重复讲解。',
  }
}

describe('reading guide', () => {
  it('prefers a generated compressed guide', () => {
    const pack = makePack()
    pack.readingGuide = '自定义压缩导读。'
    assert.equal(readingGuideMarkdown(pack), '自定义压缩导读。')
  })

  it('falls back to the hook and a compact expression thread', () => {
    const guide = readingGuideMarkdown(makePack())
    assert.ok(guide.includes('读前先看作者如何用词'))
    assert.ok(!guide.includes('这里重复讲解'))
    assert.ok(guide.includes('本篇表达线索'))
    assert.ok(guide.includes('inflame'))
  })
})
