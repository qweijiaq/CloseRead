import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-trash-'))
process.env.LEARN_DATA_DIR = path.join(temp, 'data')
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { config } = await import('../src/config.js')
const { Store } = await import('../src/store/store.js')
const { listTrash, purgeTrash, restoreTrash, trashPack } = await import('../src/store/trash.js')

function makeItem() {
  const now = new Date().toISOString()
  return {
    id: 'trash-item',
    type: 'word_sense' as const,
    lemma: 'attention',
    sense: 'focus',
    definition: 'the act of focusing',
    contexts: [
      {
        resourceId: 'trash-pack',
        resourceTitle: 'Trash pack',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Trash pack',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(id: string) {
  const now = new Date().toISOString()
  return {
    id,
    resourceId: id,
    title: 'Trash pack',
    source: 'test',
    mode: 'heuristic' as const,
    generatedAt: now,
    summary: 'A short article.',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 3, itemCount: 1, readingMinutes: 1 },
    items: [makeItem()],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [{ index: 0, original: 'Attention is scarce.', itemIds: ['trash-item'] }],
  }
}

describe('trash', () => {
  before(async () => {
    await fs.mkdir(path.join(config.packsDir, 'pack-trash'), { recursive: true })
    await fs.writeFile(
      path.join(config.packsDir, 'pack-trash', 'pack.json'),
      JSON.stringify(makePack('pack-trash')),
      'utf8',
    )
  })

  after(async () => {
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('moves a pack to trash and restores its review state', async () => {
    const store = await Store.open(path.join(config.dataDir, 'store.json'))
    await store.upsertItems([makeItem()])
    await store.applyReview('trash-item', 4)
    const item = store.getItem('trash-item')!
    const record = {
      id: 'pack-trash',
      resourceId: 'pack-trash',
      dir: path.join(config.packsDir, 'pack-trash'),
      mode: 'heuristic' as const,
      itemCount: 1,
      createdAt: new Date().toISOString(),
    }
    await store.addPack(record)
    const entry = await trashPack(store, record)
    await store.removePack(record.id)
    await store.removeItems(['trash-item'])

    const entries = await listTrash()
    assert.equal(entries.length, 1)
    assert.equal(entries[0]?.id, entry.id)
    await assert.rejects(fs.access(path.join(config.packsDir, 'pack-trash')))

    const restored = await restoreTrash(store, entry.id)
    assert.equal(restored.kind, 'pack')
    assert.equal(store.findPack('pack-trash')?.dir, path.join(config.packsDir, 'pack-trash'))
    assert.deepEqual(store.getItem('trash-item')?.review, item.review)
    await fs.access(path.join(config.packsDir, 'pack-trash', 'pack.json'))
    assert.equal((await listTrash()).length, 0)
  })

  it('can purge a trash entry', async () => {
    const store = await Store.open(path.join(config.dataDir, 'store.json'))
    await store.upsertItems([makeItem()])
    const record = {
      id: 'pack-purge',
      resourceId: 'trash-pack',
      dir: path.join(config.packsDir, 'missing-pack'),
      mode: 'heuristic' as const,
      itemCount: 1,
      createdAt: new Date().toISOString(),
    }
    await store.addPack(record)
    const entry = await trashPack(store, record)
    assert.equal(await purgeTrash(entry.id), true)
    assert.equal((await listTrash()).length, 0)
  })
})
