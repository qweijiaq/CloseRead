import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import type { AnalyzeOutcome } from '../src/analyze/index.js'
import type { LearningItem, Resource } from '../src/types.js'
import { findChrome, launchChrome } from './cdp.js'
import type { CdpPage } from './cdp.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'closeread-e2e-'))
process.env.LEARN_DATA_DIR = path.join(temp, 'data')
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { writePack } = await import('../src/pack/build.js')
const { Store } = await import('../src/store/store.js')
const { storePath } = await import('../src/config.js')
const { startReviewServer } = await import('../src/review/server.js')

function makeResource(): Resource {
  const text = [
    'Attention has become one of the defining commodities of the modern economy. It cannot be stored or saved for later.',
    'The platforms that capture attention rarely sell it directly; they sell access to the people whose attention they have collected.',
    'A little friction can turn an impulse into a decision. That is why some products charge for use instead of attention.',
  ].join('\n\n')
  return {
    id: 'e2e-resource',
    title: 'E2E Reading Fixture',
    kind: 'text',
    source: 'e2e',
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    segments: text.split(/\n\n/).map((block, index) => ({ index, text: block })),
    metadata: { hash: 'e2e-hash' },
    createdAt: new Date().toISOString(),
  }
}

function makeItem(id: string, lemma: string, sentence: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma,
    sense: `the meaning of ${lemma}`,
    pos: 'noun',
    definition: `a working definition of ${lemma}`,
    definitionZh: `${lemma} 的中文释义`,
    contexts: [
      {
        resourceId: 'e2e-resource',
        resourceTitle: 'E2E Reading Fixture',
        segmentIndex: 0,
        sentence,
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'E2E Reading Fixture',
    createdAt: now,
    updatedAt: now,
  }
}

function makeOutcome(resource: Resource): AnalyzeOutcome {
  const items = [
    makeItem('e2e-item-attention', 'attention', 'Attention has become one of the defining commodities.'),
    makeItem('e2e-item-friction', 'friction', 'A little friction can turn an impulse into a decision.'),
  ]
  return {
    analysis: {
      summary: 'A short fixture about attention.',
      difficulty: { cefr: 'B2', reason: 'fixture' },
      items,
      exercises: { cloze: [], comprehension: [], discussion: [] },
      notes: [],
      reading: [
        {
          index: 0,
          original: 'Attention has become one of the defining commodities of the modern economy.',
          translation: '注意力已经成为现代经济中最具定义性的大宗商品之一。',
          itemIds: ['e2e-item-attention'],
        },
        {
          index: 1,
          original: 'The platforms that capture attention rarely sell it directly.',
          translation: '捕捉注意力的平台很少直接出售注意力。',
          itemIds: [],
        },
        {
          index: 2,
          original: 'A little friction can turn an impulse into a decision.',
          translation: '一点点阻力可以把冲动变成决定。',
          itemIds: ['e2e-item-friction'],
        },
      ],
    },
    mode: 'heuristic',
    notes: [],
    selection: {
      mode: 'auto',
      recommended: items.length,
      core: items.length,
      bonus: 0,
      wordCount: resource.wordCount,
      cefr: 'B2',
      reason: 'e2e fixture',
    },
  }
}

describe('browser reading flow', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let page: CdpPage
  let packId = ''

  before(async () => {
    const chrome = findChrome()
    assert.ok(chrome, 'Chrome is required for the e2e suite. Set CHROME_PATH if it is not in a default location.')
    const resource = makeResource()
    const result = await writePack(resource, makeOutcome(resource), {
      outDir: path.join(temp, 'packs', resource.id),
      includeSource: true,
      audio: false,
    })
    const store = await Store.open(storePath())
    await store.addResource(resource)
    await store.upsertItems(result.pack.items)
    await store.addPack(result.record)
    packId = result.record.id
    server = await startReviewServer({ port: 0 })
    page = await launchChrome(chrome, path.join(temp, 'chrome-profile'))
  })

  after(async () => {
    if (page) await page.close()
    if (server) await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('imports pasted text through the import form', async () => {
    await page.navigate(`${server.url}/?tab=import`)
    await page.waitFor("document.getElementById('import-text-body')")
    const text = 'A short article imported by the browser end-to-end test. It contains enough words for the import form to accept it without a model call.\n\nA second paragraph keeps the resource realistic and gives the library something to store.'
    await page.evaluate(`(() => {
      document.getElementById('import-text-title').value = 'E2E Imported Article';
      document.getElementById('import-text-body').value = ${JSON.stringify(text)};
    })()`)
    await page.evaluate("document.querySelector('#import-text-form button[type=\"submit\"]').click()")
    await page.waitFor("document.getElementById('recent-imports').textContent.includes('E2E Imported Article')")
  })

  it('keeps legacy tabs mapped to reading', async () => {
    await page.navigate(`${server.url}/?tab=home`)
    await page.waitFor("document.body.getAttribute('data-tab') === 'read'")
    await page.waitFor("document.getElementById('home-hero')")
    const home = await page.evaluate<string>('document.body.innerText')
    assert.doesNotMatch(home, /今日三件事/)
    assert.match(await page.evaluate<string>("document.querySelector('[data-tab=\"read\"]').textContent"), /精读/)
    assert.equal(await page.evaluate<number>("document.querySelectorAll('[data-tab=\"vocab\"]').length"), 0)
    await page.waitFor("document.querySelectorAll('#reading-stats .reading-stat').length === 4")

    await page.navigate(`${server.url}/?tab=library`)
    await page.waitFor("document.body.getAttribute('data-tab') === 'read'")
    await page.navigate(`${server.url}/?tab=review`)
    await page.waitFor("document.body.getAttribute('data-tab') === 'read'")
  })

  it('saves a diagnosis and renders the weekly review', async () => {
    await page.navigate(`${server.url}/?tab=insights`)
    await page.waitFor("document.getElementById('diagnosis-save')")
    await page.evaluate("document.querySelectorAll('[data-diagnosis-word]').forEach((button) => button.click())")
    await page.evaluate("document.getElementById('diagnosis-reveal').click()")
    await page.waitFor("!document.getElementById('diagnosis-save').disabled")
    await page.evaluate("document.getElementById('diagnosis-save').click()")
    await page.waitFor("document.getElementById('insight-diagnosis').textContent.includes('上次')")
    const diagnosis = await page.evaluate<string>("document.getElementById('insight-diagnosis').textContent")
    assert.match(diagnosis, /C2/)
    const weekly = await page.evaluate<string>("document.getElementById('insight-weekly').textContent")
    assert.match(weekly, /最近 7 天/)
  })

  it('renders achievements and the activity calendar', async () => {
    await page.navigate(`${server.url}/?tab=passport`)
    await page.waitFor("document.querySelectorAll('#passport-activity .activity-cell').length === 84")
    const data = await page.evaluate<{ achievements: number; cells: number; heading: string }>(`(() => ({
      achievements: document.querySelectorAll('#passport-achievements .achievement').length,
      cells: document.querySelectorAll('#passport-activity .activity-cell').length,
      heading: document.getElementById('passport-achievements').textContent,
    }))()`)
    assert.equal(data.achievements, 10)
    assert.equal(data.cells, 84)
    assert.match(data.heading, /成就/)
  })

  it('opens the settings center with data, backup and trash sections', async () => {
    await page.navigate(`${server.url}/?tab=settings`)
    await page.waitFor("document.querySelector('#settings-data') && document.querySelector('#settings-data').textContent.includes('数据目录')")
    const text = await page.evaluate<string>("document.getElementById('view-settings').textContent")
    assert.match(text, /设备迁移/)
    assert.match(text, /回收站/)
    assert.match(text, /本次运行用量/)
  })

  it('deletes a pack to trash and restores it from settings', async () => {
    const deleted = await fetch(`${server.url}/api/packs/${packId}/delete`, { method: 'POST' })
    assert.equal(deleted.status, 200)
    await page.navigate(`${server.url}/?tab=settings`)
    await page.waitFor("document.querySelector('[data-trash-restore]')")
    assert.equal(await page.evaluate<number>("document.querySelectorAll('[data-trash-restore]').length"), 1)
    await page.evaluate("document.querySelector('[data-trash-restore]').click()")
    await page.waitFor("document.getElementById('toast').textContent.includes('回收站')")
    const packs = (await fetch(`${server.url}/api/packs`).then((response) => response.json())) as {
      packs: Array<{ id: string }>
    }
    assert.ok(packs.packs.some((pack) => pack.id === packId))
  })

  it('serves the HTML export', async () => {
    const response = await fetch(`${server.url}/api/pack/${packId}/export/html`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/html/)
    assert.match(await response.text(), /E2E Reading Fixture/)
  })
})
