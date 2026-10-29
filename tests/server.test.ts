import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

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

describe('review server', () => {
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
  })

  it('serves the daily loop and records output completion', async () => {
    const today = (await fetch(`${server.url}/api/today`).then((response) => response.json())) as {
      steps: {
        review: { done: boolean; dueAtStart: number; reviewed: number; remaining: number }
        article: { done: boolean }
        output: { done: boolean }
      }
      streak: number
    }
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
    assert.equal(filtered.items.length, 1)
    assert.equal(filtered.items[0]?.id, 'test-item')
    assert.equal(filtered.pack.id, 'pack-filter')
    assert.equal(filtered.pack.due, 1)

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
})
