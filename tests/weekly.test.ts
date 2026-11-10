import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { weeklyPayload } from '../src/review/weekly.js'
import { weeklyMarkdown } from '../src/review/weekly-report.js'
import { Store } from '../src/store/store.js'
import type { LearningItem } from '../src/types.js'

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'weekly-item',
    type: 'word_sense',
    lemma: 'ubiquitous',
    sense: 'everywhere',
    definition: 'present everywhere',
    definitionZh: '无处不在的',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Weekly test',
    createdAt: now,
    updatedAt: now,
  }
}

describe('weekly review', () => {
  it('summarizes reviews, misses, new items and study days', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-weekly-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      await store.upsertItems([makeItem()])
      const now = new Date('2026-11-02T09:00:00+08:00')
      await store.applyReview('weekly-item', 1, now)
      await store.applyReview('weekly-item', 4, new Date(now.getTime() + 60_000))
      await store.saveDiagnosis('B2', ['ubiquitous'], 24)

      const payload = await weeklyPayload(store, now)
      assert.equal(payload.range.days, 7)
      assert.equal(payload.range.end, '2026-11-02')
      assert.equal(payload.reviews.total, 2)
      assert.equal(payload.reviews.correct, 1)
      assert.equal(payload.reviews.accuracy, 0.5)
      assert.equal(payload.reviews.firstTotal, 1)
      assert.equal(payload.reviews.firstCorrect, 0)
      assert.equal(payload.newItems, 1)
      assert.equal(payload.studyDays, 1)
      assert.equal(payload.articles.finished, 0)
      assert.equal(payload.outputs.count, 0)
      assert.equal(payload.level, 'B2')
      assert.deepEqual(payload.goals, { articles: 3, studyDays: 5 })
      assert.equal(payload.missed[0]?.lemma, 'ubiquitous')
      assert.equal(payload.missed[0]?.misses, 1)
      assert.match(payload.suggestion, /ubiquitous/)

      const markdown = weeklyMarkdown(payload)
      assert.match(markdown, /^# CloseRead 本周复盘/)
      assert.match(markdown, /2026-10-27 → 2026-11-02/)
      assert.match(markdown, /复习：2 次，正确率 50%/)
      assert.match(markdown, /本周目标：文章 0 \/ 3 篇，学习 1 \/ 5 天/)
      assert.match(markdown, /\| ubiquitous \| 无处不在的 \| 1 \|/)
      assert.match(markdown, /## 下周建议/)
      assert.ok(markdown.endsWith('\n'))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
