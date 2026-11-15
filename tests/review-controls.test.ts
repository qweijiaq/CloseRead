import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-controls-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { storePath } = await import('../src/config.js')
const { Store } = await import('../src/store/store.js')
const { startReviewServer } = await import('../src/review/server.js')
const { isLeech } = await import('../src/review/scheduler.js')

function makeItem() {
  const now = new Date().toISOString()
  return {
    id: 'control-item',
    type: 'word_sense' as const,
    lemma: 'attention',
    sense: 'mental focus',
    definition: 'the act of focusing the mind',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Control test',
    createdAt: now,
    updatedAt: now,
  }
}

describe('review controls', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let originalDue = ''

  before(async () => {
    const store = await Store.open(storePath())
    await store.upsertItems([makeItem()])
    originalDue = store.getItem('control-item')!.review.due
    server = await startReviewServer({ port: 0 })
  })

  after(async () => {
    await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('undoes the last rating through the API', async () => {
    const rated = (await fetch(`${server.url}/api/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'control-item', rating: 4 }),
    }).then((response) => response.json())) as { item: { due: string } }
    assert.notEqual(rated.item.due, originalDue)

    const undone = (await fetch(`${server.url}/api/review/undo`, { method: 'POST' }).then((response) =>
      response.json(),
    )) as { item: { due: string }; summary: { reviewedToday: number } }
    assert.equal(undone.item.due, originalDue)
    assert.equal(undone.summary.reviewedToday, 0)

    const again = await fetch(`${server.url}/api/review/undo`, { method: 'POST' })
    assert.equal(again.status, 409)
  })

  it('serves a seven-day forecast and flags leeches', async () => {
    await fetch(`${server.url}/api/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'control-item', rating: 1 }),
    })
    const forecast = (await fetch(`${server.url}/api/forecast`).then((response) => response.json())) as {
      days: Array<{ date: string; due: number }>
      overdue: number
      total: number
    }
    assert.equal(forecast.days.length, 7)
    assert.ok(forecast.total >= 1)
    assert.equal(isLeech({ lapses: 4 } as never), true)
    assert.equal(isLeech({ lapses: 3 } as never), false)
  })
})
