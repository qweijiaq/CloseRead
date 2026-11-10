import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { restoreLibraryBackup, writeLibraryBackup } from '../src/store/backup.js'
import { Store } from '../src/store/store.js'
import type { LearningItem, Resource } from '../src/types.js'

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'backup-item',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'mental focus',
    definition: 'the act of focusing the mind',
    contexts: [
      {
        resourceId: 'backup-resource',
        resourceTitle: 'Backup resource',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Backup resource',
    createdAt: now,
    updatedAt: now,
  }
}

function makeResource(): Resource {
  return {
    id: 'backup-resource',
    title: 'Backup resource',
    kind: 'text',
    source: 'pasted',
    text: 'A sufficiently long source text for the backup resource.',
    wordCount: 9,
    segments: [],
    metadata: {},
    createdAt: new Date().toISOString(),
  }
}

describe('library backup', () => {
  it('round-trips items and resources', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-backup-roundtrip-'))
    try {
      const sourcePath = path.join(dir, 'source', 'store.json')
      const source = await Store.open(sourcePath)
      await source.upsertItems([makeItem()])
      await source.addResource(makeResource())

      const backupFile = path.join(dir, 'library.json')
      const written = await writeLibraryBackup(source, backupFile)
      assert.equal(written.items, 1)
      assert.equal(written.resources, 1)
      const payload = JSON.parse(await fs.readFile(backupFile, 'utf8')) as {
        format: string
        version: number
        resources: unknown[]
      }
      assert.equal(payload.format, 'closeread-library')
      assert.equal(payload.version, 1)
      assert.equal(payload.resources.length, 1)

      const targetPath = path.join(dir, 'target', 'store.json')
      const restored = await restoreLibraryBackup(backupFile, targetPath, path.join(dir, 'target', 'resources'))
      assert.equal(restored.items, 1)
      assert.equal(restored.resources, 1)

      const target = await Store.open(targetPath)
      assert.equal(target.listItems().length, 1)
      assert.equal(target.getResource('backup-resource')?.title, 'Backup resource')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps a pre-restore copy when the target already exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-backup-restore-'))
    try {
      const sourcePath = path.join(dir, 'source', 'store.json')
      const source = await Store.open(sourcePath)
      await source.upsertItems([makeItem()])
      const backupFile = path.join(dir, 'library.json')
      await writeLibraryBackup(source, backupFile)

      const targetPath = path.join(dir, 'target', 'store.json')
      const first = await Store.open(targetPath)
      await first.setDesiredRetention(0.9)
      await first.addResource(makeResource())
      const result = await restoreLibraryBackup(backupFile, targetPath, path.join(dir, 'target', 'resources'))
      assert.ok(result.safetyCopy)
      const saved = JSON.parse(await fs.readFile(result.safetyCopy!, 'utf8')) as { items: unknown[] }
      assert.equal(saved.items.length, 0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('backs up pack files, reading progress and quotes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-backup-pack-'))
    try {
      const sourceData = path.join(dir, 'source', 'data')
      const sourcePacks = path.join(dir, 'source', 'packs')
      const packDir = path.join(sourcePacks, 'pack-backup')
      await fs.mkdir(packDir, { recursive: true })
      await fs.writeFile(path.join(packDir, 'pack.json'), JSON.stringify({ id: 'pack-backup' }), 'utf8')
      await fs.writeFile(
        path.join(packDir, 'reading.json'),
        JSON.stringify({ packId: 'pack-backup', readParagraphs: [0] }),
        'utf8',
      )
      const source = await Store.open(path.join(sourceData, 'store.json'))
      await source.upsertItems([makeItem()])
      await source.addPack({
        id: 'pack-backup',
        resourceId: 'backup-resource',
        dir: packDir,
        mode: 'heuristic',
        itemCount: 1,
        createdAt: new Date().toISOString(),
      })
      await fs.writeFile(
        path.join(sourceData, 'quotes.json'),
        JSON.stringify([{ id: 'quote-1', text: 'Keep reading.' }]),
        'utf8',
      )

      const backupFile = path.join(dir, 'full.json')
      await writeLibraryBackup(source, backupFile)
      const payload = JSON.parse(await fs.readFile(backupFile, 'utf8')) as {
        packs?: Array<{ name: string; files: Array<{ path: string }> }>
        quotes?: unknown[]
      }
      assert.equal(payload.packs?.[0]?.name, 'pack-backup')
      assert.ok(payload.packs?.[0]?.files.some((file) => file.path === 'reading.json'))
      assert.equal(payload.quotes?.length, 1)

      const targetData = path.join(dir, 'target', 'data')
      const targetPacks = path.join(dir, 'target', 'packs')
      const restored = await restoreLibraryBackup(
        backupFile,
        path.join(targetData, 'store.json'),
        path.join(targetData, 'resources'),
        targetPacks,
      )
      assert.ok(restored.packFiles && restored.packFiles >= 2)
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(targetPacks, 'pack-backup', 'reading.json'), 'utf8')),
        { packId: 'pack-backup', readParagraphs: [0] },
      )
      const target = await Store.open(path.join(targetData, 'store.json'))
      assert.equal(target.packs()[0]?.dir, path.join(targetPacks, 'pack-backup'))
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(targetData, 'quotes.json'), 'utf8')),
        [{ id: 'quote-1', text: 'Keep reading.' }],
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects files that are not library backups', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-backup-invalid-'))
    try {
      const file = path.join(dir, 'bad.json')
      await fs.writeFile(file, JSON.stringify({ format: 'something-else', version: 1 }), 'utf8')
      await assert.rejects(
        () => restoreLibraryBackup(file, path.join(dir, 'store.json'), path.join(dir, 'resources')),
        /not supported|valid store|resource list/i,
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
