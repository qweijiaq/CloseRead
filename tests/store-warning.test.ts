import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-warning-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const storeFile = path.join(temp, 'store.json')
const broken = '{"version":2,"items":['
await fs.writeFile(storeFile, broken, 'utf8')

const { startReviewServer } = await import('../src/review/server.js')

describe('store corruption warning', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>

  before(async () => {
    server = await startReviewServer({ port: 0 })
  })

  after(async () => {
    await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('quarantines the file and exposes the warning to the UI', async () => {
    const today = (await fetch(`${server.url}/api/today`).then((response) => response.json())) as {
      warnings: Array<{ code: string; message: string; path?: string }>
    }
    assert.equal(today.warnings.length, 1)
    assert.equal(today.warnings[0]?.code, 'corrupt-store')
    assert.match(today.warnings[0]?.message ?? '', /隔离/)
    assert.ok(today.warnings[0]?.path)
    assert.equal(await fs.readFile(today.warnings[0]!.path!, 'utf8'), broken)

    const summary = (await fetch(`${server.url}/api/summary`).then((response) => response.json())) as {
      warnings: unknown[]
    }
    assert.equal(summary.warnings.length, 1)

    const page = await fetch(`${server.url}/`).then((response) => response.text())
    assert.ok(page.includes('id="store-warning"'))
  })
})
