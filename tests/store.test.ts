import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { Store } from '../src/store/store.js'
import type { Resource } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-store-'))
const storePath = path.join(temp, 'store.json')

function makeStoreItem() {
  const now = new Date().toISOString()
  return {
    id: 'retention-item',
    type: 'word_sense' as const,
    lemma: 'attention',
    sense: 'notice',
    definition: 'the act of noticing',
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'test',
    createdAt: now,
    updatedAt: now,
  }
}

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

    const revised = await store.addOutputRevision(entry.id, 'A clearer version.', new Date(day.getTime() + 60_000))
    assert.equal(revised.revisions?.length, 1)
    assert.equal(revised.revisions?.[0]?.text, 'A clearer version.')
    await assert.rejects(() => store.addOutputRevision(entry.id, 'A clearer version.'), /相同/)
    const revisionId = revised.revisions![0]!.id
    await store.saveOutputRevisionFeedback(entry.id, revisionId, {
      praise: 'Clearer.',
      upgrade: 'Add one example.',
      revision: 'A clearer version with an example.',
    })

    const reopened = await Store.open(outputPath)
    assert.equal(reopened.listOutputs(1)[0]?.text, 'The article makes a convincing case.')
    assert.equal(reopened.outputForDate(entry.date)?.answer, 'A reference answer.')
    assert.equal(reopened.getOutput(entry.id)?.revisions?.[0]?.feedback?.praise, 'Clearer.')
  })

  it('stores desired retention and counts only the first review per item', async () => {
    const retentionPath = path.join(temp, 'retention-store.json')
    const store = await Store.open(retentionPath)
    await store.upsertItems([makeStoreItem()])
    const now = new Date('2026-10-28T08:00:00Z')
    await store.applyReview('retention-item', 3, now)
    await store.applyReview('retention-item', 1, new Date(now.getTime() + 60_000))
    const stats = store.stats(now)
    assert.equal(stats.firstReviewed, 1)
    assert.equal(stats.firstCorrect, 1)
    assert.equal(stats.firstAccuracy, 1)

    const preferences = await store.setDesiredRetention(0.95)
    assert.equal(preferences.desiredRetention, 0.95)
    const reopened = await Store.open(retentionPath)
    assert.equal(reopened.preferences().desiredRetention, 0.95)
  })

  it('applies bulk status and favorite changes with a count', async () => {
    const bulkPath = path.join(temp, 'bulk-store.json')
    const store = await Store.open(bulkPath)
    const base = makeStoreItem()
    await store.upsertItems([
      { ...base, id: 'bulk-a', lemma: 'alpha' },
      { ...base, id: 'bulk-b', lemma: 'beta' },
    ])
    assert.equal(await store.setStatusMany(['bulk-a', 'bulk-b', 'missing'], 'suspended'), 2)
    assert.equal(store.getItem('bulk-a')?.status, 'suspended')
    assert.equal(await store.setStatusMany(['bulk-a', 'bulk-b'], 'suspended'), 0)
    assert.equal(await store.setFavoriteMany(['bulk-a', 'bulk-b'], true), 2)
    assert.equal(store.getItem('bulk-b')?.favorite, true)
    assert.equal(await store.setStatusMany(['bulk-a'], 'known'), 1)

    const reopened = await Store.open(bulkPath)
    assert.equal(reopened.getItem('bulk-a')?.status, 'known')
    assert.equal(reopened.getItem('bulk-b')?.favorite, true)
  })

  it('stores clamped weekly article and study-day goals', async () => {
    const goalPath = path.join(temp, 'weekly-goal-store.json')
    const store = await Store.open(goalPath)
    assert.equal(store.preferences().weeklyArticleGoal, 3)
    assert.equal(store.preferences().weeklyStudyDaysGoal, 5)
    const preferences = await store.setWeeklyGoals(6, 4)
    assert.equal(preferences.weeklyArticleGoal, 6)
    assert.equal(preferences.weeklyStudyDaysGoal, 4)
    const clamped = await store.setWeeklyGoals(-1, 20)
    assert.equal(clamped.weeklyArticleGoal, 0)
    assert.equal(clamped.weeklyStudyDaysGoal, 7)
  })

  it('stores clamped daily new and review targets', async () => {
    const goalPath = path.join(temp, 'goal-store.json')
    const store = await Store.open(goalPath)
    assert.equal(store.preferences().dailyNewTarget, 10)
    assert.equal(store.preferences().dailyReviewTarget, 10)

    const preferences = await store.setDailyTargets(4, 7)
    assert.equal(preferences.dailyNewTarget, 4)
    assert.equal(preferences.dailyReviewTarget, 7)

    const clamped = await store.setDailyTargets(-3, 250)
    assert.equal(clamped.dailyNewTarget, 0)
    assert.equal(clamped.dailyReviewTarget, 100)

    const reopened = await Store.open(goalPath)
    assert.equal(reopened.preferences().dailyNewTarget, 0)
    assert.equal(reopened.preferences().dailyReviewTarget, 100)
  })
})

describe('store safety', () => {
  it('keeps a last-good copy, a daily snapshot and serializes concurrent saves', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-backup-'))
    try {
      const file = path.join(dir, 'store.json')
      const store = await Store.open(file)
      await store.upsertItems([makeStoreItem()])
      await store.setFavorite('retention-item', true)

      const lastGood = JSON.parse(await fs.readFile(`${file}.bak`, 'utf8')) as { items: unknown[] }
      assert.equal(lastGood.items.length, 1)

      const snapshots = await store.snapshots()
      assert.equal(snapshots.length, 1)
      assert.match(snapshots[0]!, /^store-\d{4}-\d{2}-\d{2}\.json$/)
      const snapshotPath = path.join(dir, 'backups', snapshots[0]!)
      const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as { items: unknown[] }
      assert.equal(snapshot.items.length, 1)

      await Promise.all(
        Array.from({ length: 8 }, (_, index) => store.setFavorite('retention-item', index % 2 === 0)),
      )
      const final = JSON.parse(await fs.readFile(file, 'utf8')) as { version: number; items: Array<{ favorite: boolean }> }
      assert.equal(final.version, 2)
      assert.equal(final.items.length, 1)
      assert.equal(typeof final.items[0]?.favorite, 'boolean')
      assert.deepEqual(store.warnings(), [])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('quarantines an unreadable store instead of silently overwriting it', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-corrupt-'))
    try {
      const file = path.join(dir, 'store.json')
      const broken = '{"version":2,"items":['
      await fs.writeFile(file, broken, 'utf8')

      const store = await Store.open(file)
      const warnings = store.warnings()
      assert.equal(warnings.length, 1)
      assert.equal(warnings[0]?.code, 'corrupt-store')
      assert.equal(store.stats().total, 0)

      const quarantined = warnings[0]?.path
      assert.ok(quarantined)
      assert.equal(await fs.readFile(quarantined, 'utf8'), broken)
      await assert.rejects(fs.access(file))

      const reopened = await Store.open(file)
      assert.equal(reopened.warnings()[0]?.code, 'corrupt-store')
      assert.equal(reopened.warnings()[0]?.path, quarantined)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('quarantines a store with invalid field types', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-shape-'))
    try {
      const file = path.join(dir, 'store.json')
      await fs.writeFile(file, JSON.stringify({ version: 2, items: {} }), 'utf8')
      const store = await Store.open(file)
      assert.equal(store.warnings()[0]?.code, 'corrupt-store')
      assert.equal(store.stats().total, 0)
      const names = await fs.readdir(dir)
      assert.ok(names.some((name) => name.startsWith('store.json.corrupt-')))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('warns about a broken resource file without blocking the library', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-resource-warning-'))
    try {
      await fs.mkdir(path.join(dir, 'resources'), { recursive: true })
      await fs.writeFile(path.join(dir, 'resources', 'broken.json'), '{', 'utf8')
      const store = await Store.open(path.join(dir, 'store.json'))
      const warnings = store.warnings()
      assert.equal(warnings.length, 1)
      assert.equal(warnings[0]?.code, 'corrupt-resource')
      assert.match(warnings[0]?.message ?? '', /broken\.json/)
      assert.equal(store.listResources().length, 0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('opens a fresh store without warnings', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-fresh-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      assert.deepEqual(store.warnings(), [])
      assert.equal(store.stats().total, 0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('diagnosis', () => {
  it('saves a diagnosis and merges its known words', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-diagnosis-'))
    try {
      const file = path.join(dir, 'store.json')
      const store = await Store.open(file)
      await store.upsertItems([makeStoreItem()])
      await store.setStatus('retention-item', 'known')
      const diagnosis = await store.saveDiagnosis('C1', ['Ubiquitous', 'improve'], 24)
      assert.equal(diagnosis.level, 'C1')
      assert.equal(diagnosis.knownCount, 2)
      assert.deepEqual(diagnosis.knownLemmas, ['ubiquitous', 'improve'])

      const reopened = await Store.open(file)
      assert.equal(reopened.preferences().diagnosis?.level, 'C1')
      assert.deepEqual(reopened.knownLemmas().sort(), ['attention', 'improve', 'ubiquitous'].sort())
      assert.equal(reopened.preferences().diagnosis?.total, 24)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('review controls', () => {
  it('undoes the last rating and restores its pre-review state', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-undo-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      await store.upsertItems([makeStoreItem()])
      const before = structuredClone(store.getItem('retention-item')!.review)
      const now = new Date('2026-11-02T09:00:00+08:00')
      await store.applyReview('retention-item', 4, now)
      assert.equal(store.stats(now).reviewedToday, 1)

      const undone = await store.undoLastReview(now)
      assert.ok(undone)
      assert.equal(undone.item.id, 'retention-item')
      assert.deepEqual(store.getItem('retention-item')!.review, before)
      assert.equal(store.stats(now).reviewedToday, 0)
      assert.equal(await store.undoLastReview(now), undefined)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('counts unique cards per day and freezes the daily goal after review starts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-daily-unique-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      const make = (id: string, lemma: string) => ({ ...makeStoreItem(), id, lemma })
      await store.upsertItems([make('alpha', 'alpha'), make('beta', 'beta')])
      const now = new Date('2026-11-02T09:00:00+08:00')
      const initial = store.todayProgress(now)
      assert.equal(initial.dueAtStart, 2)

      await store.applyReview('alpha', 1, now)
      await store.applyReview('alpha', 1, now)
      await store.applyReview('alpha', 1, now)
      const afterRepeat = store.todayProgress(now)
      assert.equal(afterRepeat.reviewed, 1)
      assert.equal(store.stats(now).reviewedToday, 1)

      await store.applyReview('beta', 4, now)
      assert.equal(store.todayProgress(now).reviewed, 2)

      await store.upsertItems([make('gamma', 'gamma')])
      const afterAdding = store.todayProgress(now)
      assert.equal(afterAdding.dueAtStart, 2)
      assert.equal(afterAdding.reviewed, 2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('buckets due cards into today and the next days', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-forecast-'))
    try {
      const store = await Store.open(path.join(dir, 'store.json'))
      const make = (id: string) => ({ ...makeStoreItem(), id, lemma: id })
      await store.upsertItems([make('overdue'), make('today'), make('later')])
      const now = new Date('2026-11-02T09:00:00+08:00')
      for (const id of ['overdue', 'today', 'later']) store.getItem(id)!.review.reps = 1
      store.getItem('overdue')!.review.due = new Date('2026-11-01T09:00:00+08:00').toISOString()
      store.getItem('today')!.review.due = new Date('2026-11-02T12:00:00+08:00').toISOString()
      store.getItem('later')!.review.due = new Date('2026-11-04T12:00:00+08:00').toISOString()
      await store.save()

      const forecast = store.dueForecast(now)
      assert.equal(forecast.days.length, 7)
      assert.equal(forecast.days[0]?.due, 2)
      assert.equal(forecast.overdue, 1)
      assert.equal(forecast.days[2]?.due, 1)
      assert.equal(forecast.total, 3)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
