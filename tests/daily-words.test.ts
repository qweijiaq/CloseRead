import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { selectDailyWords } from '../src/review/daily-words.js'
import { Store } from '../src/store/store.js'
import type { LearningItem } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-daily-words-'))

function makeItem(id: string, lemma: string, sourceRef: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: 'sense',
    definition: 'definition',
    definitionZh: '释义',
    cefr: 'B2',
    contexts: [{ resourceId: 'r', resourceTitle: sourceRef, segmentIndex: 0, sentence: `${lemma} appears here.` }],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef,
    createdAt: now,
    updatedAt: now,
  }
}

describe('daily word selection', () => {
  it('groups a local fallback selection by source and reuses it for the day', async () => {
    const dir = path.join(temp, 'store.json')
    const store = await Store.open(dir)
    await store.upsertItems([
      makeItem('a', 'attention', 'Article A'),
      makeItem('b', 'friction', 'Article A'),
      makeItem('c', 'deliberate', 'Article B'),
    ])
    const selected = await selectDailyWords(store, 2, { useLlm: false })
    assert.equal(selected.source, 'heuristic')
    assert.equal(selected.theme, 'Article A')
    assert.equal(selected.ids.length, 2)
    assert.ok(selected.ids.every((id) => id === 'a' || id === 'b'))

    const cached = await selectDailyWords(store, 2, { useLlm: false })
    assert.equal(cached.source, 'cached')
    assert.deepEqual(cached.ids, selected.ids)

    const forced = await selectDailyWords(store, 2, { useLlm: false, force: true })
    assert.equal(forced.source, 'heuristic')
  })
})
