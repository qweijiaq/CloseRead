import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-card-cache-'))
process.env.LEARN_DATA_DIR = temp

const { cardCacheKey, getCachedCard, putCachedCard } = await import('../src/analyze/card-cache.js')

const card = {
  lemma: 'serendipity',
  sense: 'a happy accident',
  pos: 'noun',
  cefr: 'C1',
  definition: 'the fact of finding something valuable by chance',
  definitionZh: '意外发现美好事物的运气',
  collocations: ['pure serendipity'],
  examples: ['We met by serendipity.'],
  confusables: [],
  wordFamily: ['serendipitous'],
  synonyms: ['chance'],
  antonyms: [],
  notes: 'Often used for pleasant discoveries.',
}

describe('word card cache', () => {
  before(async () => {
    await fs.mkdir(path.join(temp, 'cache', 'cards'), { recursive: true })
  })

  after(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('uses a stable key and returns an exact cached card', async () => {
    assert.equal(cardCacheKey('Serendipity'), cardCacheKey('serendipity'))
    await putCachedCard(card)
    const cached = await getCachedCard('Serendipity', 'A happy accident.')
    assert.equal(cached?.definition, card.definition)
    const file = JSON.parse(
      await fs.readFile(path.join(temp, 'cache', 'cards', `${cardCacheKey('serendipity')}.json`), 'utf8'),
    ) as { cards: Array<{ lemma: string }> }
    assert.equal(file.cards[0]?.lemma, 'serendipity')
  })

  it('falls back to the single stored sense when wording changes', async () => {
    const cached = await getCachedCard('serendipity', 'an unexpected pleasant discovery')
    assert.equal(cached?.sense, 'a happy accident')
  })

  it('stores multiple senses under one lemma', async () => {
    await putCachedCard({
      ...card,
      sense: 'the faculty of making fortunate discoveries',
      definition: 'an aptitude for making desirable discoveries by accident',
    })
    const exact = await getCachedCard('serendipity', 'the faculty of making fortunate discoveries')
    assert.match(exact?.definition ?? '', /aptitude/)
  })
})
