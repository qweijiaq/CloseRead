import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-visits-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')
process.env.LEARN_RUN_DIR = path.join(temp, 'run')
process.env.LEARN_PUBLIC_HOST = 'localhost:4317'

const visitsFile = path.join(temp, 'community', 'visits.json')

async function writeVisits(ids: string[]): Promise<void> {
  await fs.mkdir(path.dirname(visitsFile), { recursive: true })
  const visitors: Record<string, unknown> = {}
  for (const id of ids) visitors[id] = { first: Date.now(), last: Date.now() }
  await fs.writeFile(visitsFile, JSON.stringify({ version: 1, visitors }), 'utf8')
}

async function readCount(): Promise<number> {
  const parsed = JSON.parse(await fs.readFile(visitsFile, 'utf8')) as { visitors?: Record<string, unknown> }
  return Object.keys(parsed.visitors ?? {}).length
}

describe('visitor statistics', () => {
  it('loads the visit log and keeps it when flushed early', async () => {
    const { VisitorRegistry } = await import('../src/review/visitors.js')
    await writeVisits(['aaaaaaaa1111', 'bbbbbbbb2222', 'cccccccc3333'])
    const registry = new VisitorRegistry({} as never)
    await (registry as unknown as { ensureLoaded: () => Promise<void> }).ensureLoaded()
    assert.equal(registry.stats().totalUsers, 3)
    await registry.flush()
    assert.equal(await readCount(), 3)
  })

  it('never overwrites a populated log with an empty snapshot', async () => {
    const { VisitorRegistry } = await import('../src/review/visitors.js')
    await writeVisits(['dddddddd4444', 'eeeeeeee5555'])
    const registry = new VisitorRegistry({} as never)
    // No load, no visitors in memory: a flush here used to truncate the file.
    await registry.flush()
    assert.equal(await readCount(), 2)
  })

  it('keeps a backup copy next to the live log', async () => {
    const { VisitorRegistry } = await import('../src/review/visitors.js')
    await writeVisits(['ffffffff6666'])
    const registry = new VisitorRegistry({} as never)
    await (registry as unknown as { ensureLoaded: () => Promise<void> }).ensureLoaded()
    await registry.flush()
    const backup = await fs.readFile(`${visitsFile}.bak`, 'utf8').catch(() => '')
    assert.ok(backup.includes('ffffffff6666'))
  })
})
