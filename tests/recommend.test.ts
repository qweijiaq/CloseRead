import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { saveReadingProgress, loadReadingProgress } from '../src/reading/progress.js'
import { recommendNext } from '../src/review/recommend.js'
import { Store } from '../src/store/store.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-recommend-'))

after(async () => {
  await fs.rm(temp, { recursive: true, force: true })
})

function packJson(id: string, resourceId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    resourceId,
    title: id,
    source: 'test',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 900, itemCount: 0, readingMinutes: 5 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [{ index: 0, original: 'A paragraph.', translation: '一段。', itemIds: [] }],
    sourceText: 'A paragraph.',
    ...overrides,
  }
}

async function addPack(
  store: Store,
  root: string,
  id: string,
  resourceId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const dir = path.join(root, id)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(packJson(id, resourceId, overrides)), 'utf8')
  await store.addPack({
    id,
    resourceId,
    dir,
    mode: 'heuristic',
    itemCount: 0,
    createdAt: new Date().toISOString(),
  })
  return dir
}

describe('next reading recommendation', () => {
  it('ranks same-book, close difficulty and length first, and pushes finished packs down', async () => {
    const root = path.join(temp, 'rank')
    const store = await Store.open(path.join(root, 'store.json'))
    await addPack(store, root, 'current', 'book-a')
    await addPack(store, root, 'next-chapter', 'book-a', {
      stats: { wordCount: 950, itemCount: 0, readingMinutes: 5 },
    })
    await addPack(store, root, 'close', 'other', {
      stats: { wordCount: 850, itemCount: 0, readingMinutes: 4 },
    })
    await addPack(store, root, 'easy', 'other', {
      difficulty: { cefr: 'B1', reason: 'test' },
      stats: { wordCount: 600, itemCount: 0, readingMinutes: 3 },
    })
    await addPack(store, root, 'hard', 'other', {
      difficulty: { cefr: 'C2', reason: 'test' },
      stats: { wordCount: 3000, itemCount: 0, readingMinutes: 14 },
    })
    const finishedDir = await addPack(store, root, 'finished', 'other')
    const finished = await loadReadingProgress(finishedDir, 'finished', 1)
    await saveReadingProgress(finishedDir, {
      ...finished,
      readParagraphs: [0],
      finishedAt: new Date().toISOString(),
    })

    const result = await recommendNext(store, 'current', 6)
    assert.deepEqual(result.slice(0, 3).map((entry) => entry.id), ['next-chapter', 'close', 'easy'])
    assert.equal(result[0]?.reason, '同一本书的下一篇')
    assert.equal(result.find((entry) => entry.id === 'finished')?.finished, true)
    assert.equal(result.find((entry) => entry.id === 'finished')?.reason, '读过一遍，可以重读巩固')
    assert.ok(result.every((entry) => entry.id !== 'current'))
  })

  it('returns nothing when the current pack is missing or unreadable', async () => {
    const root = path.join(temp, 'missing')
    const store = await Store.open(path.join(root, 'store.json'))
    assert.deepEqual(await recommendNext(store, 'missing'), [])

    await store.addPack({
      id: 'broken',
      resourceId: 'r',
      dir: path.join(root, 'broken'),
      mode: 'heuristic',
      itemCount: 0,
      createdAt: new Date().toISOString(),
    })
    assert.deepEqual(await recommendNext(store, 'broken'), [])
  })
})
