import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { Store } from '../src/store/store.js'
import type { Resource } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-store-'))
const storePath = path.join(temp, 'store.json')

function makeResource(): Resource {
  return {
    id: 'legacy-resource',
    title: 'Legacy resource',
    kind: 'text',
    source: 'pasted',
    text: 'A sufficiently long source text for the resource file.',
    wordCount: 9,
    segments: [],
    metadata: {},
    createdAt: new Date().toISOString(),
  }
}

describe('store v2', () => {
  before(async () => {
    await fs.writeFile(
      storePath,
      JSON.stringify({
        version: 1,
        resources: [makeResource()],
        items: [],
        packs: [],
        logs: [],
      }),
    )
  })

  after(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('migrates resources out of store.json and loads them from files', async () => {
    const store = await Store.open(storePath)
    assert.equal(store.listResources().length, 1)
    assert.equal(store.getResource('legacy-resource')?.title, 'Legacy resource')

    const storeFile = JSON.parse(await fs.readFile(storePath, 'utf8')) as {
      version: number
      resources?: unknown
    }
    assert.equal(storeFile.version, 2)
    assert.equal(storeFile.resources, undefined)

    const resourceFile = JSON.parse(
      await fs.readFile(path.join(temp, 'resources', 'legacy-resource.json'), 'utf8'),
    ) as Resource
    assert.equal(resourceFile.title, 'Legacy resource')
  })

  it('writes added resources to their own file', async () => {
    const store = await Store.open(storePath)
    const resource = { ...makeResource(), id: 'new-resource', title: 'New resource' }
    await store.addResource(resource)
    const saved = JSON.parse(
      await fs.readFile(path.join(temp, 'resources', 'new-resource.json'), 'utf8'),
    ) as Resource
    assert.equal(saved.title, 'New resource')
    assert.ok(store.getResource('new-resource'))

    const reopened = await Store.open(storePath)
    assert.ok(reopened.getResource('new-resource'))
  })

  it('tracks the daily loop and the completion streak', async () => {
    const dailyPath = path.join(temp, 'daily-store.json')
    const store = await Store.open(dailyPath)
    const day = new Date('2026-10-28T08:00:00Z')
    const first = store.todayProgress(day)
    assert.equal(first.dueAtStart, 0)
    assert.equal(first.completed, false)

    await store.recordDailyArticle('pack-1', 'First article', day)
    assert.equal(store.todayProgress(day).completed, false)
    await store.markArticleRead('pack-1', 'First article', day)
    await store.saveOutput({ text: 'Today I wrote three sentences.', prompt: 'Why?' }, day)
    assert.equal(store.todayProgress(day).articleFinished, true)
    assert.equal(store.todayProgress(day).completed, true)
    assert.equal(store.preferences().streak, 1)

    const nextDay = new Date('2026-10-29T08:00:00Z')
    const reset = store.todayProgress(nextDay)
    assert.equal(reset.completed, false)
    assert.equal(reset.reviewed, 0)
    await store.recordDailyArticle('pack-2', 'Second article', nextDay)
    await store.markArticleRead('pack-2', 'Second article', nextDay)
    await store.saveOutput({ text: 'A second day of writing.', prompt: 'What changed?' }, nextDay)
    assert.equal(store.preferences().streak, 2)

    const reopened = await Store.open(dailyPath)
    assert.equal(reopened.preferences().streak, 2)
    assert.equal(reopened.preferences().daily.articlePackId, 'pack-2')
  })

  it('stores feedback for selection count and removed words', async () => {
    const feedbackPath = path.join(temp, 'feedback-store.json')
    const store = await Store.open(feedbackPath)
    await store.adjustSelectionBias(2)
    await store.adjustSelectionBias(-1)
    assert.equal(store.preferences().selectionBias, 1)

    await store.recordWordFeedback('Heavy', -2)
    await store.recordWordFeedback('heavy', -2)
    assert.equal(store.preferences().wordFeedback.heavy, -3)
  })

  it('saves written output with its prompt and keeps history', async () => {
    const outputPath = path.join(temp, 'output-store.json')
    const store = await Store.open(outputPath)
    const day = new Date('2026-10-28T08:00:00Z')
    const entry = await store.saveOutput(
      {
        text: '  The article makes a convincing case.  ',
        prompt: 'What do you think?',
        answer: 'A reference answer.',
        packId: 'pack-1',
        articleTitle: 'Article one',
      },
      day,
    )
    assert.equal(entry.text, 'The article makes a convincing case.')
    assert.equal(store.todayProgress(day).outputDone, true)
    assert.equal(store.outputForDate(entry.date)?.id, entry.id)
    assert.equal(store.listOutputs(5)[0]?.articleTitle, 'Article one')

    const reopened = await Store.open(outputPath)
    assert.equal(reopened.listOutputs(1)[0]?.text, 'The article makes a convincing case.')
    assert.equal(reopened.outputForDate(entry.date)?.answer, 'A reference answer.')
  })
})
