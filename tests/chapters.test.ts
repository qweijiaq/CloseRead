import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getResourceArticles, splitResourceByHeadings } from '../src/ingest/articles.js'
import type { Resource } from '../src/types.js'

function resource(text: string, title = 'Book'): Resource {
  return {
    id: 'r1',
    title,
    kind: 'text',
    source: 'pasted',
    text,
    segments: [],
    wordCount: text.split(/\s+/).length,
    createdAt: new Date().toISOString(),
    metadata: {},
  } as Resource
}

const paragraph = (word: string): string =>
  `${word} matters more than it looks at first glance, because attention compounds and small habits decide what a reader keeps.`

describe('chapter splitting for text imports', () => {
  it('splits on Chinese chapter markers', () => {
    const text = [
      '第一章 起点',
      paragraph('one'),
      paragraph('two'),
      '第二章 转折',
      paragraph('three'),
      paragraph('four'),
    ].join('\n\n')
    const articles = splitResourceByHeadings(resource(text))
    assert.deepEqual(
      articles.map((article) => article.title),
      ['第一章 起点', '第二章 转折'],
    )
    assert.ok(articles[0]!.text.includes('attention compounds'))
    assert.ok(!articles[0]!.text.includes('第一章'))
  })

  it('splits on English chapter and part markers', () => {
    const text = [
      'Chapter I',
      paragraph('alpha'),
      paragraph('beta'),
      'Part II',
      paragraph('gamma'),
      paragraph('delta'),
    ].join('\n\n')
    const articles = splitResourceByHeadings(resource(text))
    assert.deepEqual(
      articles.map((article) => article.title),
      ['Chapter I', 'Part II'],
    )
  })

  it('accepts bracketed headings and Markdown headings', () => {
    const text = ['【前言】', paragraph('intro'), '# 第一章', paragraph('body')].join('\n\n')
    const articles = splitResourceByHeadings(resource(text))
    assert.equal(articles.length, 2)
    assert.equal(articles[0]!.title, '【前言】')
    assert.equal(articles[1]!.title, '第一章')
  })

  it('drops reference sections instead of shipping them as a chapter', () => {
    const text = [
      '第一章 正文',
      paragraph('body'),
      '参考文献',
      'Smith, J. (2020). A study of attention. Journal of Reading, 12(3), 45-67.',
      'Doe, A. (2019). Another study. Reading Quarterly, 8(1), 1-20.',
    ].join('\n\n')
    const articles = splitResourceByHeadings(resource(text))
    assert.equal(articles.length, 1)
    assert.ok(!articles[0]!.text.includes('Smith'))
  })

  it('keeps a plain article as one piece', () => {
    const text = [paragraph('alpha'), paragraph('beta')].join('\n\n')
    const articles = getResourceArticles(resource(text))
    assert.equal(articles.length, 1)
    assert.equal(articles[0]!.title, 'Book')
    assert.ok(articles[0]!.text.includes('alpha matters'))
  })
})
