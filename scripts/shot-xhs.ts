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
import { findChrome, launchChrome } from '../e2e/cdp.js'

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

async function viewport(width: number, height: number, scale: number) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  })
}

const NO_SCROLLBAR =
  '::-webkit-scrollbar{width:0!important;height:0!important}html{scrollbar-width:none}'

async function open(url: string, wait = 1400) {
  await page.navigate(url.startsWith('http') ? url : `${BASE}${url}`)
  await page.waitFor('document.readyState === "complete"')
  await page.evaluate(sleep(wait))
  // Scrollbars are noise in a 3:4 crop.
  await page.evaluate(`(() => {
    const style = document.createElement('style')
    style.textContent = ${JSON.stringify(NO_SCROLLBAR)}
    document.head.appendChild(style)
    return true
  })()`)
}

async function shot(name: string) {
  const data = await page.send('Page.captureScreenshot', { format: 'png' })
  if (!data.data) throw new Error(`capture failed: ${name}`)
  await fs.writeFile(path.join(OUT, name), Buffer.from(data.data as string, 'base64'))
  console.log(name)
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
  const place = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return { found: false, delta: 0 }
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - ${offset})
    window.scrollTo(0, top)
    return { found: true, delta: Math.round(el.getBoundingClientRect().top - ${offset}) }
  })()`
  let result = await page.evaluate<{ found: boolean; delta: number }>(place)
  if (result.found && Math.abs(result.delta) > 40) {
    await page.evaluate(sleep(400))
    result = await page.evaluate<{ found: boolean; delta: number }>(place)
  }
  return result
}

async function readerUrl(): Promise<string> {
  await viewport(720, 960, 1.5)
  await open('/?tab=shared')
  // Prefer the built-in sample: cover, import estimate and reader all quote the
  // same 20-item article.
  const shared = await page.evaluate<string>(
    `fetch('/api/shared').then(r => r.json()).then(d => {
      const packs = d.packs || []
      const sample = packs.find((pack) => /quiet-cost/.test(pack.id)) || packs[0]
      return (sample || {}).url || ''
    })`,
  )
  if (shared) return shared
  const mine = await page.evaluate<string>(
    `fetch('/api/packs').then(r => r.json()).then(d => (d.packs[0] || {}).url || '')`,
  )
  if (!mine) throw new Error('no pack available to screenshot')
  return mine
}

try {
  await fs.mkdir(OUT, { recursive: true })

  const url = await readerUrl()
  // Before any pack is opened: no "已在你的文章" tags on the list.
  await open('/?tab=shared')
  await page.evaluate(sleep(800))
  await shot('09-library.png')

  /* ---- 03: paste an article, see the estimate ---- */
  await viewport(720, 960, 1.5)
  // Paste about 400 words of the sample article, so the estimate (~20 items)
  // matches the cover and the reader screenshot.
  const sample = await fs.readFile(path.resolve('samples/sample-article.md'), 'utf8')
  const blocks = sample
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !/^#{1,6}\s/.test(block) && !/^[-*>]/.test(block))
  const excerpt: string[] = []
  let words = 0
  for (const block of blocks) {
    const count = block.split(/\s+/).filter(Boolean).length
    if (words + count > 600 && excerpt.length > 0) {
      // Trim the last block so the estimate lands on exactly 30 items.
      const room = 600 - words
      if (room > 20) excerpt.push(block.split(/\s+/).slice(0, room).join(' '))
      break
    }
    excerpt.push(block)
    words += count
    if (words >= 600) break
  }
  await open('/?tab=import')
  await page.evaluate(`(() => {
    const body = document.getElementById('import-text-body')
    if (!body) return false
    body.value = ${JSON.stringify(excerpt.join('\n\n'))}
    body.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await page.evaluate(sleep(1600))
  await scrollTo('.import-card.wide', 150)
  await page.evaluate(sleep(300))
  await shot('03-import.png')

  /* ---- 04: the reader opens on the title and what the pack contains ---- */
  await open(url, 1700)
  await shot('04-reader-top.png')

  /* ---- 05: paragraph + translation ---- */
  await scrollTo('.paragraph', 40)
  await page.evaluate(sleep(300))
  await shot('05-paragraph.png')

  /* ---- 06: compact word cards under the paragraph ---- */
  await page.evaluate(
    `document.querySelectorAll('details.para-items-wrap, details.para-items').forEach(d => { d.open = true }); true`,
  )
  await page.evaluate(sleep(300))
  await page.evaluate(`(() => {
    const el = document.querySelectorAll('.para-items')[0]?.closest('details') ||
      document.querySelectorAll('.para-items')[0]
    if (!el) return false
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 110))
    return true
  })()`)
  await page.evaluate(sleep(300))
  await shot('06-word-cards.png')

  /* ---- 07: the same cards with definitions, collocations, examples open ---- */
  await page.evaluate(`document.querySelectorAll('details').forEach(d => { d.open = true }); true`)
  await page.evaluate(`(() => {
    const lists = document.querySelectorAll('.para-items')
    const el = lists[1] || lists[0]
    if (!el) return false
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 40))
    return true
  })()`)
  await page.evaluate(sleep(400))
  await shot('07-word-cards-detail.png')

  /* ---- 08: sentence-by-sentence reading, on a phone ---- */
  await viewport(390, 520, 1080 / 390)
  await open(url, 1700)
  await page.evaluate(`(() => {
    const button = document.querySelector('.para-focus')
    if (button) button.click()
    return Boolean(button)
  })()`)
  await page.evaluate(sleep(700))
  await page.evaluate(`(() => {
    const toggle = document.getElementById('focus-translation')
    if (toggle && toggle.textContent.includes('显示')) toggle.click()
    return true
  })()`)
  await page.evaluate(sleep(500))
  await shot('08-focus.png')
  await viewport(720, 960, 1.5)

  /* ---- 10: command palette ---- */
  await open('/?tab=read')
  await page.evaluate(
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); true`,
  )
  await page.evaluate(sleep(350))
  await shot('10-palette.png')

  /* ---- 11: phone, mid-article ---- */
  await viewport(390, 520, 1080 / 390)
  await open(url, 1700)
  await scrollTo('.paragraph', 70)
  await page.evaluate(sleep(300))
  await shot('11-mobile.png')

  /* ---- typographic cards ---- */
  await shotCard('01-cover.html', '01-cover.png')
  await shotCard('02-pain.html', '02-pain.png')
  await shotCard('12-compare.html', '12-compare.png')
  await shotCard('13-end.html', '13-end.png')
} finally {
  await page.close()
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {})
}
