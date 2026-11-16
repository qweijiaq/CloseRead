import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { checkPublishable } from '../src/community/moderation.js'

const article =
  'Attention has quietly become the scarcest resource of the modern economy. ' +
  'A notification interrupts a sentence, a tab stays open for a week, and the work ' +
  'that needed an hour of silence never quite happens. Deliberate friction helps. '

describe('publish screen', () => {
  it('accepts ordinary magazine prose', () => {
    assert.equal(checkPublishable({ title: 'The price of attention', text: article.repeat(4) }).ok, true)
  })

  it('accepts articles that discuss politics plainly', () => {
    const politics =
      'The president is losing his charm. Coalition partners are nervous, and the ' +
      'opposition says the budget ignores the middle class. Analysts expect a cabinet reshuffle. '
    assert.equal(checkPublishable({ title: 'Indonesia', text: politics.repeat(4) }).ok, true)
  })

  it('rejects adult material', () => {
    const result = checkPublishable({ title: 'x', text: article + ' Watch porn now on this site.' })
    assert.equal(result.ok, false)
    assert.match(result.reason ?? '', /成人/)
  })

  it('rejects graphic violence', () => {
    const result = checkPublishable({ title: 'x', text: article + ' The video shows a beheading.' })
    assert.equal(result.ok, false)
    assert.match(result.reason ?? '', /血腥/)
  })

  it('rejects two or more extremist markers', () => {
    const text = article + ' 分裂国家 and 颠覆国家政权 are both printed here as slogans.'
    const result = checkPublishable({ title: 'x', text })
    assert.equal(result.ok, false)
    assert.match(result.reason ?? '', /极端/)
  })

  it('rejects packs that still carry a download watermark', () => {
    const result = checkPublishable({
      title: 'x',
      text: article.repeat(3) + '\n本文由 zlibrary 从 https://www.economist.com/leaders/example 下载',
    })
    assert.equal(result.ok, false)
    assert.match(result.reason ?? '', /水印/)
  })

  it('rejects non-English material', () => {
    const result = checkPublishable({ title: 'x', text: '注意力已经成为现代经济中最稀缺的资源。'.repeat(30) })
    assert.equal(result.ok, false)
  })
})
