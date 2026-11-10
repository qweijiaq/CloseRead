import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { reviewHistory } from '../src/review/history.js'
import { Store } from '../src/store/store.js'
import type { LearningItem } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-history-'))

function makeItem(id: string, lemma: string, sourceRef: string, cefr: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: 'sense',
    definition: 'definition',
    cefr,
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef,
    createdAt: now,
    updatedAt: now,
  }
}

describe('review history', () => {
  it('groups daily reviews, retention, sources and CEFR levels', async () => {
    const dir = path.join(temp, 'history')
    const store = await Store.open(path.join(dir, 'store.json'))
    await store.upsertItems([
      makeItem('a', 'attention', 'Article A', 'B2'),
      makeItem('b', 'friction', 'Article A', 'C1'),
    ])
    await store.applyReview('a', 3, new Date('2026-11-06T10:00:00+08:00'))
    await store.applyReview('a', 1, new Date('2026-11-06T11:00:00+08:00'))
    await store.applyReview('b', 4, new Date('2026-11-05T10:00:00+08:00'))

    const history = reviewHistory(store, 3, new Date('2026-11-07T09:00:00+08:00'))
    assert.deepEqual(history.range, { start: '2026-11-05', end: '2026-11-07', days: 3 })
    assert.equal(history.totals.reviews, 3)
    assert.equal(history.totals.correct, 2)
    assert.equal(history.totals.unique, 2)
    assert.equal(history.totals.activeDays, 2)
    assert.equal(history.days[0]?.reviews, 1)
    assert.equal(history.days[1]?.reviews, 2)
    assert.equal(history.days[1]?.unique, 1)
    assert.equal(history.days[2]?.reviews, 0)
    assert.equal(history.sources[0]?.label, 'Article A')
    assert.equal(history.sources[0]?.reviews, 3)
    assert.equal(history.cefr[0]?.label, 'B2')
    assert.equal(history.cefr[0]?.retention, 0.5)
  })

  it('returns a complete empty range', async () => {
    const dir = path.join(temp, 'empty')
    const store = await Store.open(path.join(dir, 'store.json'))
    const history = reviewHistory(store, 14, new Date('2026-11-07T09:00:00+08:00'))
    assert.equal(history.days.length, 14)
    assert.equal(history.range.start, '2026-10-25')
    assert.equal(history.totals.reviews, 0)
    assert.deepEqual(history.sources, [])
    assert.ok(history.days.every((day) => day.reviews === 0))
  })
})
