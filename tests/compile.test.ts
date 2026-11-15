import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-compile-data-'))
const tempPacks = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-compile-packs-'))
process.env.LEARN_DATA_DIR = tempData
process.env.LEARN_PACKS_DIR = tempPacks
process.env.LEARN_PUBLIC_HOST = 'compile.example.com'

const { startReviewServer } = await import('../src/review/server.js')
const { LocalStore, MemoryDriver } = await import('../src/review/local-store.js')

const ARTICLE = [
  'Attention has quietly become the scarcest resource of the modern economy. It cannot be stored, borrowed, or bought in bulk, and every platform that captures it is really selling access to the people behind it.',
  'The cost shows up in small places. A notification interrupts a sentence, a tab stays open for a week, and the work that needed an hour of silence never quite happens.',
  'Deliberate friction helps. Closing the laptop, writing the first sentence by hand, or leaving the phone in another room turns an impulse into a decision, and a decision is where attention begins to belong to you again.',
].join('\n\n')

interface CompileResponse {
  ok: boolean
  resource: { id: string; title: string }
  record: { id: string; itemCount: number }
  pack: { id: string; items: Array<{ id: string; lemma?: string }>; title: string }
  html: string
  anki: string
  markdown: string
  mode: string
  warnings: string[]
}

describe('stateless compile endpoint', { concurrency: 1 }, () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let base = ''

  before(async () => {
    server = await startReviewServer({ port: 0 })
    base = server.url
  })

  after(async () => {
    await server.close()
    await fs.rm(tempData, { recursive: true, force: true })
    await fs.rm(tempPacks, { recursive: true, force: true })
  })

  it('builds a pack and keeps nothing on the server', async () => {
    const response = await fetch(`${base}/api/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ kind: 'text', text: ARTICLE, title: 'The Cost of Attention' }),
    })
    assert.equal(response.status, 200)
    const body = (await response.json()) as CompileResponse

    assert.equal(body.ok, true)
    assert.equal(body.resource.title, 'The Cost of Attention')
    assert.ok(body.pack.items.length > 0)
    assert.equal(body.record.itemCount, body.pack.items.length)
    assert.match(body.html, /<html/i)
    assert.ok(body.anki.length > 0)
    assert.ok(body.markdown.length > 0)
    assert.ok(['heuristic', 'llm'].includes(body.mode))

    // The whole point: compiling must not leave the article behind. Visitor
    // bookkeeping (community/, users/) is separate and allowed to appear.
    const after = await snapshotDirs()
    assert.deepEqual(after.packs, [])
    assert.deepEqual(after.resources, [])
  })

  it('rejects empty input without creating anything', async () => {
    const response = await fetch(`${base}/api/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ kind: 'text', text: '   ' }),
    })
    assert.equal(response.status, 400)
  })

  it('hands the result to the browser-side store', async () => {
    const response = await fetch(`${base}/api/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ kind: 'text', text: ARTICLE, title: 'Local Copy' }),
    })
    const body = (await response.json()) as CompileResponse

    const store = await new LocalStore(new MemoryDriver()).open()
    await store.put('packs', body.record as never)
    await store.put('resources', body.resource as never)
    await store.putMany('items', body.pack.items as never[])
    await store.put('progress', { id: body.record.id, paragraphsRead: 2, finished: false })

    assert.equal(await store.count('packs'), 1)
    assert.equal(await store.count('items'), body.pack.items.length)

    const snapshot = await store.exportSnapshot()
    assert.equal(Object.keys(snapshot.stores.packs ?? {}).length, 1)
    assert.equal(Object.keys(snapshot.stores.items ?? {}).length, body.pack.items.length)

    const restored = await new LocalStore(new MemoryDriver()).open()
    await restored.importSnapshot(snapshot)
    const progress = await restored.get('progress', body.record.id)
    assert.equal(progress?.paragraphsRead, 2)
  })
})

async function snapshotDirs(): Promise<{ packs: string[]; resources: string[] }> {
  const list = async (dir: string): Promise<string[]> =>
    (await fs.readdir(dir).catch(() => [] as string[])).sort()
  return {
    packs: await list(tempPacks),
    resources: await list(path.join(tempData, 'resources')),
  }
}
