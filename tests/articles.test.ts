import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  articleSections,
  getResourceArticles,
  isStudyArticle,
  resourceArticleCount,
  scopedResourceForArticle,
  splitResourceByHeadings,
} from '../src/ingest/articles.js'
import { segmentsFromText } from '../src/ingest/segment.js'
import type { Resource, ResourceArticle } from '../src/types.js'

const BODY =
  'This is a sufficiently long article body that should be treated as a real study unit by the editorial filter. '.repeat(
    12,
  )

function makeArticle(overrides: Partial<ResourceArticle>): ResourceArticle {
  return {
    index: 0,
    title: 'A real article',
    text: BODY,
    wordCount: 240,
    segments: [],
    ...overrides,
  }
}

function makeResource(text: string): Resource {
  return {
    id: 'issue',
    title: 'The Issue',
    kind: 'epub',
    source: 'issue.epub',
    text,
    wordCount: 40,
    segments: segmentsFromText(text),
    metadata: {},
    createdAt: new Date().toISOString(),
  }
}

describe('article splitting', () => {
  it('splits a heading-based resource into articles', () => {
    const resource = makeResource([`# First Article`, '', BODY, '', `# Second Article`, '', BODY].join('\n'))
    const articles = splitResourceByHeadings(resource)
    assert.equal(articles.length, 2)
    assert.deepEqual(articles.map((article) => article.title), ['First Article', 'Second Article'])
    assert.equal(resourceArticleCount(resource), 2)
  })

  it('keeps substantial front matter as an article', () => {
    const resource = makeResource([BODY, '', `# First Article`, '', BODY].join('\n'))
    const articles = splitResourceByHeadings(resource)
    assert.equal(articles.length, 2)
    assert.equal(articles[0]?.title, 'The Issue')
    assert.equal(resourceArticleCount(resource), 2)
  })

  it('prefers stored chapter boundaries over heading detection', () => {
    const resource = makeResource('# Heading\n\nBody text with enough words to be a paragraph in the resource.')
    resource.articles = [makeArticle({ title: 'Stored article' })]
    const articles = getResourceArticles(resource)
    assert.equal(articles.length, 1)
    assert.equal(articles[0]?.title, 'Stored article')
    assert.equal(resourceArticleCount(resource), 1)
  })

  it('creates a scoped resource with a unique id and article title', () => {
    const resource = makeResource(`# Heading\n\n${BODY}`)
    const article = makeArticle({ title: 'Heading', text: BODY })
    const scoped = scopedResourceForArticle(resource, article)
    assert.equal(scoped.id, 'issue--a0')
    assert.equal(scoped.title, 'Heading')
    assert.equal(scoped.metadata.parentResourceId, 'issue')
    assert.equal(scoped.metadata.articleIndex, 0)
    assert.ok(scoped.segments.length > 0)
  })
})

describe('article editorial filter', () => {
  it('rejects short pages, cartoons, tables of contents and data pages', () => {
    assert.equal(isStudyArticle(makeArticle({ title: 'Short section', wordCount: 61 })), false)
    assert.equal(isStudyArticle(makeArticle({ title: 'Cartoon: AI tsunami', wordCount: 104 })), false)
    assert.equal(isStudyArticle(makeArticle({ title: 'Table of Contents', wordCount: 590 })), false)
    assert.equal(isStudyArticle(makeArticle({ title: 'Economic data, commodities and markets', wordCount: 900 })), false)
    assert.equal(
      isStudyArticle(
        makeArticle({
          title: 'Politics',
          wordCount: 1253,
          text: 'The world this week Politics Oct 8th 2026 At least 250,000 demonstrators marched.',
        }),
      ),
      false,
    )
  })

  it('keeps long article-like chapters, including weekly digests', () => {
    assert.equal(isStudyArticle(makeArticle({ title: 'Politics', wordCount: 1253 })), true)
    assert.equal(isStudyArticle(makeArticle({ title: 'What if the machines take over science?', wordCount: 1021 })), true)
  })
})

describe('article sections', () => {
  it('carries the most recent short section page onto following articles', () => {
    const articles: ResourceArticle[] = [
      makeArticle({ index: 0, title: 'Asia', wordCount: 35 }),
      makeArticle({ index: 1, title: 'Can Asian governments prevent a food shock?', wordCount: 800 }),
      makeArticle({ index: 2, title: 'Business', wordCount: 61 }),
      makeArticle({ index: 3, title: 'Is the semiconductor industry headed for a crash?', wordCount: 900 }),
    ]
    const sections = articleSections(articles)
    assert.equal(sections.get(1), 'Asia')
    assert.equal(sections.get(3), 'Business')
  })
})
