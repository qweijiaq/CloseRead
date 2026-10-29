import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { addItemToPack, addSentenceToPack, removeItemFromPack } from '../src/pack/mutate.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function makeItem(id: string, lemma: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: `${lemma} sense`,
    definition: `${lemma} definition`,
    definitionZh: `${lemma} 中文`,
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Resource',
        segmentIndex: 0,
        sentence: `This paragraph mentions ${lemma}.`,
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
  }
}

function makeSentenceItem(id: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'sentence',
    lemma: 'not so much A as B',
    sense: '与其说是 A，不如说是 B',
    definition: 'The rivalry is not so much a strategy as a reflex.',
    definitionZh: '这场竞争与其说是战略，不如说是条件反射。',
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Resource',
        segmentIndex: 0,
        sentence: 'The rivalry is not so much a strategy as a reflex.',
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    sentence: {
      original: 'The rivalry is not so much a strategy as a reflex.',
      translation: '这场竞争与其说是战略，不如说是条件反射。',
      chunks: [
        { text: 'The rivalry', role: '主语', meaning: '这场竞争' },
        { text: 'not so much a strategy as a reflex', role: '表语', meaning: '与其说是战略，不如说是条件反射' },
      ],
      pattern: 'not so much A as B',
      grammar: '用于把重点从 A 移到 B。',
      variants: ['It is not so much a crisis as a warning.'],
      why: '适合表达“表面是 A，实质是 B”。',
    },
    tags: ['sentence'],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(): LearningPack {  return {
    id: 'pack-r',
    resourceId: 'r',
    title: 'Resource',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 20, itemCount: 2, readingMinutes: 1 },
    items: [makeItem('a', 'attention'), makeItem('b', 'friction')],
    exercises: {
      cloze: [
        { sentence: '______ is scarce.', answer: 'attention' },
        { sentence: 'Add ______.', answer: 'friction' },
      ],
      comprehension: [],
      discussion: [],
    },
    reading: [
      {
        index: 0,
        original: 'This paragraph mentions attention, friction and scarce.',
        translation: '这一段提到了注意力、摩擦和稀缺。',
        itemIds: ['a', 'b'],
      },
    ],
  }
}

describe('pack mutations', () => {
  it('removes an item from the pack, its paragraph and its cloze', () => {
    const updated = removeItemFromPack(makePack(), 'a')
    assert.deepEqual(updated.items.map((item) => item.id), ['b'])
    assert.deepEqual(updated.reading?.[0]?.itemIds, ['b'])
    assert.deepEqual(updated.exercises.cloze.map((exercise) => exercise.answer), ['friction'])
    assert.equal(updated.stats.itemCount, 1)
  })

  it('adds an item and attaches it to the paragraph that contains it', () => {
    const updated = addItemToPack(makePack(), makeItem('c', 'scarce'))
    assert.deepEqual(updated.items.map((item) => item.id), ['a', 'b', 'c'])
    assert.deepEqual(updated.reading?.[0]?.itemIds, ['a', 'b', 'c'])
    assert.equal(updated.stats.itemCount, 3)
  })

  it('attaches a word to the paragraph it was selected from, even when the lemma is inflected', () => {
    const updated = addItemToPack(makePack(), makeItem('c', 'resilience'), { paragraphIndex: 0 })
    assert.deepEqual(updated.items.map((item) => item.id), ['a', 'b', 'c'])
    assert.deepEqual(updated.reading?.[0]?.itemIds, ['a', 'b', 'c'])
  })

  it('moves a word card to the front matter or another paragraph when requested', () => {
    const pack = addItemToPack(makePack(), makeItem('c', 'scarce'))
    const front = addItemToPack(pack, makeItem('c', 'scarce'), { front: true })
    assert.deepEqual(front.frontMatter?.itemIds, ['c'])
    assert.deepEqual(front.reading?.[0]?.itemIds, ['a', 'b'])

    const moved = addItemToPack(front, makeItem('c', 'scarce'), { paragraphIndex: 0 })
    assert.deepEqual(moved.frontMatter?.itemIds, [])
    assert.deepEqual(moved.reading?.[0]?.itemIds, ['a', 'b', 'c'])
  })

  it('keeps manual additions out of paragraphs so they appear in the supplemental module', () => {
    const updated = addItemToPack(makePack(), makeItem('c', 'attention'), { manual: true })
    assert.deepEqual(updated.reading?.[0]?.itemIds, ['a', 'b'])
    assert.equal(updated.items.some((item) => item.id === 'c'), true)
  })

  it('adds a sentence card without attaching it to the word list of a paragraph', () => {
    const updated = addSentenceToPack(makePack(), makeSentenceItem('s1'))
    assert.deepEqual(updated.items.map((item) => item.id), ['a', 'b', 's1'])
    assert.deepEqual(updated.reading?.[0]?.itemIds, ['a', 'b'])
    assert.equal(updated.stats.itemCount, 3)
    assert.equal(updated.items[2]?.sentence?.original, 'The rivalry is not so much a strategy as a reflex.')
  })
})
