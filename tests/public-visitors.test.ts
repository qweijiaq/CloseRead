import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-public-data-'))
const tempPacks = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-public-packs-'))
process.env.LEARN_DATA_DIR = tempData
process.env.LEARN_PACKS_DIR = tempPacks
process.env.LEARN_RUN_DIR = path.join(tempData, 'run')
// A non-empty public host is what turns on per-visitor workspaces.
process.env.LEARN_PUBLIC_HOST = 'public.example.com'
process.env.LEARN_SECRET = 'test-secret-with-enough-entropy'

const { startReviewServer } = await import('../src/review/server.js')
const { Store } = await import('../src/store/store.js')
const { storePath } = await import('../src/config.js')

interface SettingsPayload {
  workspace: { id: string; readOnly: boolean; mode: string }
  community: { totalUsers: number; online: number }
  preferences: { weeklyArticleGoal: number }
}

function cookieFrom(response: Response): string {
  const raw = response.headers.get('set-cookie') ?? ''
  return raw.split(';')[0] ?? ''
}

describe('public visitor workspaces', { concurrency: 1 }, () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let base = ''

  function post(body: unknown, cookie: string): Promise<Response> {
    return fetch(`${base}/api/preferences`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  }

  function settings(cookie: string): Promise<SettingsPayload> {
    return fetch(`${base}/api/settings`, { headers: cookie ? { cookie } : {} }).then(
      (response) => response.json() as Promise<SettingsPayload>,
    )
  }

  before(async () => {
    const store = await Store.open(storePath())
    await store.upsertItems([
      {
        id: 'demo-item',
        type: 'word_sense',
        lemma: 'attention',
        sense: 'mental focus',
        pos: 'noun',
        definition: 'the act of focusing the mind',
        contexts: [],
        collocations: [],
        examples: [],
        relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
        tags: [],
        sourceRef: 'demo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        review: {
          due: new Date().toISOString(),
          stability: 1,
          difficulty: 5,
          elapsedDays: 0,
          scheduledDays: 1,
          reps: 0,
          lapses: 0,
          state: 1,
          lastReview: null,
        },
        status: 'new',
        favorite: false,
      },
    ] as never)
    // A real pack in the root library: claim() copies it into the visitor's
    // workspace and the publish test needs something to publish.
    const packDir = path.join(tempPacks, 'fixture-pack')
    await fs.mkdir(packDir, { recursive: true })
    await fs.writeFile(
      path.join(packDir, 'pack.json'),
      JSON.stringify({
        id: 'pack-fixture',
        resourceId: 'r-fixture',
        title: 'Fixture Article',
        source: 'fixture',
        mode: 'heuristic',
        generatedAt: new Date().toISOString(),
        summary: 'A short fixture article used by the shared library test.',
        difficulty: { cefr: 'B2', reason: 'fixture' },
        stats: { wordCount: 120, itemCount: 1, readingMinutes: 2 },
        items: [],
        exercises: { cloze: [], comprehension: [], discussion: [] },
        reading: [
          {
            index: 0,
            original: 'Attention is scarce and cannot be stored for later use.',
            itemIds: [],
          },
        ],
      }),
    )
    await store.addPack({
      id: 'pack-fixture',
      resourceId: 'r-fixture',
      dir: packDir,
      mode: 'heuristic',
      itemCount: 1,
      createdAt: new Date().toISOString(),
      title: 'Fixture Article',
    })
    server = await startReviewServer({ port: 0 })
    base = server.url
  })

  after(async () => {
    await server.close()
    await fs.rm(tempData, { recursive: true, force: true })
    await fs.rm(tempPacks, { recursive: true, force: true })
  })

  it('hands anonymous readers the shared read-only demo', async () => {
    const response = await fetch(`${base}/`)
    const cookie = cookieFrom(response)
    assert.match(cookie, /^cr_visitor=/)
    const payload = await settings(cookie)
    assert.equal(payload.workspace.mode, 'public')
    assert.equal(payload.workspace.readOnly, true)
    const session = (await fetch(`${base}/api/session`, { headers: { cookie } }).then((r) =>
      r.json(),
    )) as { personal: boolean }
    assert.equal(session.personal, false)
  })

  it('creates a private workspace on the first write and checkpoints it', async () => {
    const first = await fetch(`${base}/api/summary`)
    const cookie = cookieFrom(first)
    const saved = await post({ weeklyArticleGoal: 7 }, cookie)
    assert.equal(saved.status, 200)
    const payload = await settings(cookie)
    assert.equal(payload.workspace.readOnly, false)
    assert.equal(payload.preferences.weeklyArticleGoal, 7)

    const checkpoint = (await fetch(`${base}/api/checkpoint`, { headers: { cookie } }).then((r) =>
      r.json(),
    )) as { files: Array<{ path: string; content: string }> }
    const store = checkpoint.files.find((file) => file.path === 'data/store.json')
    assert.ok(store, 'the browser needs store.json to rehydrate')
    assert.equal(JSON.parse(store.content).preferences.weeklyArticleGoal, 7)
  })

  it('accepts a browser-side copy back after a restart', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 5 }, cookie)
    const checkpoint = (await fetch(`${base}/api/checkpoint`, { headers: { cookie } }).then((r) =>
      r.json(),
    )) as { files: Array<{ path: string; content: string }> }
    assert.ok(checkpoint.files.length > 0)

    const hydrated = await fetch(`${base}/api/hydrate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie },
      body: JSON.stringify({ files: Object.fromEntries(checkpoint.files.map((file) => [file.path, file.content])) }),
    })
    assert.equal(hydrated.status, 200)
    const payload = await settings(cookie)
    assert.equal(payload.preferences.weeklyArticleGoal, 5)
  })

  it('keeps two visitors apart', async () => {
    const a = cookieFrom(await fetch(`${base}/api/summary`))
    const b = cookieFrom(await fetch(`${base}/api/summary`))
    assert.notEqual(a, b)
    await post({ weeklyArticleGoal: 4 }, a)
    await post({ weeklyArticleGoal: 9 }, b)
    assert.equal((await settings(a)).preferences.weeklyArticleGoal, 4)
    assert.equal((await settings(b)).preferences.weeklyArticleGoal, 9)
    assert.notEqual((await settings(a)).workspace.id, (await settings(b)).workspace.id)
  })

  it('reports shared-library state and rejects unknown publishes', async () => {
    const owner = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 6 }, owner)
    const mine = (await fetch(`${base}/api/packs`, { headers: { cookie: owner } }).then((r) =>
      r.json(),
    )) as { packs: Array<{ id: string; shared?: boolean }> }
    assert.equal(mine.packs.length, 1)
    // Seeded from the root library, so it is already part of the shared set.
    assert.equal(mine.packs[0]!.shared, true)

    const duplicate = await fetch(
      `${base}/api/packs/${encodeURIComponent(mine.packs[0]!.id)}/publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie: owner },
        body: '{}',
      },
    )
    assert.equal(duplicate.status, 409)

    const unknown = await fetch(`${base}/api/packs/does-not-exist/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie: owner },
      body: '{}',
    })
    assert.equal(unknown.status, 404)

    // A read-only demo visitor already reads the root library directly, so it
    // has nothing left to list as "shared".
    const demo = cookieFrom(await fetch(`${base}/api/summary`))
    const shared = (await fetch(`${base}/api/shared`, { headers: { cookie: demo } }).then((r) =>
      r.json(),
    )) as { packs: unknown[] }
    assert.deepEqual(shared.packs, [])
  })

  it('reports how many visitors the site has seen', async () => {
    const stats = (await fetch(`${base}/api/public/stats`).then((response) =>
      response.json(),
    )) as { mode: string; totalUsers: number; online: number }
    assert.equal(stats.mode, 'public')
    assert.ok(stats.totalUsers >= 3)
    assert.ok(stats.online >= 1)
  })

  it('encrypts stored provider keys', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    const saved = await fetch(`${base}/api/llm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie },
      body: JSON.stringify({ provider: 'deepseek', apiKey: 'sk-plain-text-key' }),
    })
    assert.equal(saved.status, 200)
    const id = (await settings(cookie)).workspace.id
    const raw = await fs.readFile(
      path.join(process.env.LEARN_RUN_DIR!, 'users', id, 'data', 'llm.json'),
      'utf8',
    )
    assert.ok(raw.includes('enc:v1:'))
    assert.ok(!raw.includes('sk-plain-text-key'))
    const listed = await fetch(`${base}/api/llm`, { headers: { cookie } }).then(
      (response) => response.text(),
    )
    assert.ok(!listed.includes('sk-plain-text-key'))
  })
})
