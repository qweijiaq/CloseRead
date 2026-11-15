import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_PREFERENCES,
  LocalStore,
  MemoryDriver,
  SNAPSHOT_KIND,
  describeSnapshot,
  validateSnapshot,
} from '../src/review/local-store.js'

function makeStore(): LocalStore {
  return new LocalStore(new MemoryDriver())
}

const pack = (id: string, title = `Article ${id}`) => ({
  id,
  resourceId: `r-${id}`,
  dir: `pack-${id}`,
  mode: 'heuristic' as const,
  itemCount: 2,
  createdAt: '2026-11-15T00:00:00.000Z',
  title,
})

const item = (id: string) => ({
  id,
  type: 'word_sense' as const,
  lemma: 'attention',
  sense: 'focus',
  pos: 'noun',
  definition: 'the act of focusing the mind',
  contexts: [],
  collocations: [],
  examples: [],
  relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
  tags: [],
  sourceRef: 'demo',
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
})

describe('local workspace store', () => {
  it('starts from default preferences', async () => {
    const store = await makeStore().open()
    const settings = await store.getSettings()
    assert.deepEqual(settings.preferences, DEFAULT_PREFERENCES)
  })

  it('merges settings patches instead of replacing them', async () => {
    const store = await makeStore().open()
    await store.saveSettings({ preferences: { weeklyArticleGoal: 6 } })
    const settings = await store.getSettings()
    assert.equal(settings.preferences.weeklyArticleGoal, 6)
    assert.equal(settings.preferences.dailyNewTarget, DEFAULT_PREFERENCES.dailyNewTarget)
  })

  it('keys records by id and round-trips them', async () => {
    const store = await makeStore().open()
    await store.put('packs', pack('a'))
    await store.put('items', item('i1'))
    assert.equal((await store.get('packs', 'a'))?.title, 'Article a')
    assert.equal(await store.count('packs'), 1)
    assert.equal((await store.list('items'))[0]?.id, 'i1')
  })

  it('rejects records without an id', async () => {
    const store = await makeStore().open()
    await assert.rejects(() => store.put('packs', { title: 'no id' } as never), /need a string id/)
  })

  it('exports without provider keys by default', async () => {
    const store = await makeStore().open()
    await store.put('packs', pack('a'))
    await store.put('keys', { id: 'llm', apiKey: 'sk-secret' })

    const withoutKeys = await store.exportSnapshot()
    assert.equal(withoutKeys.kind, SNAPSHOT_KIND)
    assert.deepEqual(Object.keys(withoutKeys.stores).includes('keys'), false)
    assert.equal(Object.keys(withoutKeys.stores.packs ?? {}).length, 1)

    const withKeys = await store.exportSnapshot({ includeKeys: true })
    const storedKey = withKeys.stores.keys?.llm as { apiKey?: string } | undefined
    assert.equal(storedKey?.apiKey, 'sk-secret')
  })

  it('round-trips a workspace through serialize and import', async () => {
    const source = await makeStore().open()
    await source.put('packs', pack('a'))
    await source.put('packs', pack('b'))
    await source.put('items', item('i1'))
    await source.put('progress', { id: 'a', paragraphsRead: 3, finished: false })
    const text = await source.serialize()

    const target = await makeStore().open()
    await target.put('packs', pack('old'))
    const summary = await target.importSnapshot(text)

    assert.equal(summary.packs, 2)
    assert.equal(await target.count('packs'), 3)
    assert.equal((await target.get('progress', 'a'))?.paragraphsRead, 3)
  })

  it('replaces instead of merging when asked', async () => {
    const source = await makeStore().open()
    await source.put('packs', pack('a'))
    const text = await source.serialize()

    const target = await makeStore().open()
    await target.put('packs', pack('old'))
    await target.importSnapshot(text, { mode: 'replace' })

    assert.equal(await target.count('packs'), 1)
    assert.equal((await target.get('packs', 'old')) ?? null, null)
  })

  it('reports how much an import will change', async () => {
    const source = await makeStore().open()
    await source.put('packs', pack('a'))
    await source.put('packs', pack('b'))
    const text = await source.serialize()

    const target = await makeStore().open()
    await target.put('packs', pack('b', 'older copy'))
    const summary = await target.importSnapshot(text)

    assert.equal(summary.added, 1)
    assert.equal(summary.replaced, 1)
    assert.equal((await target.get('packs', 'b'))?.title, 'Article b')
  })
})

describe('migration files', () => {
  it('rejects anything that is not a CloseRead snapshot', () => {
    assert.equal(validateSnapshot('not json').ok, false)
    assert.equal(validateSnapshot('{}').ok, false)
    assert.equal(validateSnapshot(JSON.stringify({ kind: 'other', version: 1, stores: {} })).ok, false)
    assert.equal(
      validateSnapshot(JSON.stringify({ kind: SNAPSHOT_KIND, version: 99, stores: {} })).ok,
      false,
    )
    assert.equal(
      validateSnapshot(JSON.stringify({ kind: SNAPSHOT_KIND, version: 1, stores: { nope: {} } })).ok,
      false,
    )
  })

  it('accepts a well-formed snapshot', () => {
    const result = validateSnapshot({
      kind: SNAPSHOT_KIND,
      version: 1,
      stores: { packs: { a: pack('a') } },
    })
    assert.equal(result.ok, true)
  })

  it('describes what is inside a file', () => {
    const described = describeSnapshot({
      exportedAt: '2026-11-15T00:00:00.000Z',
      stores: {
        packs: { a: {}, b: {} },
        items: { i1: {} },
        notes: { n1: {} },
        keys: { llm: {} },
      },
    })
    assert.equal(described.packs, 2)
    assert.equal(described.items, 1)
    assert.equal(described.hasKeys, true)
    assert.equal(described.exportedAt, '2026-11-15T00:00:00.000Z')
  })
})
