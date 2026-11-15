import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-vocab-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { storePath } = await import('../src/config.js')
const { Store } = await import('../src/store/store.js')
const { startReviewServer } = await import('../src/review/server.js')

function makeItem() {
  const now = new Date().toISOString()
  return {
    id: 'vocab-item',
    type: 'word_sense' as const,
    lemma: 'attention',
    sense: 'focus',
    definition: 'the act of focusing',
    definitionZh: '注意力',
    contexts: [{ resourceId: 'vocab-resource', resourceTitle: 'Vocab', segmentIndex: 0, sentence: 'Attention is scarce.' }],
    collocations: ['pay attention'],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Vocab',
    createdAt: now,
    updatedAt: now,
  }
}

describe('vocabulary and study APIs', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  before(async () => {
    const store = await Store.open(storePath())
    await store.upsertItems([makeItem()])
    server = await startReviewServer({ port: 0 })
  })
  after(async () => {
    await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('serves grouped vocabulary, word detail and a study queue', async () => {
    const vocab = (await fetch(`${server.url}/api/vocab?group=all`).then((response) => response.json())) as {
      items: Array<{ id: string }>
      counts: { all: number; new: number; due: number }
    }
    assert.ok(vocab.items.some((item) => item.id === 'vocab-item'))
    assert.equal(vocab.counts.all, 1)
    assert.equal(vocab.counts.new, 1)

    const detail = (await fetch(`${server.url}/api/items/vocab-item`).then((response) => response.json())) as {
      item: { lemma: string; contexts: unknown[]; definitionZh: string }
    }
    assert.equal(detail.item.lemma, 'attention')
    assert.equal(detail.item.definitionZh, '注意力')
    assert.equal(detail.item.contexts.length, 1)

    const queue = (await fetch(`${server.url}/api/study/queue?limit=10&newLimit=10`).then((response) => response.json())) as {
      items: Array<{ id: string }>
      counts: { new: number; due: number }
    }
    assert.ok(queue.items.some((item) => item.id === 'vocab-item'))
    assert.equal(queue.counts.new, 1)
    assert.equal(queue.counts.due, 0)
  })

  it('lists wordbooks and enrolls a limited seed into the same FSRS library', async () => {
    const books = (await fetch(`${server.url}/api/wordbooks`).then((response) => response.json())) as {
      books: Array<{ id: string; progress: { total: number } }>
    }
    assert.ok(books.books.some((book) => book.id === 'cet4'))
    assert.ok(books.books.some((book) => book.id === 'toefl'))
    assert.equal(books.books.find((book) => book.id === 'ielts')?.progress.total, 7298)

    const enrolled = (await fetch(`${server.url}/api/wordbooks/cet4/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
    }).then((response) => response.json())) as {
      result: { added: number; skipped: number }
      book: { progress: { enrolled: number } }
    }
    assert.equal(enrolled.result.added, 3)
    assert.ok(enrolled.book.progress.enrolled >= 3)

    const filtered = (await fetch(`${server.url}/api/vocab?book=cet4`).then((response) => response.json())) as {
      items: Array<{ id: string }>
    }
    // attention already exists from the other test and matches CET-4 by lemma.
    assert.equal(filtered.items.length, 4)

    const queue = (await fetch(`${server.url}/api/study/queue?book=cet4&limit=10&newLimit=10`).then((response) =>
      response.json(),
    )) as { items: Array<{ id: string }> }
    assert.equal(queue.items.length, 4)

    const missing = (await fetch(`${server.url}/api/vocab?group=missing&book=cet4`).then((response) =>
      response.json(),
    )) as { items: Array<{ id: string; hasExample: boolean }> }
    assert.equal(missing.items.length, 3)
    assert.ok(missing.items.every((item) => item.hasExample === false))

    const again = (await fetch(`${server.url}/api/wordbooks/cet4/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
    }).then((response) => response.json())) as { result: { added: number; skipped: number } }
    assert.equal(again.result.added, 0)
    assert.equal(again.result.skipped, 3)

    const ielts = (await fetch(`${server.url}/api/wordbooks/ielts/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
    }).then((response) => response.json())) as { result: { added: number } }
    assert.equal(ielts.result.added, 3)
    const rich = (await fetch(`${server.url}/api/vocab?book=ielts`).then((response) => response.json())) as {
      items: Array<{ relations: { synonyms: string[]; antonyms: string[]; wordFamily: string[] }; examples: string[] }>
    }
    assert.ok(rich.items.some((item) => item.relations.wordFamily.length + item.relations.synonyms.length + item.relations.antonyms.length > 0))
    assert.ok(rich.items.some((item) => item.examples.length > 0))
  })

  it('uses a wordbook example as the review context when no article context exists', async () => {
    const now = new Date().toISOString()
    await server.store.upsertItems([
      {
        ...makeItem(),
        id: 'wordbook-context',
        lemma: 'controversial',
        sense: 'causing disagreement',
        contexts: [],
        examples: [
          {
            text: 'The policy was controversial. — 这项政策有争议。',
            origin: 'generated',
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ])
    const queue = (await fetch(
      `${server.url}/api/queue?limit=10&words=wordbook-context&type=word`,
    ).then((response) => response.json())) as {
      items: Array<{ id: string; context: string; translation: string; contextKind: string }>
    }
    const item = queue.items.find((entry) => entry.id === 'wordbook-context')
    assert.ok(item)
    assert.equal(item.contextKind, 'example')
    assert.match(item.context, /The policy was controversial/)
    assert.match(item.translation, /这项政策有争议/)
  })
})
