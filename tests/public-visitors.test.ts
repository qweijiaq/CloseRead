import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-public-data-'))
const tempPacks = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-public-packs-'))
process.env.LEARN_DATA_DIR = tempData
process.env.LEARN_PACKS_DIR = tempPacks
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
    const users = await fs.readdir(path.join(tempData, 'users')).catch(() => [] as string[])
    assert.deepEqual(users, [])
  })

  it('creates a private workspace on the first write', async () => {
    const first = await fetch(`${base}/api/summary`)
    const cookie = cookieFrom(first)
    const saved = await post({ weeklyArticleGoal: 7 }, cookie)
    assert.equal(saved.status, 200)
    const payload = await settings(cookie)
    assert.equal(payload.workspace.readOnly, false)
    assert.equal(payload.preferences.weeklyArticleGoal, 7)
    const users = await fs.readdir(path.join(tempData, 'users'))
    assert.equal(users.length, 1)
    const seeded = await fs.readdir(path.join(tempData, 'users', users[0]!, 'data'))
    assert.ok(seeded.includes('store.json'))
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
    const raw = await fs.readFile(path.join(tempData, 'users', id, 'data', 'llm.json'), 'utf8')
    assert.ok(raw.includes('enc:v1:'))
    assert.ok(!raw.includes('sk-plain-text-key'))
    const listed = await fetch(`${base}/api/llm`, { headers: { cookie } }).then(
      (response) => response.text(),
    )
    assert.ok(!listed.includes('sk-plain-text-key'))
  })
})
