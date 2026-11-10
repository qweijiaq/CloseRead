import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { achievementPayload } from '../src/review/achievements.js'
import { Store } from '../src/store/store.js'
import type { LearningItem } from '../src/types.js'

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'achievement-item',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'focus',
    definition: 'the act of focusing',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Achievement test',
    createdAt: now,
    updatedAt: now,
  }
}

describe('achievements', () => {
  it('derives badges and a 12-week activity calendar from existing records', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-achievements-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      await store.upsertItems([makeItem()])
      const now = new Date('2026-11-02T23:00:00+08:00')
      await store.applyReview('achievement-item', 3, now)
      await store.setStatus('achievement-item', 'known')
      await store.saveOutput({ text: 'I wrote three sentences today.', prompt: 'Why?' }, now)

      const packDir = path.join(dir, 'packs', 'achievement-pack')
      await fs.mkdir(packDir, { recursive: true })
      await fs.writeFile(
        path.join(packDir, 'reading.json'),
        JSON.stringify({
          packId: 'achievement-pack',
          totalParagraphs: 1,
          readParagraphs: [0],
          lastParagraph: 0,
          startedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          finishedAt: now.toISOString(),
        }),
        'utf8',
      )
      await store.addPack({
        id: 'achievement-pack',
        resourceId: 'achievement-resource',
        dir: packDir,
        mode: 'heuristic',
        itemCount: 1,
        createdAt: now.toISOString(),
      })

      const payload = await achievementPayload(store, now)
      assert.equal(payload.activity.length, 84)
      assert.equal(payload.activity.at(-1)?.date, '2026-11-02')
      assert.ok((payload.activity.at(-1)?.count ?? 0) >= 1)
      assert.ok(payload.studyDays >= 1)
      assert.equal(payload.total, 10)
      assert.ok(payload.earned >= 2)

      const byId = new Map(payload.badges.map((badge) => [badge.id, badge]))
      assert.equal(byId.get('first-read')?.earned, true)
      assert.equal(byId.get('night-owl')?.earned, true)
      assert.equal(byId.get('known-50')?.progress, 1)
      assert.equal(byId.get('known-50')?.earned, false)
      assert.equal(byId.get('outputs-10')?.progress, 1)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
