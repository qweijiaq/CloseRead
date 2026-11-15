import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { findChrome, launchChrome } from '../e2e/cdp.js'

const SITE = process.env.SITE ?? 'https://closeread.weijia.asia'
const out = path.resolve(import.meta.dirname, '..', 'assets', 'debug')

const ROUTES: Array<[string, string]> = [
  ['import', '/?tab=import'],
  ['packs', '/?tab=packs'],
  ['shared', '/?tab=shared'],
  ['feedback', '/?tab=feedback'],
  ['settings', '/?tab=settings'],
]

const chrome = findChrome()
if (!chrome) throw new Error('Chrome not found')
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'shots-'))
const page = await launchChrome(chrome, path.join(temp, 'profile'))
await page.send('Network.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
})

try {
  await fs.mkdir(out, { recursive: true })
  for (const [name, route] of ROUTES) {
    for (const [suffix, width, height] of [
      ['desktop', 1180, 900],
      ['mobile', 390, 844],
    ] as const) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: suffix === 'mobile',
      })
      await page.navigate(`${SITE}${route}`)
      await page.waitFor('document.readyState === "complete"')
      await page.evaluate('new Promise(r => setTimeout(r, 1600))')
      const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      if (!shot.data) throw new Error(`capture failed ${name}-${suffix}`)
      const file = path.join(out, `${name}-${suffix}.png`)
      await fs.writeFile(file, Buffer.from(shot.data, 'base64'))
      console.log(`${name}-${suffix}`, '→', file)
    }
  }
} finally {
  await page.close()
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {})
}
