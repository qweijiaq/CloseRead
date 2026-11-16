import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { describe, it } from 'node:test'

import { renderHtml } from '../src/pack/html.js'
import type { LearningPack } from '../src/types.js'

const execFileAsync = promisify(execFile)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter((candidate): candidate is string => Boolean(candidate))

function findChrome(): string | undefined {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
}

const LONG_URL =
  'https://www.facebook.com/dialog/share?app_id=350309542584520&display=popup&href=https%3A%2F%2Fwww.mentalfloss.com%2Fhistory%2Fhow-nelson-mandela-wrote-long-walk-to-freedom-in-prison'

function makePack(): LearningPack {
  const original =
    'Nelson Mandela was the president of South Africa from 1994 to 1999. He is best known for helping to end the apartheid system.'
  return {
    id: 'pack-mobile-test',
    resourceId: 'r',
    title: 'Mobile Layout Test',
    source: 'test',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 20, itemCount: 0, readingMinutes: 1 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      { index: 0, original: LONG_URL, translation: '分享链接。', itemIds: [] },
      { index: 1, original, translation: '曼德拉从 1994 年到 1999 年担任南非总统。', itemIds: [] },
    ],
    sourceText: `${LONG_URL}\n\n${original}`,
  }
}

describe('mobile pack layout', () => {
  const chrome = findChrome()

  it(
    'keeps a paragraph with a long unbreakable URL inside the viewport',
    { skip: chrome ? false : 'Chrome not found; set CHROME_PATH to run the layout smoke test.' },
    async () => {
      assert.ok(chrome)
      const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'closeread-mobile-'))
      try {
        const probe =
          '<script>document.documentElement.setAttribute("data-scroll-width", String(document.documentElement.scrollWidth));' +
          'document.documentElement.setAttribute("data-inner-width", String(window.innerWidth));</script>'
        const html = renderHtml(makePack(), { items: {} }).replace('</body>', `${probe}\n</body>`)
        const file = path.join(dir, 'index.html')
        await fsp.writeFile(file, html, 'utf8')

        // Chrome refuses windows narrower than 500px, which still triggers the
        // pack's <=760px mobile layout and reproduces the long-URL overflow.
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
            '--hide-scrollbars',
            `--user-data-dir=${path.join(dir, 'profile')}`,
            '--virtual-time-budget=3000',
            '--window-size=500,900',
            '--dump-dom',
            pathToFileURL(file).href,
          ],
          { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
        )

        const scroll = /data-scroll-width="(\d+)"/.exec(stdout)
        const inner = /data-inner-width="(\d+)"/.exec(stdout)
        assert.ok(scroll, `probe did not run. Chrome output starts with: ${stdout.slice(0, 300)}`)
        assert.ok(inner, 'probe did not report the viewport width')
        const scrollWidth = Number(scroll[1])
        const innerWidth = Number(inner[1])
        assert.ok(
          scrollWidth <= innerWidth + 1,
          `pack page overflows horizontally at phone width: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`,
        )
      } finally {
        await fsp.rm(dir, { recursive: true, force: true })
      }
    },
  )
})
