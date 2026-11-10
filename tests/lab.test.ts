import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-lab-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { addQuote, deleteQuote, listQuotes, setQuoteCommentary } = await import('../src/lab/quotes.js')
const { cached } = await import('../src/lab/cache.js')
const { Store } = await import('../src/store/store.js')
const { petState } = await import('../src/lab/pet.js')

describe('lab persistence', () => {
  it('adds, lists, comments and deletes quotes', async () => {
    const first = await addQuote({ text: 'A sentence worth keeping.', sourceTitle: 'Test' })
    const second = await addQuote({ text: 'Another line.', packId: 'pack-1' })
    const listed = await listQuotes()
    assert.equal(listed.length, 2)
    assert.equal(listed[0]?.id, second.id)
    assert.equal(listed[1]?.translation, undefined)
    const commented = await setQuoteCommentary(first.id, '短句有回响。')
    assert.equal(commented?.commentary, '短句有回响。')
    assert.equal(await deleteQuote(second.id), true)
    assert.equal(await deleteQuote('missing'), false)
    assert.equal((await listQuotes()).length, 1)
  })

  it('caches lab output and supports forced regeneration', async () => {
    let calls = 0
    const first = await cached('test-key', async () => { calls += 1; return { value: 1 } })
    const second = await cached('test-key', async () => { calls += 1; return { value: 2 } })
    assert.deepEqual(first, { value: 1 })
    assert.deepEqual(second, { value: 1 })
    assert.equal(calls, 1)
  })
})

describe('word pet', () => {
  let store: Awaited<ReturnType<typeof Store.open>>
  before(async () => {
    store = await Store.open(path.join(temp, 'store.json'))
  })
  after(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('derives a stage from review and known stats', () => {
    const pet = petState(store)
    assert.equal(pet.level, 1)
    assert.equal(pet.emoji, '🌱')
    assert.ok(pet.xp >= 0)
    assert.ok(pet.nextXp >= pet.xp)
  })
})
