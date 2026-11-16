import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-hygiene-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { checkReadableEnglish, stripBoilerplate, stripPackWatermarks, stripWatermarksStrict } = await import(
  '../src/ingest/hygiene.js'
)
const { ingestText } = await import('../src/ingest/index.js')

const article =
  'Attention has quietly become the scarcest resource of the modern economy. ' +
  'A notification interrupts a sentence, a tab stays open for a week, and the work ' +
  'that needed an hour of silence never quite happens. Deliberate friction helps. '

describe('import hygiene', () => {
  it('removes download watermarks that end up as the first paragraph', () => {
    const text = [
      '本文由 zlibrary 从 https://www.economist.com/leaders/2026/10/22/example 下载',
      '',
      'Attention has quietly become the scarcest resource.',
      '',
      'https://zh.z-lib.gs/book/12345/abc',
    ].join('\n')
    const cleaned = stripBoilerplate(text)
    assert.ok(!cleaned.includes('zlibrary'))
    assert.ok(!cleaned.includes('z-lib'))
    assert.ok(cleaned.startsWith('Attention has quietly'))
  })

  it('keeps sentences that merely mention a source', () => {
    const text = 'The report, downloaded from a university archive, argues that reading is slow.'
    assert.equal(stripBoilerplate(text), text)
  })

  it('rejects Chinese-only input and accepts English prose', () => {
    const chinese = '注意力已经成为现代经济中最稀缺的资源。'.repeat(30)
    assert.equal(checkReadableEnglish(chinese).ok, false)
    assert.equal(checkReadableEnglish(article.repeat(4)).ok, true)
  })

  it('strips the watermark before the resource is stored', async () => {
    const resource = await ingestText(
      '本文由 zlibrary 从 https://www.economist.com/leaders/example 下载\n\n' + article.repeat(4),
    )
    assert.ok(!resource.text.includes('zlibrary'))
    assert.ok(resource.text.startsWith('Attention'))
  })

  it('empties a paragraph that was only a watermark', () => {
    const watermark = '本文由 zlibrary 从 https://www.economist.com/leaders/example 下载'
    assert.equal(stripWatermarksStrict(watermark), '')
    assert.equal(stripWatermarksStrict('A real paragraph about attention.'), 'A real paragraph about attention.')
  })

  it('cleans a pack before it is published', () => {
    const pack = {
      sourceText: '本文由 zlibrary 下载\n\nAttention has quietly become scarce.',
      reading: [
        { index: 0, original: '本文由 zlibrary 下载', translation: '', itemIds: [] },
        { index: 1, original: 'Attention has quietly become scarce.', translation: '注意力变得稀缺。', itemIds: [] },
      ],
    } as never
    assert.equal(stripPackWatermarks(pack), true)
    const cleaned = pack as unknown as {
      sourceText: string
      reading: Array<{ index: number; original: string }>
    }
    assert.ok(!cleaned.sourceText.includes('zlibrary'))
    assert.equal(cleaned.reading.length, 1)
    assert.equal(cleaned.reading[0]!.index, 0)
    assert.match(cleaned.reading[0]!.original, /Attention/)
  })

  it('refuses a resource that is not English prose', async () => {
    await assert.rejects(
      () => ingestText('注意力已经成为现代经济中最稀缺的资源。'.repeat(30)),
      /以中文为主|英文太少/,
    )
  })
})
