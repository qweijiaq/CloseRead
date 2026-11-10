import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { strToU8, zipSync } from 'fflate'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-data-'))
const tempPacks = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-packs-'))
process.env.LEARN_DATA_DIR = tempData
process.env.LEARN_PACKS_DIR = tempPacks

const { storePath } = await import('../src/config.js')
const { startReviewServer } = await import('../src/review/server.js')
const { Store } = await import('../src/store/store.js')
const { newReviewState } = await import('../src/review/scheduler.js')

function makeItem() {
  const now = new Date().toISOString()
  return {
    id: 'test-item',
    type: 'word_sense' as const,
    lemma: 'attention',
    sense: 'mental focus',
    pos: 'noun',
    definition: 'the act of focusing the mind',
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Resource',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
      },
    ],
    collocations: ['pay attention'],
    examples: [{ text: 'Pay attention.', origin: 'generated' as const }],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
  }
}

describe('review server', { concurrency: 1 }, () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>

  before(async () => {
    const store = await Store.open(storePath)
    await store.upsertItems([makeItem()])
    await store.addPack({
      id: 'pack-filter',
      resourceId: 'r',
      dir: '/tmp/nonexistent-pack-filter',
      mode: 'heuristic',
      itemCount: 1,
      createdAt: new Date().toISOString(),
    })
    server = await startReviewServer({ port: 0 })
  })

  after(async () => {
    await server.close()
    await fs.rm(tempData, { recursive: true, force: true })
    await fs.rm(tempPacks, { recursive: true, force: true })
  })

  it('serves the bookmarklet and stores retention preferences', async () => {
    const bookmarklet = await fetch(`${server.url}/bookmarklet`)
    assert.equal(bookmarklet.status, 200)
    const html = await bookmarklet.text()
    assert.ok(html.includes('javascript:'))
    assert.ok(html.includes('?import='))

    const manifest = await fetch(`${server.url}/manifest.webmanifest`)
    assert.equal(manifest.status, 200)
    assert.match(manifest.headers.get('content-type') ?? '', /application\/manifest\+json/)
    assert.equal(((await manifest.json()) as { display: string }).display, 'standalone')

    const icon = await fetch(`${server.url}/icon-192.png`)
    assert.equal(icon.status, 200)
    assert.equal(icon.headers.get('content-type'), 'image/png')
    assert.equal((await icon.arrayBuffer()).byteLength > 500, true)

    const worker = await fetch(`${server.url}/sw.js`)
    assert.equal(worker.status, 200)
    assert.match(await worker.text(), /closeread-static-v1/)

    const initial = (await fetch(`${server.url}/api/preferences`).then((response) => response.json())) as {
      preferences: { desiredRetention: number; dailyNewTarget: number; dailyReviewTarget: number }
    }
    assert.equal(typeof initial.preferences.desiredRetention, 'number')
    assert.equal(initial.preferences.dailyNewTarget, 10)
    assert.equal(initial.preferences.dailyReviewTarget, 10)

    const saved = (await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ desiredRetention: 0.95 }),
    }).then((response) => response.json())) as { preferences: { desiredRetention: number } }
    assert.equal(saved.preferences.desiredRetention, 0.95)

    const goals = (await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dailyNewTarget: 3, dailyReviewTarget: 6 }),
    }).then((response) => response.json())) as {
      preferences: { dailyNewTarget: number; dailyReviewTarget: number }
    }
    assert.equal(goals.preferences.dailyNewTarget, 3)
    assert.equal(goals.preferences.dailyReviewTarget, 6)

    const invalid = await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ desiredRetention: 0.5 }),
    })
    assert.equal(invalid.status, 400)

    const invalidGoals = await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dailyNewTarget: -1 }),
    })
    assert.equal(invalidGoals.status, 400)

    const weekly = (await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weeklyArticleGoal: 4, weeklyStudyDaysGoal: 3 }),
    }).then((response) => response.json())) as {
      preferences: { weeklyArticleGoal: number; weeklyStudyDaysGoal: number }
    }
    assert.equal(weekly.preferences.weeklyArticleGoal, 4)
    assert.equal(weekly.preferences.weeklyStudyDaysGoal, 3)

    const invalidWeekly = await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weeklyStudyDaysGoal: 8 }),
    })
    assert.equal(invalidWeekly.status, 400)

    await fetch(`${server.url}/api/preferences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        desiredRetention: 0.9,
        dailyNewTarget: 10,
        dailyReviewTarget: 10,
        weeklyArticleGoal: 3,
        weeklyStudyDaysGoal: 5,
      }),
    })
  })

  it('serves the summary and due queue', async () => {
    const summary = (await fetch(`${server.url}/api/summary`).then((response) => response.json())) as {
      summary: { total: number; due: number }
    }
    assert.equal(summary.summary.total, 1)
    assert.equal(summary.summary.due, 1)

    const queue = (await fetch(`${server.url}/api/queue?limit=10`).then((response) => response.json())) as {
      items: Array<{ id: string; lemma: string }>
    }
    assert.equal(queue.items.length, 1)
    assert.equal(queue.items[0]?.id, 'test-item')
    assert.equal(queue.items[0]?.lemma, 'attention')

    const history = (await fetch(`${server.url}/api/history?days=3`).then((response) => response.json())) as {
      history: { range: { days: number; start: string }; days: unknown[] }
    }
    assert.equal(history.history.range.days, 3)
    assert.equal(history.history.days.length, 3)
    assert.match(history.history.range.start, /^\d{4}-\d{2}-\d{2}$/)

    const weeklyExport = await fetch(`${server.url}/api/weekly/export`)
    assert.equal(weeklyExport.status, 200)
    assert.match(weeklyExport.headers.get('content-type') ?? '', /text\/markdown/)
    assert.match(weeklyExport.headers.get('content-disposition') ?? '', /closeread-weekly-/)
    assert.match(await weeklyExport.text(), /^# CloseRead 本周复盘/)

    const backup = await fetch(`${server.url}/api/backup`)
    assert.equal(backup.status, 200)
    assert.match(backup.headers.get('content-disposition') ?? '', /closeread-backup-/)
    const payload = (await backup.json()) as { format: string; store: { items: unknown[] } }
    assert.equal(payload.format, 'closeread-library')
    assert.equal(payload.store.items.length, 1)

    const styles = (await fetch(`${server.url}/api/styles`).then((response) => response.json())) as {
      styles: Array<{ name: string }>
    }
    assert.ok(Array.isArray(styles.styles))

    const settings = (await fetch(`${server.url}/api/settings`).then((response) => response.json())) as {
      dataDir: string
      packsDir: string
      trash: unknown[]
      usage: { calls: number }
    }
    assert.ok(settings.dataDir)
    assert.ok(settings.packsDir)
    assert.deepEqual(settings.trash, [])
    assert.equal(typeof settings.usage.calls, 'number')

    const trash = (await fetch(`${server.url}/api/trash`).then((response) => response.json())) as {
      entries: unknown[]
    }
    assert.deepEqual(trash.entries, [])

    const backupText = await fetch(`${server.url}/api/backup`).then((response) => response.text())
    const restored = await fetch(`${server.url}/api/restore`, {
      method: 'POST',
      body: backupText,
    })
    assert.equal(restored.status, 200)
    const restoredPayload = (await restored.json()) as { ok: boolean; result: { items: number } }
    assert.equal(restoredPayload.ok, true)
    assert.equal(restoredPayload.result.items, 1)
  })

  it('sorts the vocabulary library by letters, CEFR and frequency', async () => {
    const base = makeItem()
    await server.store.upsertItems([
      { ...base, id: 'sort-zeta', lemma: 'zeta', cefr: 'C1', frequencyRank: 100 },
      { ...base, id: 'sort-alpha', lemma: 'alpha', cefr: 'A2', frequencyRank: 500 },
    ])
    try {
      const lemmas = async (sort: string) => {
        const data = (await fetch(`${server.url}/api/vocab?sort=${sort}&type=word&limit=10`).then((response) =>
          response.json(),
        )) as { items: Array<{ id: string }> }
        return data.items.map((item) => item.id)
      }
      const alpha = await lemmas('alpha')
      assert.ok(alpha.indexOf('sort-alpha') < alpha.indexOf('sort-zeta'))
      const cefr = await lemmas('cefr')
      assert.ok(cefr.indexOf('sort-alpha') < cefr.indexOf('sort-zeta'))
      const frequency = await lemmas('frequency')
      assert.ok(frequency.indexOf('sort-zeta') < frequency.indexOf('sort-alpha'))
    } finally {
      await server.store.removeItems(['sort-zeta', 'sort-alpha'])
    }
  })

  it('marks matching library words as known from a pasted list', async () => {
    const base = makeItem()
    await server.store.upsertItems([
      { ...base, id: 'known-alpha', lemma: 'alpha' },
      { ...base, id: 'known-beta', lemma: 'beta' },
    ])
    try {
      const first = (await fetch(`${server.url}/api/vocab/known`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'alpha\nbeta\ngamma' }),
      }).then((response) => response.json())) as {
        words: number
        matchedWords: number
        itemsUpdated: number
        unknownCount: number
      }
      assert.equal(first.words, 3)
      assert.equal(first.matchedWords, 2)
      assert.equal(first.itemsUpdated, 2)
      assert.equal(first.unknownCount, 1)

      const again = (await fetch(`${server.url}/api/vocab/known`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'alpha' }),
      }).then((response) => response.json())) as { itemsUpdated: number; alreadyKnown: number }
      assert.equal(again.itemsUpdated, 0)
      assert.equal(again.alreadyKnown, 1)
    } finally {
      await server.store.removeItems(['known-alpha', 'known-beta'])
    }
  })

  it('serves chapter navigation for article packs', async () => {
    const now = new Date().toISOString()
    await server.store.addPack({
      id: 'chapter-a',
      resourceId: 'chapter-r',
      dir: '/tmp/chapter-a',
      mode: 'heuristic',
      itemCount: 0,
      createdAt: now,
      title: 'Chapter A',
      parentResourceId: 'chapter-parent',
      articleIndex: 0,
    })
    await server.store.addPack({
      id: 'chapter-b',
      resourceId: 'chapter-r',
      dir: '/tmp/chapter-b',
      mode: 'heuristic',
      itemCount: 0,
      createdAt: now,
      title: 'Chapter B',
      parentResourceId: 'chapter-parent',
      articleIndex: 1,
    })
    try {
      const first = (await fetch(`${server.url}/api/packs/chapter-a/neighbors`).then((response) =>
        response.json(),
      )) as { chapter: { index: number; total: number; next: { id: string } | null } }
      assert.equal(first.chapter.index, 1)
      assert.equal(first.chapter.total, 2)
      assert.equal(first.chapter.next?.id, 'chapter-b')
      const second = (await fetch(`${server.url}/api/packs/chapter-b/neighbors`).then((response) =>
        response.json(),
      )) as { chapter: { index: number; previous: { id: string } | null } }
      assert.equal(second.chapter.index, 2)
      assert.equal(second.chapter.previous?.id, 'chapter-a')
    } finally {
      await server.store.removePack('chapter-a')
      await server.store.removePack('chapter-b')
    }
  })

  it('stores and deletes reader annotations', async () => {
    const dir = path.join(tempPacks, 'pack-annotations')
    await server.store.addPack({
      id: 'pack-annotations',
      resourceId: 'r-annotations',
      dir,
      mode: 'heuristic',
      itemCount: 0,
      createdAt: new Date().toISOString(),
    })
    try {
      const added = (await fetch(`${server.url}/api/packs/pack-annotations/annotations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paragraph: 0, quote: 'Attention is scarce.', note: '核心句' }),
      }).then((response) => response.json())) as {
        annotation: { id: string; quote: string; note: string }
      }
      assert.equal(added.annotation.quote, 'Attention is scarce.')
      assert.equal(added.annotation.note, '核心句')
      const reading = (await fetch(`${server.url}/api/packs/pack-annotations/reading`).then((response) =>
        response.json(),
      )) as { progress: { annotations: Array<{ id: string }> } }
      assert.equal(reading.progress.annotations.length, 1)
      const removed = await fetch(
        `${server.url}/api/packs/pack-annotations/annotations/${encodeURIComponent(added.annotation.id)}`,
        { method: 'DELETE' },
      )
      assert.equal(removed.status, 200)
      const after = (await fetch(`${server.url}/api/packs/pack-annotations/reading`).then((response) =>
        response.json(),
      )) as { progress: { annotations: unknown[] } }
      assert.deepEqual(after.progress.annotations, [])
    } finally {
      await server.store.removePack('pack-annotations')
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('serves the daily loop and records output completion', async () => {
    const today = (await fetch(`${server.url}/api/today`).then((response) => response.json())) as {
      steps: {
        review: { done: boolean; dueAtStart: number; reviewed: number; remaining: number }
        article: { done: boolean }
        output: { done: boolean }
      }
      streak: number
      warnings: unknown[]
    }
    assert.deepEqual(today.warnings, [])
    assert.equal(today.steps.review.dueAtStart, 1)
    assert.equal(today.steps.review.done, false)
    assert.equal(today.steps.review.remaining, 1)
    assert.equal(today.steps.article.done, false)
    assert.equal(today.steps.output.done, false)

    const completed = (await fetch(`${server.url}/api/today/output`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'The article makes a convincing case.' }),
    }).then((response) => response.json())) as {
      output: { text: string }
      today: { steps: { output: { done: boolean; text: string | null } } }
    }
    assert.equal(completed.output.text, 'The article makes a convincing case.')
    // 输出在精读完成前只记录、不显示为完成，避免“没读先写完”的状态
    assert.equal(completed.today.steps.output.done, false)

    const feedback = (await fetch(`${server.url}/api/feedback/selection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ delta: 1 }),
    }).then((response) => response.json())) as { selectionBias: number }
    assert.equal(feedback.selectionBias, 1)

    const invalid = await fetch(`${server.url}/api/feedback/selection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ delta: 5 }),
    })
    assert.equal(invalid.status, 400)
  })

  it('filters the queue by pack and rejects an unknown pack', async () => {
    const filtered = (await fetch(`${server.url}/api/queue?limit=10&pack=pack-filter`).then((response) =>
      response.json(),
    )) as {
      items: Array<{ id: string }>
      pack: { id: string; title: string; due: number }
    }
    assert.ok(filtered.items.length <= 1)
    assert.ok(filtered.items.every((item) => item.id === 'test-item'))
    assert.equal(filtered.pack.id, 'pack-filter')
    assert.equal(typeof filtered.pack.due, 'number')

    const missing = await fetch(`${server.url}/api/queue?pack=missing-pack`)
    assert.equal(missing.status, 404)

    const sentencesOnly = (await fetch(`${server.url}/api/queue?type=sentence`).then((response) =>
      response.json(),
    )) as { items: Array<{ type: string }>; filter: { type: string; due: number } }
    assert.equal(sentencesOnly.items.length, 0)
    assert.equal(sentencesOnly.filter.type, 'sentence')
    assert.equal(sentencesOnly.filter.due, 0)
  })

  it('deletes a pack record', async () => {
    const deleted = (await fetch(`${server.url}/api/packs/pack-filter/delete`, { method: 'POST' }).then((response) =>
      response.json(),
    )) as { ok: boolean; packs: number }
    assert.equal(deleted.ok, true)
    assert.equal(deleted.packs, 0)
  })

  it('updates editable card fields without resetting review state', async () => {
    const before = (await fetch(`${server.url}/api/items/test-item`).then((response) => response.json())) as {
      item: { review: { due: string }; definitionZh?: string }
    }
    const updated = (await fetch(`${server.url}/api/items/test-item/update`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sense: 'focused attention',
        definitionZh: '注意力',
        notes: 'edited in test',
        collocations: ['pay attention', 'pay attention'],
      }),
    }).then((response) => response.json())) as {
      item: { sense: string; definitionZh: string; notes: string; collocations: string[]; review: { due: string } }
    }
    assert.equal(updated.item.sense, 'focused attention')
    assert.equal(updated.item.definitionZh, '注意力')
    assert.equal(updated.item.notes, 'edited in test')
    assert.deepEqual(updated.item.collocations, ['pay attention'])
    assert.equal(updated.item.review.due, before.item.review.due)
  })

  it('serves a word graph', async () => {
    const graph = (await fetch(`${server.url}/api/graph`).then((result) => result.json())) as {
      nodes: Array<{ lemma: string }>
      edges: unknown[]
      stats: { items: number; isolated: number }
    }
    assert.equal(graph.stats.items, 1)
    assert.equal(graph.stats.isolated, 1)
    assert.equal(graph.nodes[0]?.lemma, 'attention')
    assert.equal(graph.edges.length, 0)
  })

  it('records a rating and reschedules the item', async () => {
    const initial = newReviewState(new Date())
    const response = (await fetch(`${server.url}/api/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item', rating: 3 }),
    }).then((result) => result.json())) as { ok: boolean; item: { due: string; state: string } }

    assert.equal(response.ok, true)
    assert.ok(new Date(response.item.due).getTime() > new Date(initial.due).getTime())
    assert.ok(new Date(response.item.due).getTime() > Date.now() + 30_000)
  })

  it('completes the daily loop after reading an article and writing output', async () => {
    await server.store.addPack({
      id: 'pack-today',
      resourceId: 'r',
      dir: path.join(tempPacks, 'pack-today'),
      mode: 'heuristic',
      itemCount: 1,
      title: 'Today article',
      createdAt: new Date().toISOString(),
    })
    await server.store.recordDailyArticle('pack-today', 'Today article')

    const before = (await fetch(`${server.url}/api/today`).then((result) => result.json())) as {
      steps: { article: { done: boolean } }
    }
    assert.equal(before.steps.article.done, false)

    const started = (await fetch(`${server.url}/api/packs/pack-today/reading`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ readParagraphs: [0, 1], lastParagraph: 1, totalParagraphs: 2 }),
    }).then((result) => result.json())) as {
      progress: { readParagraphs: number[]; total: number; finishedAt: string | null }
    }
    assert.deepEqual(started.progress.readParagraphs, [0, 1])
    assert.equal(started.progress.total, 2)
    assert.equal(started.progress.finishedAt, null)

    const loaded = (await fetch(`${server.url}/api/packs/pack-today/reading`).then((result) =>
      result.json(),
    )) as { progress: { readParagraphs: number[]; total: number } }
    assert.deepEqual(loaded.progress.readParagraphs, [0, 1])
    assert.equal(loaded.progress.total, 2)

    const finished = (await fetch(`${server.url}/api/packs/pack-today/reading`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ finished: true }),
    }).then((result) => result.json())) as {
      progress: { finishedAt: string | null }
    }
    assert.ok(finished.progress.finishedAt)

    const today = (await fetch(`${server.url}/api/today`).then((result) => result.json())) as {
      completed: boolean
      streak: number
      steps: {
        review: { done: boolean }
        article: { done: boolean; title: string | null }
        output: { done: boolean; text: string | null }
      }
    }
    assert.equal(today.steps.article.done, true)
    assert.equal(today.steps.article.title, 'Today article')
    assert.equal(today.steps.output.done, true)
    assert.equal(today.steps.output.text, 'The article makes a convincing case.')
    assert.equal(today.completed, true)
    assert.equal(today.streak, 1)
  })

  it('toggles favorites and status', async () => {
    const favorite = (await fetch(`${server.url}/api/favorite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item', favorite: true }),
    }).then((result) => result.json())) as { ok: boolean; item: { favorite: boolean } }
    assert.equal(favorite.item.favorite, true)

    const known = (await fetch(`${server.url}/api/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item', status: 'known' }),
    }).then((result) => result.json())) as { ok: boolean; item: { status: string } }
    assert.equal(known.item.status, 'known')

    const bulk = (await fetch(`${server.url}/api/items/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['test-item', 'missing-item'], action: 'active' }),
    }).then((result) => result.json())) as { ok: boolean; count: number }
    assert.equal(bulk.ok, true)
    assert.equal(bulk.count, 1)

    const invalidBulk = await fetch(`${server.url}/api/items/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [], action: 'known' }),
    })
    assert.equal(invalidBulk.status, 400)
  })

  it('saves manual sentence boundaries and rejects rewrites', async () => {
    const dir = path.join(tempPacks, 'pack-sentences')
    await fs.mkdir(dir, { recursive: true })
    const now = new Date().toISOString()
    const pack = {
      id: 'pack-sentences',
      resourceId: 'r',
      title: 'Sentence boundaries',
      source: 'sample',
      mode: 'llm',
      generatedAt: now,
      summary: 'Summary',
      difficulty: { cefr: 'B1', reason: 'test' },
      stats: { wordCount: 12, itemCount: 0, readingMinutes: 1 },
      items: [],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [{ index: 0, original: 'Attention is scarce. Focus is hard.', itemIds: [] }],
    }
    await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(pack), 'utf8')
    await server.store.addPack({
      id: 'pack-sentences',
      resourceId: 'r',
      dir,
      mode: 'llm',
      itemCount: 0,
      title: 'Sentence boundaries',
      createdAt: now,
    })

    const split = (await fetch(`${server.url}/api/pack/pack-sentences/reading/sentences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ index: 0, sentences: ['Attention is', 'scarce. Focus is hard.'] }),
    }).then((result) => result.json())) as { ok: boolean; sentences: string[]; default: boolean }
    assert.equal(split.ok, true)
    assert.deepEqual(split.sentences, ['Attention is', 'scarce. Focus is hard.'])
    assert.equal(split.default, false)

    const saved = JSON.parse(await fs.readFile(path.join(dir, 'pack.json'), 'utf8')) as {
      reading: Array<{ customSentences?: string[] }>
    }
    assert.deepEqual(saved.reading[0]?.customSentences, ['Attention is', 'scarce. Focus is hard.'])

    const rejected = await fetch(`${server.url}/api/pack/pack-sentences/reading/sentences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ index: 0, sentences: ['Attention matters.', 'Focus is hard.'] }),
    })
    assert.equal(rejected.status, 400)

    const reset = (await fetch(`${server.url}/api/pack/pack-sentences/reading/sentences`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ index: 0, sentences: ['Attention is scarce.', 'Focus is hard.'] }),
    }).then((result) => result.json())) as { default: boolean }
    assert.equal(reset.default, true)
    const cleaned = JSON.parse(await fs.readFile(path.join(dir, 'pack.json'), 'utf8')) as {
      reading: Array<{ customSentences?: string[] }>
    }
    assert.equal(cleaned.reading[0]?.customSentences, undefined)

    await fetch(`${server.url}/api/packs/pack-sentences/delete`, { method: 'POST' })
  })

  it('imports pasted text and lists it for building', async () => {
    const text =
      'Every morning, millions of people reach for a small rectangle of glass. Before they speak to another person, they have given a piece of their attention away.\n\nThe exchange feels free, but it is not. Attention is the currency, and the bill arrives later.'
    const response = (await fetch(`${server.url}/api/import/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, title: 'Imported article' }),
    }).then((result) => result.json())) as {
      ok: boolean
      resource: { id: string; title: string; kind: string; wordCount: number; pack: null; warnings: string[] }
    }

    assert.equal(response.ok, true)
    assert.equal(response.resource.title, 'Imported article')
    assert.equal(response.resource.kind, 'text')
    assert.equal(response.resource.pack, null)
    assert.ok(response.resource.wordCount > 30)

    const list = (await fetch(`${server.url}/api/resources`).then((result) => result.json())) as {
      resources: Array<{ id: string; title: string }>
      llm: boolean
    }
    assert.equal(list.resources[0]?.id, response.resource.id)
    assert.equal(typeof list.llm, 'boolean')

    const duplicate = await fetch(`${server.url}/api/import/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, title: 'Imported article' }),
    })
    assert.equal(duplicate.status, 409)
    const duplicateData = (await duplicate.json()) as { existing: { id: string } }
    assert.equal(duplicateData.existing.id, response.resource.id)

    const deleted = (await fetch(`${server.url}/api/resources/${response.resource.id}/delete`, {
      method: 'POST',
    }).then((result) => result.json())) as { ok: boolean; removedPacks: number; removedItems: number }
    assert.equal(deleted.ok, true)
    assert.equal(deleted.removedPacks, 0)
    assert.equal(deleted.removedItems, 0)
    const afterDelete = (await fetch(`${server.url}/api/resources`).then((result) => result.json())) as {
      resources: Array<{ id: string }>
    }
    assert.ok(!afterDelete.resources.some((resource) => resource.id === response.resource.id))
  })

  it('rejects empty and too-short text imports', async () => {
    const empty = await fetch(`${server.url}/api/import/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })
    assert.equal(empty.status, 400)

    const short = await fetch(`${server.url}/api/import/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Too short.' }),
    })
    assert.equal(short.status, 400)
    const data = (await short.json()) as { error: string }
    assert.match(data.error, /too little text/i)
  })

  it('imports an uploaded MOBI file', async () => {
    const buffer = await fs.readFile(new URL('./fixtures/alice.mobi', import.meta.url))
    const response = await fetch(`${server.url}/api/import/ebook?name=alice.mobi`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-mobipocket-ebook' },
      body: buffer,
    })
    const data = (await response.json()) as {
      ok: boolean
      resource: { kind: string; title: string; wordCount: number }
    }
    assert.equal(response.status, 200)
    assert.equal(data.ok, true)
    assert.equal(data.resource.kind, 'mobi')
    assert.match(data.resource.title, /Alice/i)
    assert.ok(data.resource.wordCount > 1000)
  })

  it('imports an uploaded DOCX file', async () => {
    const body = 'Attention is scarce, so a deliberate reading habit protects the mind from noise. '.repeat(3)
    const document = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:body></w:document>`
    const core =
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Docx Import</dc:title></cp:coreProperties>'
    const buffer = Buffer.from(
      zipSync({
        'word/document.xml': strToU8(document),
        'docProps/core.xml': strToU8(core),
      }),
    )
    const response = await fetch(`${server.url}/api/import/ebook?name=reading.docx`, {
      method: 'POST',
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: buffer,
    })
    const data = (await response.json()) as {
      ok: boolean
      resource: { kind: string; title: string; wordCount: number }
    }
    assert.equal(response.status, 200)
    assert.equal(data.ok, true)
    assert.equal(data.resource.kind, 'text')
    assert.equal(data.resource.title, 'Docx Import')
    assert.ok(data.resource.wordCount > 10)
  })

  it('lists article boundaries and rejects an invalid article build', async () => {
    const body =
      'This is a sufficiently long article body that should be treated as a real study unit by the editorial filter. '.repeat(
        12,
      )
    const text = [`# First Article`, '', body, '', `# Second Article`, '', body].join('\n')
    const imported = (await fetch(`${server.url}/api/import/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, title: 'Two articles' }),
    }).then((result) => result.json())) as { resource: { id: string } }

    const articles = (await fetch(`${server.url}/api/resources/${imported.resource.id}/articles`).then((result) =>
      result.json(),
    )) as { articles: Array<{ title: string; index: number }>; hiddenArticles: Array<{ title: string }> }
    assert.deepEqual(articles.articles.map((article) => article.title), ['First Article', 'Second Article'])

    const overridden = await fetch(`${server.url}/api/resources/${imported.resource.id}/articles/0/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isArticle: false }),
    })
    assert.equal(overridden.status, 200)
    const afterOverride = (await fetch(`${server.url}/api/resources/${imported.resource.id}/articles`).then((result) =>
      result.json(),
    )) as { articles: Array<{ title: string }>; hiddenArticles: Array<{ title: string }> }
    assert.deepEqual(afterOverride.articles.map((article) => article.title), ['Second Article'])
    assert.deepEqual(afterOverride.hiddenArticles.map((article) => article.title), ['First Article'])

    const invalid = await fetch(`${server.url}/api/resources/${imported.resource.id}/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ article: 99, useLlm: false, translate: false }),
    })
    assert.equal(invalid.status, 400)
  })

  it('rejects an unsupported ebook extension', async () => {
    const response = await fetch(`${server.url}/api/import/ebook?name=book.txt`, {
      method: 'POST',
      body: Buffer.from('plain text'),
    })
    assert.equal(response.status, 400)
    const data = (await response.json()) as { error: string }
    assert.match(data.error, /只支持 EPUB、MOBI/)
  })

  it('returns 404 for an unknown build job', async () => {
    const response = await fetch(`${server.url}/api/jobs/nope`)
    assert.equal(response.status, 404)
  })

  it('returns a cached editor reply for written output', async () => {
    const entry = await server.store.saveOutput({
      text: 'Public transport makes cities more equal.',
      prompt: 'Why does public transport matter?',
    })
    await server.store.saveOutputFeedback(entry.id, {
      praise: '观点清楚。',
      upgrade: '可以更具体。',
      revision: 'Public transport makes cities more equal.',
      question: '能举个例子吗？',
    })
    const result = (await fetch(`${server.url}/api/outputs/${entry.id}/feedback`, {
      method: 'POST',
    }).then((response) => response.json())) as {
      cached: boolean
      feedback: { praise: string; question: string }
    }
    assert.equal(result.cached, true)
    assert.equal(result.feedback.praise, '观点清楚。')
    assert.equal(result.feedback.question, '能举个例子吗？')
  })

  it('saves output revisions and returns their cached editor replies', async () => {
    const entry = await server.store.saveOutput({
      text: 'Public transport makes cities more equal.',
      prompt: 'Why does public transport matter?',
    })
    const revised = (await fetch(`${server.url}/api/outputs/${entry.id}/revision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Cheap buses connect workers to better jobs.' }),
    }).then((response) => response.json())) as { output: { revisions: Array<{ id: string }> } }
    assert.equal(revised.output.revisions.length, 1)
    const revisionId = revised.output.revisions[0]!.id

    const duplicate = await fetch(`${server.url}/api/outputs/${entry.id}/revision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Cheap buses connect workers to better jobs.' }),
    })
    assert.equal(duplicate.status, 400)

    await server.store.saveOutputRevisionFeedback(entry.id, revisionId, {
      praise: '更具体了。',
      upgrade: '再补一个数字。',
      revision: 'Cheap buses connect workers to better jobs.',
    })
    const feedback = (await fetch(
      `${server.url}/api/outputs/${entry.id}/revisions/${revisionId}/feedback`,
      { method: 'POST' },
    ).then((response) => response.json())) as { cached: boolean; feedback: { praise: string } }
    assert.equal(feedback.cached, true)
    assert.equal(feedback.feedback.praise, '更具体了。')
  })

  it('returns cached word stories and sentence rewrites', async () => {
    const dir = path.join(tempPacks, 'pack-phase1')
    await fs.mkdir(dir, { recursive: true })
    const now = new Date().toISOString()
    const pack = {
      id: 'pack-phase1',
      resourceId: 'r',
      title: 'Phase one',
      source: 'sample',
      mode: 'llm',
      generatedAt: now,
      summary: 'Summary',
      difficulty: { cefr: 'B2', reason: 'test' },
      stats: { wordCount: 20, itemCount: 2, readingMinutes: 2 },
      items: [
        {
          id: 'word-1',
          type: 'word_sense',
          lemma: 'company',
          sense: '陪伴',
          definition: 'the state of being with others',
          definitionZh: '陪伴',
          contexts: [],
          collocations: [],
          examples: [],
          relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
          wordStory: {
            origin: 'test origin',
            roots: 'com + panis',
            cognates: ['companion'],
            confusables: [],
            hook: 'test hook',
          },
          tags: [],
          sourceRef: 'Resource',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sentence-1',
          type: 'sentence',
          lemma: 'A sentence.',
          sense: '一句话。',
          definition: 'A sentence.',
          contexts: [],
          collocations: [],
          examples: [],
          relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
          sentence: {
            original: 'A sentence.',
            translation: '一句话。',
            chunks: [],
            variants: [],
            rewrites: [
              { register: 'formal', text: 'A formal sentence.', note: '正式。' },
              { register: 'casual', text: 'A casual sentence.', note: '口语。' },
              { register: 'punchy', text: 'A sentence.', note: '简短。' },
            ],
          },
          tags: ['sentence'],
          sourceRef: 'Resource',
          createdAt: now,
          updatedAt: now,
        },
      ],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [],
    }
    await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(pack), 'utf8')
    await server.store.addPack({
      id: 'pack-phase1',
      resourceId: 'r',
      dir,
      mode: 'llm',
      itemCount: 2,
      createdAt: now,
    })

    const story = (await fetch(`${server.url}/api/pack/pack-phase1/items/word-1/story`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((response) => response.json())) as { cached: boolean; story: { hook: string } }
    assert.equal(story.cached, true)
    assert.equal(story.story.hook, 'test hook')

    const rewrites = (await fetch(`${server.url}/api/pack/pack-phase1/items/sentence-1/rewrites`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((response) => response.json())) as { cached: boolean; rewrites: Array<{ register: string }> }
    assert.equal(rewrites.cached, true)
    assert.deepEqual(rewrites.rewrites.map((entry) => entry.register), ['formal', 'casual', 'punchy'])

    await fetch(`${server.url}/api/packs/pack-phase1/delete`, { method: 'POST' })
  })

  it('serves cached micro stories and aggregates the reading passport', async () => {
    const dir = path.join(tempPacks, 'pack-passport')
    await fs.mkdir(dir, { recursive: true })
    const now = new Date().toISOString()
    const word = (id: string, lemma: string) => ({
      ...makeItem(),
      id,
      lemma,
    })
    const pack = {
      id: 'pack-passport',
      resourceId: 'r',
      title: 'Passport Article',
      source: 'sample',
      mode: 'llm',
      generatedAt: now,
      summary: 'A short summary.',
      difficulty: { cefr: 'C1', reason: 'test' },
      frontMatter: {
        title: 'Passport Article',
        titleZh: '护照文章',
        lead: 'A line worth keeping.',
        leadZh: '值得记住的一句。',
        itemIds: [],
      },
      stats: { wordCount: 800, itemCount: 3, readingMinutes: 18 },
      items: [word('p1', 'attention'), word('p2', 'scarcity'), word('p3', 'deliberate')],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [
        {
          index: 0,
          original: 'A line worth keeping.',
          translation: '值得记住的一句。',
          itemIds: [],
        },
      ],
      microStory: {
        title: 'The Quiet Room',
        text: 'Attention was scarce, so she made a deliberate choice.',
        translation: '注意力很稀缺，所以她做了一个刻意的选择。',
        used: ['attention', 'scarce', 'deliberate'],
      },
    }
    await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(pack), 'utf8')
    await server.store.addPack({
      id: 'pack-passport',
      resourceId: 'r',
      dir,
      mode: 'llm',
      itemCount: 3,
      title: 'Passport Article',
      createdAt: now,
    })

    const cached = (await fetch(`${server.url}/api/pack/pack-passport/micro-story`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((response) => response.json())) as { cached: boolean; story: { title: string } }
    assert.equal(cached.cached, true)
    assert.equal(cached.story.title, 'The Quiet Room')

    await fetch(`${server.url}/api/packs/pack-passport/reading`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ readParagraphs: [0], lastParagraph: 0, totalParagraphs: 1, finished: true }),
    })

    const passport = (await fetch(`${server.url}/api/passport`).then((response) => response.json())) as {
      stats: { finished: number; words: number; minutes: number }
      stamps: Array<{ packId: string; title: string; titleZh?: string; quote?: string; finished: boolean }>
      achievements: {
        badges: Array<{ id: string; earned: boolean }>
        activity: unknown[]
        earned: number
        total: number
      }
    }
    assert.ok(passport.stats.finished >= 1)
    assert.ok(passport.stats.words >= 800)
    assert.ok(passport.stats.minutes >= 18)
    const stamp = passport.stamps.find((entry) => entry.packId === 'pack-passport')
    assert.ok(stamp)
    assert.equal(stamp?.title, 'Passport Article')
    assert.equal(stamp?.titleZh, '护照文章')
    assert.equal(stamp?.quote, 'A line worth keeping.')
    assert.equal(stamp?.finished, true)
    assert.equal(passport.achievements.activity.length, 84)
    assert.equal(passport.achievements.total, 10)
    assert.ok(passport.achievements.badges.some((badge) => badge.id === 'first-read' && badge.earned))

    await fetch(`${server.url}/api/packs/pack-passport/delete`, { method: 'POST' })
  })

  it('returns cached sentence audio and validates the sentence position', async () => {
    const dir = path.join(tempPacks, 'pack-shadow')
    const text = 'Listen carefully to this sentence.'
    const hash = createHash('sha1').update(`say:system\n${text}`).digest('hex').slice(0, 16)
    await fs.mkdir(path.join(dir, 'audio', 'shadow'), { recursive: true })
    await fs.writeFile(path.join(dir, 'audio', 'shadow', `${hash}.m4a`), Buffer.from('fake-sentence-audio'))
    const now = new Date().toISOString()
    const pack = {
      id: 'pack-shadow',
      resourceId: 'r',
      title: 'Shadow Article',
      source: 'sample',
      mode: 'heuristic',
      generatedAt: now,
      summary: 'Summary.',
      difficulty: { cefr: 'B1', reason: 'test' },
      stats: { wordCount: 10, itemCount: 0, readingMinutes: 1 },
      items: [],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [{ index: 0, original: text, translation: '仔细听这句话。', itemIds: [] }],
    }
    await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(pack), 'utf8')
    await server.store.addPack({
      id: 'pack-shadow',
      resourceId: 'r',
      dir,
      mode: 'heuristic',
      itemCount: 0,
      createdAt: now,
    })

    const result = (await fetch(`${server.url}/api/pack/pack-shadow/sentence-audio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paragraph: 0, sentence: 0 }),
    }).then((response) => response.json())) as { cached: boolean; audio: string }
    assert.equal(result.cached, true)
    assert.equal(result.audio, `audio/shadow/${hash}.m4a`)

    const missing = await fetch(`${server.url}/api/pack/pack-shadow/sentence-audio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paragraph: 0, sentence: 99 }),
    })
    assert.equal(missing.status, 400)

    await fetch(`${server.url}/api/packs/pack-shadow/delete`, { method: 'POST' })
  })

  it('stores neural TTS settings without leaking the key', async () => {
    const initial = (await fetch(`${server.url}/api/tts`).then((response) => response.json())) as {
      tts: { configured: boolean; provider: string }
      providers: Array<{ id: string }>
    }
    assert.equal(typeof initial.tts.configured, 'boolean')
    assert.ok(initial.providers.some((provider) => provider.id === 'glm'))
    assert.ok(initial.providers.some((provider) => provider.id === 'gemini'))

    const saved = (await fetch(`${server.url}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'glm',
        apiKey: 'test-tts-key',
        baseUrl: 'https://example.com/v1',
        model: 'glm-tts',
        voice: 'tongtong',
        instructions: '',
      }),
    }).then((response) => response.json())) as {
      ok: boolean
      tts: { configured: boolean; provider: string; voice: string; baseUrl: string }
    }
    assert.equal(saved.ok, true)
    assert.equal(saved.tts.configured, true)
    assert.equal(saved.tts.provider, 'glm')
    assert.equal(saved.tts.voice, 'tongtong')
    assert.equal(saved.tts.baseUrl, 'https://example.com/v1')
    assert.ok(!JSON.stringify(saved).includes('test-tts-key'))

    const edge = (await fetch(`${server.url}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'edge', voice: 'en-US-AvaNeural' }),
    }).then((response) => response.json())) as {
      tts: { configured: boolean; provider: string; voice: string }
    }
    assert.equal(edge.tts.configured, true)
    assert.equal(edge.tts.provider, 'edge')
    assert.equal(edge.tts.voice, 'en-US-AvaNeural')

    const local = (await fetch(`${server.url}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'local', voice: 'Samantha' }),
    }).then((response) => response.json())) as {
      tts: { provider: string; voice: string }
    }
    assert.equal(local.tts.provider, 'local')
    assert.equal(local.tts.voice, 'Samantha')

    const cleared = (await fetch(`${server.url}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    }).then((response) => response.json())) as { tts: { configured: boolean; provider: string } }
    assert.equal(cleared.tts.configured, false)
    assert.equal(cleared.tts.provider, 'local')
  })

  it('returns cached article audio without regenerating it', async () => {
    const dir = path.join(tempPacks, 'pack-audio')
    await fs.mkdir(path.join(dir, 'audio'), { recursive: true })
    await fs.writeFile(path.join(dir, 'audio', 'reading.m4a'), Buffer.from('fake-audio'))
    const now = new Date().toISOString()
    const pack = {
      id: 'pack-audio',
      resourceId: 'r',
      title: 'Audio Article',
      source: 'sample',
      mode: 'heuristic',
      generatedAt: now,
      summary: 'Summary.',
      difficulty: { cefr: 'B2', reason: 'test' },
      stats: { wordCount: 100, itemCount: 0, readingMinutes: 3 },
      items: [],
      exercises: { cloze: [], comprehension: [], discussion: [] },
      reading: [{ index: 0, original: 'Listen to this sentence.', translation: '听这句话。', itemIds: [] }],
      audio: { items: {}, reading: 'audio/reading.m4a' },
    }
    await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(pack), 'utf8')
    await server.store.addPack({
      id: 'pack-audio',
      resourceId: 'r',
      dir,
      mode: 'heuristic',
      itemCount: 0,
      title: 'Audio Article',
      createdAt: now,
    })

    const result = (await fetch(`${server.url}/api/pack/pack-audio/audio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((response) => response.json())) as {
      cached: boolean
      audio: { reading: string }
    }
    assert.equal(result.cached, true)
    assert.equal(result.audio.reading, 'audio/reading.m4a')

    const file = await fetch(`${server.url}/pack/pack-audio/audio/reading.m4a`)
    assert.equal(file.status, 200)
    assert.equal(await file.text(), 'fake-audio')

    await fetch(`${server.url}/api/packs/pack-audio/delete`, { method: 'POST' })
  })

  it('serves the lab page and quote endpoints', async () => {
    const page = await fetch(`${server.url}/lab`)
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /lab\.js/)
    assert.match(html, /实验室/)

    const script = await fetch(`${server.url}/lab.js`)
    assert.equal(script.status, 200)
    assert.match(await script.text(), /FEATURES/)

    const status = (await fetch(`${server.url}/api/lab`).then((response) => response.json())) as {
      packs: unknown[]
      status: { llm: boolean }
    }
    assert.ok(Array.isArray(status.packs))
    assert.equal(typeof status.status.llm, 'boolean')

    const created = (await fetch(`${server.url}/api/lab/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'A browser-test quote.' }),
    }).then((response) => response.json())) as { quote: { id: string } }
    assert.ok(created.quote.id)
    const listed = (await fetch(`${server.url}/api/lab/quotes`).then((response) => response.json())) as {
      quotes: Array<{ id: string; text: string }>
    }
    assert.ok(listed.quotes.some((quote) => quote.text === 'A browser-test quote.'))
    await fetch(`${server.url}/api/lab/quotes/${created.quote.id}`, { method: 'DELETE' })
  })

  it('returns 404 for a nuance quiz on a missing item', async () => {
    const response = await fetch(`${server.url}/api/items/not-a-real-item/nuance`, { method: 'POST' })
    assert.equal(response.status, 404)
  })
})
