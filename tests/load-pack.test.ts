import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { loadPack } from '../src/pack/mutate.js'

function validPack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pack-load',
    resourceId: 'resource-load',
    title: 'Load test',
    source: 'test',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 10, itemCount: 0, readingMinutes: 1 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [{ index: 0, original: 'A paragraph.', translation: '一段。', itemIds: [] }],
    sourceText: 'A paragraph.',
    ...overrides,
  }
}

describe('loadPack validation', () => {
  it('validates and preserves passthrough fields', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-load-'))
    try {
      await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(validPack()), 'utf8')
      const pack = await loadPack(dir)
      assert.equal(pack.title, 'Load test')
      assert.equal(pack.sourceText, 'A paragraph.')
      assert.equal(pack.reading?.[0]?.original, 'A paragraph.')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('reports invalid JSON and invalid fields with the file path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-load-invalid-'))
    try {
      await fs.writeFile(path.join(dir, 'pack.json'), '{', 'utf8')
      await assert.rejects(() => loadPack(dir), /not valid JSON.*pack\.json/)

      await fs.writeFile(path.join(dir, 'pack.json'), JSON.stringify(validPack({ title: '' })), 'utf8')
      await assert.rejects(() => loadPack(dir), /Invalid pack\.json.*title/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
