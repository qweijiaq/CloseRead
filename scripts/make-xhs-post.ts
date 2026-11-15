/**
 * Render the full 3:4 Xiaohongshu image set: real app screenshots placed in a
 * phone card with a caption, captured through headless Chrome.
 *
 *   pnpm tsx scripts/make-xhs-post.ts
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { findChrome, launchChrome } from '../e2e/cdp.js'

const SITE = process.env.XHS_SITE ?? 'https://closeread.weijia.asia'
const PHONE = { width: 390, height: 844 }

interface Shot {
  file: string
  index: string
  caption: string
  note?: string
  /** Path inside the app, or a special value handled below. */
  route: string
  /** Runs after load, before the screenshot. */
  prepare?: string
}

const SHOTS: Shot[] = [
  {
    file: '02-home.png', index: '01', caption: '打开就能读，不用注册',
    note: '今天读哪篇、读到哪一段，一眼看到', route: '/',
    prepare: "(() => { const b = document.getElementById('onboarding-dismiss'); if (b) b.click(); return true })()",
  },
  {
    file: '03-import.png', index: '02', caption: '贴链接，或丢一个 PDF 进来',
    note: '自动拆篇，目录广告页脚会被清掉', route: '/?tab=import',
    prepare: "(() => { const d = document.getElementById('llm-settings'); if (d) d.open = false; const t = document.querySelector('.source-tabs'); if (t) { t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -72); } return true })()",
  },
  {
    file: '04-reader.png', index: '03', caption: '英文原文 + 逐段中文',
    note: '每段都带一条精读笔记', route: '@reader',
    prepare: "(() => { const el = document.querySelector('[data-para-index=\"1\"]'); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -74); } return true })()",
  },
  { file: '05-packs.png', index: '04', caption: '读过的都在这里', note: '可以随时重新生成', route: '/?tab=packs' },
  {
    file: '06-settings.png', index: '05', caption: '内容只在你自己的浏览器里',
    note: '换设备导出一个文件就能搬走', route: '/?tab=settings',
    prepare: "(() => { const el = document.getElementById('settings-backup'); if (el) el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -72); return true })()",
  },
]

function frameHtml(shot: Shot, imageFile: string): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1440px; overflow: hidden; }
  body {
    position: relative; background: #f6f2e8; color: #1c1a16;
    font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif;
    padding: 64px 70px 56px; display: flex; flex-direction: column;
  }
  .wash { position: absolute; inset: 0;
    background:
      radial-gradient(52% 38% at 90% 4%, rgba(138,106,47,.15), transparent 70%),
      radial-gradient(46% 34% at 2% 98%, rgba(28,26,22,.06), transparent 72%); }
  .grain { position: absolute; inset: 0; opacity: .45;
    background-image: repeating-linear-gradient(0deg, rgba(28,26,22,.026) 0 1px, transparent 1px 3px); }
  header, .stage, footer { position: relative; }
  header { display: flex; align-items: baseline; gap: 18px; }
  .index { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 22px; letter-spacing: .18em; color: #8a6a2f; }
  h2 { font-family: Georgia, "Songti SC", serif; font-size: 50px; line-height: 1.24; letter-spacing: -.03em; font-weight: 700; }
  .note { margin-top: 10px; font-size: 24px; color: #6f6a60; }
  .stage { flex: 1 1 auto; display: grid; place-items: center; }
  .phone {
    position: relative; padding: 12px; border-radius: 34px;
    background: #1c1a16;
    box-shadow: 0 44px 90px rgba(28,26,22,.24), 0 8px 24px rgba(28,26,22,.14);
  }
  .phone img { display: block; width: 505px; border-radius: 24px; }
  footer { display: flex; align-items: center; justify-content: space-between;
    padding-top: 20px; border-top: 1px solid rgba(28,26,22,.14);
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 18px; letter-spacing: .1em; color: #8a8378; }
  footer b { color: #1c1a16; font-weight: 600; letter-spacing: .04em; }
</style></head>
<body>
  <div class="wash"></div><div class="grain"></div>
  <header>
    <div>
      <div class="index">${shot.index}</div>
      <h2>${shot.caption}</h2>
      ${shot.note ? `<div class="note">${shot.note}</div>` : ''}
    </div>
  </header>
  <div class="stage"><div class="phone"><img src="${imageFile}" alt=""></div></div>
  <footer><b>CloseRead</b><span>closeread.weijia.asia</span></footer>
</body></html>`
}


function closingHtml(): string {
  const steps = [
    ['01', '准备一个模型 Key', 'DeepSeek 最便宜，GLM / OpenAI 也行'],
    ['02', '打开 closeread.weijia.asia', '不用注册，手机上也行，建议添加到主屏幕'],
    ['03', '贴链接或传 PDF', '生成后直接开始精读'],
  ]
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1440px; overflow: hidden; }
  body {
    position: relative; background: #f6f2e8; color: #1c1a16;
    font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif;
    padding: 96px 84px 80px; display: flex; flex-direction: column;
  }
  .wash { position: absolute; inset: 0;
    background: radial-gradient(54% 40% at 88% 6%, rgba(138,106,47,.16), transparent 70%); }
  .grain { position: absolute; inset: 0; opacity: .45;
    background-image: repeating-linear-gradient(0deg, rgba(28,26,22,.026) 0 1px, transparent 1px 3px); }
  header, main, footer { position: relative; }
  .kicker { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 21px;
    letter-spacing: .26em; text-transform: uppercase; color: #8a6a2f; }
  h1 { margin: 22px 0 0; font-family: Georgia, "Songti SC", serif; font-size: 96px;
    line-height: 1.12; letter-spacing: -.04em; font-weight: 700; }
  main { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: flex-start; gap: 52px; padding-top: 104px; }
  .step { display: flex; gap: 26px; align-items: flex-start; }
  .step b { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 26px;
    color: #8a6a2f; padding-top: 8px; letter-spacing: .1em; }
  .step strong { display: block; font-size: 36px; font-weight: 650; letter-spacing: -.02em; }
  .step span { display: block; margin-top: 8px; font-size: 24px; color: #6f6a60; }
  footer { display: flex; align-items: baseline; justify-content: space-between;
    padding-top: 26px; border-top: 1px solid rgba(28,26,22,.14);
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 20px;
    letter-spacing: .1em; color: #8a8378; }
  footer b { color: #1c1a16; font-weight: 600; }
</style></head>
<body>
  <div class="wash"></div><div class="grain"></div>
  <header><div class="kicker">开始使用</div><h1>三步开始</h1></header>
  <main>
    ${steps.map(([n, title, note]) => `<div class="step"><b>${n}</b><div><strong>${title}</strong><span>${note}</span></div></div>`).join('')}
  </main>
  <footer><b>closeread.weijia.asia</b><span>开源 · 不卖课</span></footer>
</body></html>`
}

async function main(): Promise<void> {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome not found')
  const outDir = path.resolve(import.meta.dirname, '..', 'assets', 'xhs')
  await fs.mkdir(outDir, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xhs-post-'))

  const page = await launchChrome(chrome, path.join(workDir, 'profile'))
  try {
    // Capture the app at phone size first.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: PHONE.width,
      height: PHONE.height,
      deviceScaleFactor: 3,
      mobile: true,
    })

    for (const shot of SHOTS) {
      let route = shot.route
      if (route === '@reader') {
        await page.navigate(`${SITE}/?tab=read`)
        await page.waitFor('document.readyState === "complete"')
        const url = await page.evaluate<string>(
          `fetch('/api/packs').then(r => r.json()).then(d => (d.packs && d.packs[0] && d.packs[0].url) || '/')`,
        )
        route = url
      }
      await page.navigate(`${SITE}${route}`)
      await page.waitFor('document.readyState === "complete"')
      await page.evaluate('new Promise(r => setTimeout(r, 1200))')
      if (shot.prepare) {
        await page.evaluate(shot.prepare)
        await page.evaluate('new Promise(r => setTimeout(r, 400))')
      }
      const raw = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      if (!raw.data) throw new Error(`screen capture failed for ${shot.file}`)
      const shotFile = path.join(workDir, shot.file)
      await fs.writeFile(shotFile, Buffer.from(raw.data, 'base64'))

      // Compose into the 3:4 frame.
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: 1080,
        height: 1440,
        deviceScaleFactor: 2,
        mobile: false,
      })
      const htmlFile = path.join(workDir, `${shot.file}.html`)
      await fs.writeFile(htmlFile, frameHtml(shot, shotFile))
      await page.navigate(`file://${htmlFile}`)
      await page.evaluate('document.images[0] ? document.images[0].decode().then(() => true) : true')
      const out = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      if (!out.data) throw new Error(`frame capture failed for ${shot.file}`)
      await fs.writeFile(path.join(outDir, shot.file), Buffer.from(out.data, 'base64'))
      console.log(`${shot.file} → ${path.join(outDir, shot.file)}`)

      await page.send('Emulation.setDeviceMetricsOverride', {
        width: PHONE.width,
        height: PHONE.height,
        deviceScaleFactor: 3,
        mobile: true,
      })
    }
    // Closing card: no screenshot, just the three steps.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1080,
      height: 1440,
      deviceScaleFactor: 2,
      mobile: false,
    })
    const closingFile = path.join(workDir, '07-closing.html')
    await fs.writeFile(closingFile, closingHtml())
    await page.navigate(`file://${closingFile}`)
    await page.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true')
    const closingShot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    if (!closingShot.data) throw new Error('closing capture failed')
    await fs.writeFile(path.join(outDir, '07-closing.png'), Buffer.from(closingShot.data, 'base64'))
    console.log(`07-closing.png → ${path.join(outDir, '07-closing.png')}`)
  } finally {
    await page.close()
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
