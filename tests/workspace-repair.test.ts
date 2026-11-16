import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Store } from '../src/store/store.js'
import { repairWorkspaceFromFiles } from '../src/review/visitors.js'
import type { Workspace } from '../src/config.js'

async function makeWorkspace(): Promise<Workspace> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-repair-'))
  const dataDir = path.join(base, 'data')
  const packsDir = path.join(base, 'packs')
  await fs.mkdir(path.join(dataDir, 'resources'), { recursive: true })
  await fs.mkdir(packsDir, { recursive: true })
  return { id: 'v1', dataDir, packsDir } as Workspace
}

async function writePack(workspace: Workspace, id: string, title: string): Promise<void> {
  const dir = path.join(workspace.packsDir, id)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'pack.json'),
    JSON.stringify({
      id,
      resourceId: 'r1',
      title,
      mode: 'llm',
      generatedAt: '2026-11-16T01:09:28.959Z',
      difficulty: { cefr: 'C2' },
      items: [{ id: 'item-1', lemma: 'attention' }],
    }),
    'utf8',
  )
}

describe('workspace repair', () => {
  it('rebuilds pack and resource records from the files on disk', async () => {
    const workspace = await makeWorkspace()
    await writePack(workspace, 'pack-a', 'Article A')
    await writePack(workspace, 'pack-b', 'Article B')
    await fs.writeFile(
      path.join(workspace.dataDir, 'resources', 'r1.json'),
      JSON.stringify({ id: 'r1', title: 'Source', kind: 'text', text: 'x', segments: [] }),
      'utf8',
    )
    const store = await Store.open(path.join(workspace.dataDir, 'store.json'))
    assert.equal(store.packs().length, 0)

    // Resources are loaded from their folder when the store opens; only the
    // pack records are missing.
    const repaired = await repairWorkspaceFromFiles(store, workspace)
    assert.equal(repaired, 2)
    assert.equal(store.packs().length, 2)
    assert.equal(store.findPack('pack-a')?.title, 'Article A')
    assert.equal(store.getResource('r1')?.title, 'Source')
    assert.ok(store.getItem('item-1'))
  })

  it('leaves a consistent workspace alone', async () => {
    const workspace = await makeWorkspace()
    await writePack(workspace, 'pack-a', 'Article A')
    const store = await Store.open(path.join(workspace.dataDir, 'store.json'))
    await repairWorkspaceFromFiles(store, workspace)
    const again = await repairWorkspaceFromFiles(store, workspace)
    assert.equal(again, 0)
  })
})
