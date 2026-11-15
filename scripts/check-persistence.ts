/**
 * Persistence end to end, in one browser session:
 *   1. import an article and save a key
 *   2. checkpoint the workspace into IndexedDB
 *   3. restart the server from here
 *   4. reload the page and check that everything came back
 *
 *   pnpm tsx scripts/check-persistence.ts
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { findChrome, launchChrome } from '../e2e/cdp.js'

const run = promisify(execFile)
const SITE = process.env.SITE ?? 'https://closeread.weijia.asia'
const SSH = 'root@114.215.193.207'

async function restartServer(): Promise<void> {
  console.log('→ 重启服务器…')
  await run('ssh', ['-o', 'BatchMode=yes', SSH, 'cd /opt/closeread && docker compose restart app >/dev/null 2>&1'], {
    maxBuffer: 20e6,
  })
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const { stdout } = await run('ssh', ['-o', 'BatchMode=yes', SSH, 'curl -sS -m 4 -o /dev/null -w "%{http_code}" https://closeread.weijia.asia/api/health'], { maxBuffer: 1e6 })
      if (stdout.trim() === '200') {
        console.log('  服务已就绪')
        return
      }
    } catch {
      // still starting
    }
  }
  throw new Error('服务重启后没有恢复')
}

const chrome = findChrome()
if (!chrome) throw new Error('Chrome not found')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cr-persist-'))
const page = await launchChrome(chrome, profile)
await page.send('Network.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
})
await page.send('Emulation.setDeviceMetricsOverride', {
  width: 1100,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

try {
  await page.navigate(`${SITE}/`)
  await page.waitFor('document.readyState === "complete"')
  await page.evaluate('new Promise(r => setTimeout(r, 1500))')

  const title = `Persistence ${Date.now()}`
  const saved = await page.evaluate<Record<string, unknown>>(
    `(async () => {
      const imported = await fetch('/api/import/text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Persistence check paragraph one. Attention compounds, and small habits decide what a reader keeps over a year.', title: ${JSON.stringify(title)} })
      }).then(r => r.json())
      const llm = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'deepseek', apiKey: 'sk-persistence-test', model: 'deepseek-chat' })
      }).then(r => r.json())
      const checkpoint = await fetch('/api/checkpoint').then(r => r.json())
      const db = await import('/local-file-db.js')
      await db.saveFiles(checkpoint.files)
      return {
        imported: imported.resource ? imported.resource.title : imported,
        key: llm.status ? llm.status.configured : llm.error,
        checkpointFiles: (checkpoint.files || []).length,
        local: await db.summary()
      }
    })()`,
  )
  console.log('阶段 1（导入 + 存 Key）:', saved)

  await restartServer()

  console.log('→ 重新载入页面（同一浏览器，IndexedDB 未清）')
  await page.navigate(`${SITE}/`)
  await page.waitFor('document.readyState === "complete"')
  await page.evaluate('new Promise(r => setTimeout(r, 4000))')

  const after = await page.evaluate<Record<string, unknown>>(
    `(async () => {
      const db = await import('/local-file-db.js')
      const session = await fetch('/api/session').then(r => r.json())
      const packs = await fetch('/api/packs').then(r => r.json())
      const resources = await fetch('/api/resources?limit=20').then(r => r.json())
      const llm = await fetch('/api/llm').then(r => r.json())
      return {
        session,
        local: await db.summary(),
        packs: (packs.packs || []).map(p => p.title || p.id),
        resources: (resources.resources || []).map(r => r.title),
        keyConfigured: llm.status ? llm.status.configured : null
      }
    })()`,
  )
  console.log('阶段 2（重启后）:', after)

  // The test imports text only (no build), so check resources, not packs.
  const ok =
    Array.isArray(after.resources) &&
    (after.resources as string[]).some((r) => r.includes('Persistence')) &&
    after.keyConfigured === true
  console.log(ok ? '结论：数据保住了 ✓' : '结论：数据丢失 ✗')
  if (!ok) process.exitCode = 1
} finally {
  await page.close()
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
}
