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

    // A visitor that has not opened anything yet owns nothing, even though the
    // demo view is pointed at the root library.
    const demo = cookieFrom(await fetch(`${base}/api/summary`))
    const shared = (await fetch(`${base}/api/shared`, { headers: { cookie: demo } }).then((r) =>
      r.json(),
    )) as { packs: Array<{ id: string; owned: boolean }> }
    assert.ok(shared.packs.length >= 1)
    assert.equal(shared.packs.every((pack) => pack.owned), false)
  })

  it('refuses to unpublish built-in or unknown packs', async () => {
    const visitor = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 6 }, visitor)
    const mine = (await fetch(`${base}/api/packs`, { headers: { cookie: visitor } }).then((r) =>
      r.json(),
    )) as { packs: Array<{ id: string; shared?: boolean; publishedByMe?: boolean }> }
    const packId = mine.packs[0]!.id
    assert.equal(mine.packs[0]!.shared, true)
    assert.equal(mine.packs[0]!.publishedByMe, false)

    const seeded = await fetch(`${base}/api/packs/${encodeURIComponent(packId)}/unpublish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie: visitor },
      body: '{}',
    })
    assert.equal(seeded.status, 403)

    const unknown = await fetch(`${base}/api/packs/nope/unpublish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie: visitor },
      body: '{}',
    })
    assert.equal(unknown.status, 404)
  })

  it('reports how many visitors the site has seen', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    // "online" only counts an open, visible page saying hello.
    await fetch(`${base}/api/public/ping`, { headers: { cookie } })
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

  it('issues a recovery code that restores the same workspace', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 4 }, cookie)
    const original = (await settings(cookie)) as SettingsPayload & { recovery?: string }
    assert.ok(original.recovery && original.recovery.includes('.'))

    const recovered = await fetch(`${base}/api/recover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ code: original.recovery }),
    })
    assert.equal(recovered.status, 200)
    const nextCookie = cookieFrom(recovered)
    assert.ok(nextCookie.startsWith('cr_visitor='))
    const after = await settings(nextCookie)
    assert.equal(after.workspace.id, original.workspace.id)
  })

  it('rejects a forged recovery code', async () => {
    const response = await fetch(`${base}/api/recover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ code: 'abcdefgh.0123456789abcdef' }),
    })
    assert.equal(response.status, 400)
  })

  it('hydrates a workspace in chunks without losing earlier ones', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 3 }, cookie)
    const id = (await settings(cookie)).workspace.id
    const dir = path.join(process.env.LEARN_RUN_DIR!, 'users', id)

    const send = (files: Record<string, string>, append: boolean): Promise<Response> =>
      fetch(`${base}/api/hydrate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie },
        body: JSON.stringify({ files, append }),
      })

    assert.equal((await send({ 'data/first.txt': 'a' }, false)).status, 200)
    assert.equal((await send({ 'data/second.txt': 'b' }, true)).status, 200)
    assert.equal(await fs.readFile(path.join(dir, 'data', 'first.txt'), 'utf8'), 'a')
    assert.equal(await fs.readFile(path.join(dir, 'data', 'second.txt'), 'utf8'), 'b')

    assert.equal((await send({ 'data/third.txt': 'c' }, false)).status, 200)
    await assert.rejects(fs.readFile(path.join(dir, 'data', 'first.txt'), 'utf8'))
    assert.equal(await fs.readFile(path.join(dir, 'data', 'third.txt'), 'utf8'), 'c')
  })

  it('reports deletions so a trashed article cannot come back', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 2 }, cookie)
    const id = (await settings(cookie)).workspace.id
    const dir = path.join(process.env.LEARN_RUN_DIR!, 'users', id)
    const checkpoint = (): Promise<{ files: unknown[]; deleted: string[] }> =>
      fetch(`${base}/api/checkpoint`, { headers: { cookie } }).then((r) => r.json())
    const send = (files: Record<string, string>, append: boolean, final: boolean): Promise<Response> =>
      fetch(`${base}/api/hydrate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie },
        body: JSON.stringify({ files, append, final }),
      })

    // A chunked push must not look like mass deletion while it is in flight.
    assert.equal((await send({ 'packs/dead/pack.json': '{"id":"dead"}' }, false, false)).status, 200)
    const midPush = await checkpoint()
    assert.deepEqual(midPush.deleted, [])

    assert.equal((await send({ 'packs/live/pack.json': '{"id":"live"}' }, true, true)).status, 200)
    const settled = await checkpoint()
    assert.deepEqual(settled.deleted, [], 'a fresh push leaves no tombstones')

    // Moving a pack to the trash removes its directory from the workspace.
    await fs.rm(path.join(dir, 'packs', 'dead'), { recursive: true, force: true })
    const afterDelete = await checkpoint()
    assert.ok(afterDelete.deleted.includes('packs/dead/pack.json'))
  })

  it('refuses a recovery code once the workspace is gone', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    await post({ weeklyArticleGoal: 1 }, cookie)
    const payload = (await settings(cookie)) as SettingsPayload & { recovery?: string }
    assert.ok(payload.recovery)
    const id = payload.workspace.id
    await fs.rm(path.join(process.env.LEARN_RUN_DIR!, 'users', id), { recursive: true, force: true })
    const response = await fetch(`${base}/api/recover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ code: payload.recovery }),
    })
    assert.equal(response.status, 404)
  })

  it('rate limits expensive import calls per IP', async () => {
    const cookie = cookieFrom(await fetch(`${base}/api/summary`))
    const ip = '203.0.113.77'
    let lastStatus = 0
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(`${base}/api/import/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie, 'x-real-ip': ip },
        body: JSON.stringify({ text: '' }),
      })
      lastStatus = response.status
    }
    assert.equal(lastStatus, 429)
  })
})
