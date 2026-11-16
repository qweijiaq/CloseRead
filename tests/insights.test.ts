import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { promisify } from 'node:util'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-insights-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const execFileAsync = promisify(execFile)
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((candidate): candidate is string => Boolean(candidate))
const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))

const { startReviewServer } = await import('../src/review/server.js')
const { config } = await import('../src/config.js')

describe('diagnosis and weekly API', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>

  before(async () => {
    server = await startReviewServer({ port: 0 })
  })

  after(async () => {
    await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('returns a fresh diagnosis sample and saves a computed level', async () => {
    const initial = (await fetch(`${server.url}/api/diagnosis`).then((response) => response.json())) as {
      words: Array<{ lemma: string; level: string; gloss: string }>
      diagnosis: unknown
    }
    assert.equal(initial.words.length, 24)
    for (const level of ['B1', 'B2', 'C1', 'C2']) {
      assert.equal(initial.words.filter((word) => word.level === level).length, 6)
    }
    assert.equal(initial.diagnosis, null)

    const known = ['B1', 'B2', 'C1', 'C2'].flatMap((level) =>
      initial.words.filter((word) => word.level === level)
        .slice(0, 4)
        .map((word) => word.lemma),
    )
    const saved = (await fetch(`${server.url}/api/diagnosis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ known, words: initial.words.map((word) => word.lemma) }),
    }).then((response) => response.json())) as {
      diagnosis: { level: string; knownCount: number; total: number }
    }
    assert.equal(saved.diagnosis.level, 'C2')
    assert.equal(saved.diagnosis.knownCount, 16)
    assert.equal(saved.diagnosis.total, 24)
    assert.equal(config.level, 'C2')

    const reopened = (await fetch(`${server.url}/api/diagnosis`).then((response) => response.json())) as {
      diagnosis: { level: string }
    }
    assert.equal(reopened.diagnosis.level, 'C2')
  })

  it(
    'renders the diagnosis checklist and weekly card in a browser',
    { skip: chrome ? false : 'Chrome not found; set CHROME_PATH to run the insights smoke test.' },
    async () => {
      assert.ok(chrome)
      const sample = (await fetch(`${server.url}/api/diagnosis`).then((response) => response.json())) as {
        words: Array<{ lemma: string; level: string }>
      }
      const known = ['B1', 'B2', 'C1', 'C2'].flatMap((level) =>
        sample.words.filter((word) => word.level === level)
          .slice(0, 4)
          .map((word) => word.lemma),
      )
      await fetch(`${server.url}/api/diagnosis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ known, words: sample.words.map((word) => word.lemma) }),
      })
      const { stdout } = await execFileAsync(
        chrome,
        [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-component-update',
          '--disable-sync',
          '--disable-features=OptimizationGuideModelDownloading',
          `--user-data-dir=${path.join(temp, 'chrome-profile')}`,
          '--virtual-time-budget=8000',
          '--window-size=1200,900',
          '--dump-dom',
          `${server.url}/?tab=insights`,
        ],
        { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
      )
      // The gloss class and reveal control are rendered by the diagnosis card.
      assert.ok(stdout.includes('diagnosis-gloss'))
      assert.ok(stdout.includes('核对释义'))
      assert.ok(stdout.includes('上次 C2'))
      assert.ok(stdout.includes('16 / 24'))
    },
  )

  it('serves a weekly summary with the current level', async () => {
    const weekly = (await fetch(`${server.url}/api/weekly`).then((response) => response.json())) as {
      range: { days: number; start: string; end: string }
      level?: string
      reviews: { total: number }
      missed: unknown[]
    }
    assert.equal(weekly.range.days, 7)
    assert.match(weekly.range.start, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(weekly.range.end, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(weekly.level, 'C2')
    assert.equal(weekly.reviews.total, 0)
    assert.deepEqual(weekly.missed, [])
  })
})
