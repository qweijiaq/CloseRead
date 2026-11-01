import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSentencePuzzle, buildWordPuzzle, collectGames } from '../src/pack/games.js'
import type { LearningItem } from '../src/types.js'

function makeItem(overrides: Partial<LearningItem> = {}): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'game-item',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'notice or interest',
    definition: 'the act of noticing something',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('sentence puzzle', () => {
  it('uses the card chunks when they reassemble the original sentence', () => {
    const item = makeItem({
      type: 'sentence',
      sentence: {
        original: 'The rivalry is not so much a strategy as a reflex.',
        translation: '这场竞争与其说是战略，不如说是条件反射。',
        chunks: [
          { text: 'The rivalry', role: '主语' },
          { text: 'is not so much a strategy', role: '表语' },
          { text: 'as a reflex.', role: '比较' },
        ],
        variants: [],
      },
    })
    const puzzle = buildSentencePuzzle(item)
    assert.deepEqual(puzzle?.answer, ['The rivalry', 'is not so much a strategy', 'as a reflex.'])
    assert.equal(puzzle?.translation, '这场竞争与其说是战略，不如说是条件反射。')
  })

  it('falls back to word groups that still cover every word', () => {
    const original = 'Lacklustre content is not the only reason for investors disgruntlement.'
    const item = makeItem({
      type: 'sentence',
      sentence: { original, translation: '内容乏味不是唯一原因。', chunks: [], variants: [] },
    })
    const puzzle = buildSentencePuzzle(item)
    assert.ok(puzzle)
    assert.ok(puzzle.answer.length >= 2)
    assert.equal(puzzle.answer.join(' '), original)
  })

  it('skips cards without a usable sentence', () => {
    assert.equal(buildSentencePuzzle(makeItem()), undefined)
    assert.equal(
      buildSentencePuzzle(
        makeItem({
          type: 'sentence',
          sentence: { original: 'Short.', translation: '', chunks: [], variants: [] },
        }),
      ),
      undefined,
    )
  })
})

describe('word puzzle', () => {
  it('orders prefixes, roots and suffixes and keeps meanings as hints', () => {
    const item = makeItem({
      lemma: 'unbelievable',
      wordFormation: {
        prefixes: [{ form: 'un-', meaning: '不', examples: [] }],
        roots: [{ form: 'believe', meaning: '相信', examples: [] }],
        suffixes: [{ form: '-able', meaning: '可以……的', examples: [] }],
      },
    })
    const puzzle = buildWordPuzzle(item)
    assert.deepEqual(puzzle?.answer, ['un-', 'believe', '-able'])
    assert.deepEqual(puzzle?.hints, { 'un-': '不', believe: '相信', '-able': '可以……的' })
    assert.equal(puzzle?.lemma, 'unbelievable')
  })

  it('skips words with fewer than two formation parts', () => {
    assert.equal(buildWordPuzzle(makeItem()), undefined)
    assert.equal(
      buildWordPuzzle(
        makeItem({
          wordFormation: {
            prefixes: [],
            roots: [{ form: 'attention', meaning: '注意', examples: [] }],
            suffixes: [],
          },
        }),
      ),
      undefined,
    )
  })
})

describe('game collection', () => {
  it('keeps only playable cards and caps each mode', () => {
    const items: LearningItem[] = [
      makeItem({
        id: 'sentence-1',
        type: 'sentence',
        sentence: { original: 'One two three four.', translation: '一。', chunks: [], variants: [] },
      }),
      makeItem({
        id: 'word-1',
        lemma: 'unbelievable',
        wordFormation: {
          prefixes: [{ form: 'un-', meaning: '不', examples: [] }],
          roots: [{ form: 'believe', meaning: '相信', examples: [] }],
          suffixes: [],
        },
      }),
      makeItem({ id: 'plain-word' }),
    ]
    const games = collectGames(items)
    assert.equal(games.sentences.length, 1)
    assert.equal(games.words.length, 1)
    assert.equal(games.sentences[0]?.id, 'sentence-1')
    assert.equal(games.words[0]?.id, 'word-1')
  })
})
