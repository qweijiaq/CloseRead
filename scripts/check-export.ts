import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { findChrome, launchChrome } from '../e2e/cdp.js'

const SITE = process.env.SITE ?? 'https://closeread.weijia.asia'
const chrome = findChrome()
if (!chrome) throw new Error('Chrome not found')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'export-check-'))
const page = await launchChrome(chrome, profile)
await page.send('Network.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
})
await page.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false })
await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp/cr-downloads' })
await fs.mkdir('/tmp/cr-downloads', { recursive: true })

try {
  await page.navigate(`${SITE}/?tab=settings`)
  await page.waitFor('document.readyState === "complete"')
  await page.waitFor('document.getElementById("settings-backup") && document.getElementById("settings-backup").textContent.length > 0')
  await page.evaluate('new Promise(r => setTimeout(r, 2500))')

  const before = await page.evaluate<string>('document.getElementById("settings-backup").textContent.trim()')
  console.log('按钮初始文案:', before)

  await page.evaluate('document.getElementById("settings-backup").click()')

  for (let i = 0; i < 12; i += 1) {
    await page.evaluate('new Promise(r => setTimeout(r, 500))')
    const state = await page.evaluate<string>(
      `document.getElementById('settings-backup').textContent.trim() + ' | toast=' + ((document.getElementById('toast') || {}).textContent || '')`,
    )
    console.log(`${(i + 1) * 0.5}s:`, state)
  }

  const downloads = await fs.readdir('/tmp/cr-downloads').catch(() => [])
  console.log('下载目录:', downloads)
} finally {
  await page.close()
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
}
