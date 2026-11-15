import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { findChrome, launchChrome } from '../e2e/cdp.js'

const SITE = process.env.XHS_SITE ?? 'https://closeread.weijia.asia'
const out = path.resolve(import.meta.dirname, '..', 'assets', 'debug')

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-shot-'))
const chrome = findChrome()
if (!chrome) throw new Error('Chrome not found')
const page = await launchChrome(chrome, path.join(temp, 'profile'))
try {
  for (const [file, width, height] of [
    ['reader-390.png', 390, 844],
    ['reader-360.png', 360, 780],
    ['reader-430.png', 430, 932],
  ] as const) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await page.navigate(`${SITE}/?tab=read`)
    await page.waitFor('document.readyState === "complete"')
    const url = await page.evaluate<string>(
      `fetch('/api/packs').then(r => r.json()).then(d => (d.packs && d.packs[0] && d.packs[0].url) || '/')`,
    )
    await page.navigate(`${SITE}${url}`)
    await page.waitFor('document.readyState === "complete"')
    await page.evaluate('new Promise(r => setTimeout(r, 1200))')
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    if (!shot.data) throw new Error(`capture failed ${file}`)
    await fs.mkdir(out, { recursive: true })
    await fs.writeFile(path.join(out, file), Buffer.from(shot.data, 'base64'))
    console.log(file, '→', path.join(out, file))

    // Whole page, so the reading area below the fold is visible in one image.
    const pageHeight = await page.evaluate<number>('Math.min(document.body.scrollHeight, 8000)')
    const sliceTop = await page.evaluate<number>("(() => { const el = document.querySelector('.paragraph'); return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80) : 1400 })()")
    const bodyShot = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: sliceTop, width, height: Math.min(1800, Math.max(400, pageHeight - sliceTop)), scale: 1 },
    })
    if (!bodyShot.data) throw new Error(`body capture failed ${file}`)
    const bodyFile = file.replace('.png', '-body.png')
    await fs.writeFile(path.join(out, bodyFile), Buffer.from(bodyShot.data, 'base64'))
    console.log(bodyFile, '→', path.join(out, bodyFile), `top=${Math.round(sliceTop)} total=${pageHeight}px`)
  }
} finally {
  await page.close()
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {})
}
