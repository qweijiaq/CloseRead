import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { loadReadingProgress, readingPercent, readingSummary, saveReadingProgress } from '../src/reading/progress.js'
import { sentenceIdentity } from '../src/analyze/sentence-card.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-reading-'))

after(async () => {
  await fs.rm(temp, { recursive: true, force: true })
})

describe('reading progress', () => {
  it('starts empty and persists paragraphs, position and finish state', async () => {
    const packDir = path.join(temp, 'pack-a')
    const initial = await loadReadingProgress(packDir, 'pack-a', 3)
    assert.equal(initial.totalParagraphs, 3)
    assert.deepEqual(initial.readParagraphs, [])
    assert.equal(readingPercent(initial), 0)

    await saveReadingProgress(packDir, {
      ...initial,
      readParagraphs: [2, 0, 2, 9, -1],
      lastParagraph: 2,
      startedAt: '2026-10-28T08:00:00.000Z',
    })
    const loaded = await loadReadingProgress(packDir, 'pack-a', 3)
    assert.deepEqual(loaded.readParagraphs, [0, 2])
    assert.equal(loaded.lastParagraph, 2)
    assert.equal(loaded.startedAt, '2026-10-28T08:00:00.000Z')
    assert.equal(readingPercent(loaded), 67)

    await saveReadingProgress(packDir, {
      ...loaded,
      readParagraphs: [0, 1, 2],
      finishedAt: '2026-10-28T09:00:00.000Z',
    })
    const finished = await loadReadingProgress(packDir, 'pack-a', 3)
    const summary = readingSummary(finished)
    assert.equal(summary.percent, 100)
    assert.equal(summary.finished, true)
    assert.equal(summary.read, 3)
    assert.equal(summary.total, 3)
  })

  it('returns a safe default for a missing or broken progress file', async () => {
    const packDir = path.join(temp, 'pack-b')
    await fs.mkdir(packDir, { recursive: true })
    await fs.writeFile(path.join(packDir, 'reading.json'), '{not json', 'utf8')
    const progress = await loadReadingProgress(packDir, 'pack-b', 5)
    assert.equal(progress.totalParagraphs, 5)
    assert.deepEqual(progress.readParagraphs, [])
    assert.equal(progress.finishedAt, undefined)
  })

  it('treats a sentence with or without its final period as the same card', () => {
    assert.equal(
      sentenceIdentity('  Instead,  they are tussling for influence. '),
      sentenceIdentity('Instead, they are tussling for influence'),
    )
  })
})
