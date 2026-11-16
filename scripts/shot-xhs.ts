/**
 * Builds the Xiaohongshu gallery: four typographic cards rendered from HTML and
 * a set of real product screenshots from the running site.
 *
 * Everything is 1080x1440 (3:4). Product shots use a 720x960 CSS viewport at
 * deviceScaleFactor 1.5; the phone shot uses 390x520 at 2.769.
 *
 * Usage: npx tsx scripts/shot-xhs.ts [baseUrl]
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, launchChrome, type CdpPage } from '../e2e/cdp.js'

const BASE = process.argv[2] ?? 'https://closeread.weijia.asia'
const OUT = path.resolve('assets/xhs')
const CARDS = path.join(OUT, 'cards')

const chrome = findChrome()
if (!chrome) throw new Error('Chrome not found')

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'xhs-'))
const page = await launchChrome(chrome, path.join(temp, 'profile'))
await page.send('Network.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
})

const sleep = (ms: number) => `new Promise(r => setTimeout(r, ${ms}))`

async function save(name: string, data: string | undefined) {
  if (!data) throw new Error(`capture failed: ${name}`)
  await fs.writeFile(path.join(OUT, name), Buffer.from(data, 'base64'))
  console.log(name)
}

async function viewport(width: number, height: number, scale: number, mobile = false) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile,
    screenWidth: width,
    screenHeight: height,
  })
}

async function open(url: string, wait = 1400) {
  await page.navigate(url.startsWith('http') ? url : `${BASE}${url}`)
  await page.waitFor('document.readyState === "complete"')
  await page.evaluate(sleep(wait))
}

async function shot(name: string, clip?: { x: number; y: number; width: number; height: number }) {
  const data = await page.send('Page.captureScreenshot', clip
    ? { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } }
    : { format: 'png' })
  await save(name, data.data as string | undefined)
}

async function shotCard(file: string, name: string) {
  await viewport(1080, 1440, 1)
  await page.navigate(`file://${path.join(CARDS, file)}`)
  await page.waitFor('document.readyState === "complete"')
  await page.evaluate('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 150)))')
  await shot(name)
}

/** Scrolls the first match so its top sits `offset` pixels below the viewport top. */
async function scrollTo(selector: string, offset = 60) {
  return page.evaluate<number>(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return -1
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - ${offset})
    window.scrollTo(0, top)
    return Math.round(top)
  })()`)
}

async function readerUrl(): Promise<string> {
  await viewport(720, 960, 1.5)
  await open('/?tab=shared')
  const fromShared = await page.evaluate<string>(
    `fetch('/api/shared').then(r => r.json()).then(d => (d.packs[0] || {}).url || '')`,
  )
  if (fromShared) return fromShared
  const mine = await page.evaluate<string>(
    `fetch('/api/packs').then(r => r.json()).then(d => (d.packs[0] || {}).url || '')`,
  )
  if (mine) return mine
  throw new Error('no pack available to screenshot')
}

/** Table of contents for the post, printed at the end. */
const order: string[] = []

try {
  await fs.mkdir(OUT, { recursive: true })

  /* ---- product shots: tablet-ish layout, 1080x1440 ---- */
  await viewport(720, 960, 1.5)

  await open('/?tab=import')
  await page.evaluate(`(() => {
    const body = document.getElementById('import-text-body')
    if (!body) return false
    body.value = 'Attention has quietly become the scarcest resource of the modern economy. It cannot be stored, borrowed, or bought in bulk, and every platform that captures it is really selling access to the people behind it.\\n\\nThe cost shows up in small places. A notification interrupts a sentence, a tab stays open for a week, and the work that needed an hour of silence never quite happens.\\n\\nDeliberate friction helps. Closing the laptop or writing the first sentence by hand turns an impulse into a decision.'
    body.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await page.evaluate(sleep(1600))
  await page.evaluate(`(() => { const el = document.getElementById('import-preview'); if (el) el.scrollIntoView({ block: 'center' }); return true })()`)
  await page.evaluate(sleep(300))
  await shot('03-import.png')
  order.push('03-import.png')

  const url = await readerUrl()
  await viewport(720, 960, 1.5)
  await open(url, 1800)
  await shot('04-reader-top.png')
  order.push('04-reader-top.png')

  await scrollTo('.paragraph', 40)
  await page.evaluate(sleep(300))
  await shot('05-paragraph.png')
  order.push('05-paragraph.png')

  await page.evaluate(`document.querySelectorAll('details').forEach(d => { d.open = true }); true`)
  await scrollTo('.item', 52)
  await page.evaluate(sleep(400))
  await shot('06-word-card.png')
  order.push('06-word-card.png')

  await scrollTo('.item', 52 - 0)
  await page.evaluate(`(() => {
    const item = document.querySelectorAll('.item')[1] || document.querySelector('.item')
    if (!item) return false
    const top = Math.max(0, item.getBoundingClientRect().top + window.scrollY - 52)
    window.scrollTo(0, top)
    return true
  })()`)
  await page.evaluate(sleep(300))
  await shot('07-word-card-detail.png')
  order.push('07-word-card-detail.png')

  await open('/?tab=shared')
  await shot('08-library.png')
  order.push('08-library.png')

  await open(url, 1600)
  await page.evaluate(`(() => { const b = document.getElementById('export-toggle'); if (b) b.click(); return true })()`)
  await page.evaluate(sleep(400))
  await shot('09-export.png')
  order.push('09-export.png')

  await open('/?tab=read')
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); true`)
  await page.evaluate(sleep(350))
  await shot('10-palette.png')
  order.push('10-palette.png')

  await open('/?tab=settings')
  await scrollTo('#settings-data', 120)
  await page.evaluate(sleep(300))
  await shot('11-settings.png')
  order.push('11-settings.png')

  /* ---- phone shot: 390x520 CSS at 2.769 = 1080x1440 ---- */
  await viewport(390, 520, 1080 / 390, false)
  await open(url, 1800)
  await page.evaluate('window.scrollTo(0, 0); true')
  await page.evaluate(sleep(300))
  await shot('12-mobile.png')
  order.push('12-mobile.png')

  /* ---- typographic cards ---- */
  await shotCard('01-cover.html', '01-cover.png')
  await shotCard('02-pain.html', '02-pain.png')
  await shotCard('13-compare.html', '13-compare.png')
  await shotCard('14-end.html', '14-end.png')

  order.push('01-cover.png', '02-pain.png', '13-compare.png', '14-end.png')
  console.log('\nfiles in assets/xhs:\n' + order.sort().join('\n'))
} finally {
  await page.close()
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {})
}
