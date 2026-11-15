import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-budget-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { storePath } = await import('../src/config.js')
const { Store } = await import('../src/store/store.js')

function word(id: string) {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense' as const,
    lemma: id,
    sense: 'test',
    definition: 'test',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: ['wordbook:cet4'],
    sourceRef: 'CET-4',
    staged: true,
    createdAt: now,
    updatedAt: now,
  }
}

describe('daily budget', () => {
  after(async () => fs.rm(temp, { recursive: true, force: true }))

  it('keeps staged wordbook words out of due and releases them on demand', async () => {
    const store = await Store.open(storePath())
    await store.upsertItems([word('staged-one')])
    assert.equal(store.stats().backlog, 1)
    assert.equal(store.stats().newItems, 0)
    assert.equal(store.dueItems(new Date(), 10).length, 0)

    assert.equal(await store.releaseStaged(1), 1)
    assert.equal(store.stats().backlog, 0)
    assert.equal(store.stats().newItems, 1)
    assert.equal(store.dueItems(new Date(), 10).length, 1)
    assert.ok(store.getItem('staged-one')?.introducedAt)
  })
})
