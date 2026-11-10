import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import type { AnalyzeOutcome } from '../src/analyze/index.js'
import { writePack } from '../src/pack/build.js'
import { selectRemovableItems } from '../src/pack/rebuild.js'
import type { Resource } from '../src/types.js'

describe('pack build metadata', () => {
  it('writes a reproducible build fingerprint and page-aware reading', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-build-'))
    try {
      const now = new Date().toISOString()
      const resource: Resource = {
        id: 'resource-build',
        title: 'Build test',
        kind: 'pdf',
        source: 'test.pdf',
        text: 'A paragraph from a PDF.',
        wordCount: 6,
        segments: [{ index: 0, text: 'A paragraph from a PDF.', page: 4 }],
        metadata: { hash: 'input-hash' },
        createdAt: now,
      }
      const outcome: AnalyzeOutcome = {
        analysis: {
          summary: 'Summary',
          difficulty: { cefr: 'B2', reason: 'test' },
          items: [],
          exercises: { cloze: [], comprehension: [], discussion: [] },
          notes: [],
          reading: [
            {
              index: 0,
              original: 'A paragraph from a PDF.',
              translation: '一段来自 PDF 的文字。',
              itemIds: [],
              page: 4,
            },
          ],
        },
        mode: 'heuristic',
        notes: ['A build warning'],
        selection: {
          mode: 'auto',
          recommended: 1,
          core: 1,
          bonus: 0,
          wordCount: 6,
          cefr: 'B2',
          reason: 'test',
        },
      }
      const result = await writePack(resource, outcome, { outDir: dir, includeSource: true })
      assert.equal(result.pack.build?.inputHash, 'input-hash')
      assert.equal(result.pack.build?.mode, 'heuristic')
      assert.equal(result.pack.build?.warnings[0], 'A build warning')
      assert.equal(result.pack.reading?.[0]?.page, 4)
      const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8')) as {
        inputHash: string
      }
      assert.equal(meta.inputHash, 'input-hash')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps previously persisted cards when a pack is rebuilt', () => {
    const contexts: Record<string, Array<{ resourceId: string }>> = {
      keep: [{ resourceId: 'r1' }],
      other: [{ resourceId: 'r2' }],
      orphan: [{ resourceId: 'r1' }],
    }
    const removable = selectRemovableItems({
      previousItemIds: ['keep', 'other', 'orphan'],
      keepIds: new Set(['keep']),
      existingIds: new Set(['keep', 'other']),
      resourceId: 'r1',
      contextsOf: (id) => contexts[id],
    })
    assert.deepEqual(removable, ['orphan'])
  })
})
