import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { zipSync } from 'fflate'

import { planExportPagesWithAi } from '../analyze/export-pages.js'
import type { LearningPack } from '../types.js'
import { findChrome, renderPackExportHtml } from './export.js'
import type { ExportPageBlock } from './page-plan.js'

const execFileAsync = promisify(execFile)

const METRICS_SCRIPT = `<script>window.addEventListener('load',function(){setTimeout(function(){
  var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-export-block]'));
  var data = blocks.map(function (el) {
    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);
    var marginTop = parseFloat(style.marginTop) || 0;
    var marginBottom = parseFloat(style.marginBottom) || 0;
    return {
      id: el.getAttribute('data-block-id'),
      label: el.getAttribute('data-block-label') || '',
      kind: el.getAttribute('data-block-kind') || 'section',
      height: Math.max(1, Math.ceil(rect.height + marginTop + marginBottom))
    };
  });
  var pre = document.createElement('pre');
  pre.id = 'export-block-metrics';
  pre.style.display = 'none';
  pre.textContent = 'BASE64:' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  document.body.appendChild(pre);
}, 120);});</script>`

function injectScript(html: string, script: string): string {
  return html.replace('</body>', `${script}</body>`)
}

function pageScript(ids: string[]): string {
  return `<script>window.addEventListener('load',function(){setTimeout(function(){
  var keep = ${JSON.stringify(ids)};
  document.querySelectorAll('[data-export-block]').forEach(function (el) {
    if (keep.indexOf(el.getAttribute('data-block-id')) === -1) el.style.display = 'none';
  });
  document.title = 'HEIGHT:' + Math.ceil(document.documentElement.scrollHeight);
}, 120);});</script>`
}

async function measureBlocks(
  chrome: string,
  html: string,
  dir: string,
): Promise<ExportPageBlock[]> {
  const measurePath = path.join(dir, 'measure.html')
  await fs.writeFile(measurePath, injectScript(html, METRICS_SCRIPT), 'utf8')
  const { stdout } = await execFileAsync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=2500',
      '--dump-dom',
      `file://${measurePath}`,
    ],
    { timeout: 90_000, maxBuffer: 32 * 1024 * 1024 },
  )
  const match = /id="export-block-metrics"[^>]*>BASE64:([A-Za-z0-9+/=]+)</.exec(stdout)
  if (!match) throw new Error('无法测量导出分区，请稍后重试。')
  const decoded = Buffer.from(match[1]!, 'base64').toString('utf8')
  const blocks = JSON.parse(decoded) as ExportPageBlock[]
  return blocks.filter((block) => block.id && block.height > 0)
}

export interface PngPagesOptions {
  width?: number
  maxHeight?: number
}

/**
 * Split the static export into several PNGs at logical block boundaries.
 * The LLM proposes the grouping; a deterministic height-based plan is the fallback.
 */
export async function renderPackPngPages(
  pack: LearningPack,
  options: PngPagesOptions = {},
): Promise<Uint8Array> {
  const chrome = findChrome()
  if (!chrome) {
    throw new Error('本机没有找到 Chrome/Chromium，暂时无法生成 PNG 分图。')
  }
  const width = Math.max(640, Math.min(1600, Math.round(options.width ?? 900)))
  const maxHeight = Math.max(2400, Math.min(12000, Math.round(options.maxHeight ?? 5000)))
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-png-pages-'))
  try {
    const html = renderPackExportHtml(pack)
    const blocks = await measureBlocks(chrome, html, dir)
    if (blocks.length === 0) throw new Error('导出内容为空，无法生成分图。')
    const plan = await planExportPagesWithAi(blocks, maxHeight)
    const groups = plan.groups
    const files: Record<string, Uint8Array> = {}
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index]!
      const pagePath = path.join(dir, `page-${index + 1}.html`)
      const pngPath = path.join(dir, `page-${index + 1}.png`)
      await fs.writeFile(
        pagePath,
        injectScript(
          html,
          pageScript(group.blocks.map((block) => block.id)),
        ),
        'utf8',
      )
      const height = Math.max(1200, Math.min(30000, Math.ceil(group.height) + 160))
      await execFileAsync(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--hide-scrollbars',
          '--default-background-color=ffffff',
          '--run-all-compositor-stages-before-draw',
          '--virtual-time-budget=2200',
          `--window-size=${width},${height}`,
          `--screenshot=${pngPath}`,
          `file://${pagePath}`,
        ],
        { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
      )
      files[`${String(index + 1).padStart(2, '0')}.png`] = await fs.readFile(pngPath)
    }
    const manifest = groups
      .map((group, index) => {
        const name = `${String(index + 1).padStart(2, '0')}.png`
        return `${name}\t${group.height}px\t${group.blocks.map((block) => block.label).join(' / ')}`
      })
      .join('\n')
    files['pages.txt'] = Buffer.from(
      `PNG 分图 · ${pack.title}\n分页方式：${plan.planner === 'ai' ? 'AI 规划' : '按高度自动分组'}${plan.reason ? `（${plan.reason}）` : ''}\n\n${manifest}\n`,
      'utf8',
    )
    return zipSync(files, { level: 0 })
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
