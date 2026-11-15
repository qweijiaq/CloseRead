/**
 * Render the 3:4 Xiaohongshu covers as PNG.
 *
 *   pnpm tsx scripts/make-xhs-covers.ts
 *
 * Text is laid out in HTML and captured through headless Chrome so Chinese
 * glyphs stay crisp instead of being hallucinated by an image model.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { findChrome, launchChrome } from '../e2e/cdp.js'

interface Cover {
  file: string
  kicker: string
  /** May contain <em> for the accent-coloured word. */
  title: string
  bullets: string[]
  footer?: string
}

const COVERS: Cover[] = [
  {
    file: 'cover-1.png',
    kicker: '外刊精读',
    title: '别再一边<em>查词</em>\n一边读',
    bullets: ['逐段双语', '段落笔记', '原句词卡'],
    footer: 'closeread.weijia.asia',
  },
  {
    file: 'cover-2.png',
    kicker: 'PDF · 链接 · EPUB',
    title: '把外刊读成\n<em>精读课</em>',
    bullets: ['自动拆篇', '逐段翻译', '单词成卡'],
    footer: 'closeread.weijia.asia',
  },
  {
    file: 'cover-3.png',
    kicker: '读一段，懂一段',
    title: '读完就忘的\n日子<em>结束了</em>',
    bullets: ['精读笔记', '句子改写', '阅读记录'],
    footer: 'closeread.weijia.asia',
  },
]

function page(cover: Cover): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1440px; overflow: hidden; }
  body {
    position: relative;
    background: #f6f2e8;
    color: #1c1a16;
    font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif;
    padding: 92px 84px 84px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .wash {
    position: absolute; inset: 0;
    background:
      radial-gradient(58% 42% at 88% 6%, rgba(138,106,47,.16), transparent 70%),
      radial-gradient(50% 38% at 4% 96%, rgba(28,26,22,.07), transparent 72%);
  }
  .grain {
    position: absolute; inset: 0; opacity: .5;
    background-image: repeating-linear-gradient(0deg, rgba(28,26,22,.028) 0 1px, transparent 1px 3px);
  }
  header, main, footer { position: relative; }
  main { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; padding-bottom: 40px; }
  header { display: flex; align-items: center; gap: 18px; }
  .mark {
    width: 54px; height: 54px; border-radius: 14px;
    background: #1c1a16; color: #f6f2e8;
    display: grid; place-items: center;
    font-family: Georgia, "Songti SC", serif; font-size: 22px; letter-spacing: -.03em;
  }
  .brand {
    font-family: Georgia, "Songti SC", serif;
    font-size: 26px; letter-spacing: -.02em;
  }
  .brand small {
    display: block; margin-top: 3px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #8a8378;
  }
  .kicker {
    display: inline-block; margin-bottom: 34px; padding-bottom: 14px;
    border-bottom: 2px solid rgba(28,26,22,.16);
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 21px; letter-spacing: .26em; text-transform: uppercase; color: #8a6a2f;
  }
  h1 {
    font-family: Georgia, "Songti SC", "STSong", serif;
    font-size: 132px; line-height: 1.14; letter-spacing: -.035em; font-weight: 700;
    white-space: pre-line;
  }
  h1 em { font-style: normal; color: #8a6a2f; }
  .rule { margin: 54px 0 38px; width: 120px; height: 3px; background: #1c1a16; }
  .bullets { display: flex; flex-wrap: wrap; gap: 14px 40px; }
  .bullets span {
    font-size: 32px; letter-spacing: .01em; color: #3b3d40;
    display: inline-flex; align-items: center; gap: 16px;
  }
  .bullets span::before {
    content: ""; width: 9px; height: 9px; border-radius: 50%; background: #8a6a2f;
  }
  footer {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-top: 26px; border-top: 1px solid rgba(28,26,22,.14);
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 19px; letter-spacing: .1em; color: #8a8378;
  }
  footer b { color: #1c1a16; font-weight: 600; letter-spacing: .04em; }
</style>
</head>
<body>
  <div class="wash"></div>
  <div class="grain"></div>
  <header>
    <div class="mark">CR</div>
    <div class="brand">CloseRead<small>reading studio</small></div>
  </header>
  <main>
    <div class="kicker">${cover.kicker}</div>
    <h1>${cover.title}</h1>
    <div class="rule"></div>
    <div class="bullets">${cover.bullets.map((item) => `<span>${item}</span>`).join('')}</div>
  </main>
  <footer>
    <b>${cover.footer ?? ''}</b>
    <span>开源 · 数据留在浏览器</span>
  </footer>
</body>
</html>`
}

async function main(): Promise<void> {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome not found')

  const outDir = path.resolve(import.meta.dirname, '..', 'assets', 'xhs')
  await fs.mkdir(outDir, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xhs-cover-'))
  const profile = path.join(workDir, 'profile')

  const page_ = await launchChrome(chrome, profile)
  try {
    await page_.send('Emulation.setDeviceMetricsOverride', {
      width: 1080,
      height: 1440,
      deviceScaleFactor: 2,
      mobile: false,
    })
    for (const cover of COVERS) {
      const html = path.join(workDir, `${cover.file}.html`)
      await fs.writeFile(html, page(cover))
      await page_.navigate(`file://${html}`)
      await page_.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true')
      const shot = await page_.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      if (!shot.data) throw new Error(`capture failed for ${cover.file}: ${shot.error ?? ''}`)
      const file = path.join(outDir, cover.file)
      await fs.writeFile(file, Buffer.from(shot.data, 'base64'))
      console.log(`${cover.file} → ${file}`)
    }
  } finally {
    await page_.close()
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
