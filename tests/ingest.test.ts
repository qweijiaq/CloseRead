import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-ingest-'))
process.env.LEARN_DATA_DIR = tempData

const { ingestSource, ingestText, normalizeUrl } = await import('../src/ingest/index.js')
const { config } = await import('../src/config.js')

const ARTICLE = `# The Quiet Cost of Attention

Every morning, millions of people reach for a small rectangle of glass. Before they speak to another person, they have given a piece of their attention to a company they will never meet.

The exchange feels free, but it is not. Attention is the currency, and the bill arrives later, in the form of tiredness and scattered thought.`

describe('text ingestion', () => {
  before(() => {
    fs.mkdir(config.dataDir, { recursive: true })
  })

  after(async () => {
    await fs.rm(tempData, { recursive: true, force: true })
  })

  it('ingests pasted text with a Markdown heading as the title', async () => {
    const resource = await ingestText(ARTICLE)
    assert.equal(resource.kind, 'text')
    assert.equal(resource.title, 'The Quiet Cost of Attention')
    assert.ok(resource.wordCount > 30)
    assert.ok(resource.segments.length >= 2)
    assert.equal(resource.source, 'pasted')

    const saved = JSON.parse(
      await fs.readFile(path.join(config.dataDir, 'resources', `${resource.id}.json`), 'utf8'),
    ) as { title: string; text: string }
    assert.equal(saved.title, resource.title)
    assert.ok(saved.text.includes('Attention is the currency'))
  })

  it('uses an explicit title and falls back to "Pasted text"', async () => {
    const titled = await ingestText(ARTICLE, { title: 'My saved article' })
    assert.equal(titled.title, 'My saved article')

    const untitled = await ingestText(
      'Every morning, millions of people reach for a small rectangle of glass. Before they speak to another person, they have given a piece of their attention away.\n\nThe exchange feels free, but it is not.',
    )
    assert.equal(untitled.title, 'Pasted text')
  })

  it('rejects input that is too short to study', async () => {
    await assert.rejects(() => ingestText('Too short.'), /too little text/i)
  })
})

describe('input routing', () => {
  it('adds https to bare domains but leaves file names alone', () => {
    assert.equal(normalizeUrl('example.com/article'), 'https://example.com/article')
    assert.equal(normalizeUrl('www.economist.com/2026/10/27/attention'), 'https://www.economist.com/2026/10/27/attention')
    assert.equal(normalizeUrl('example.com/article.html'), 'https://example.com/article.html')
    assert.equal(normalizeUrl('http://localhost:4317/pack/x'), 'http://localhost:4317/pack/x')
    assert.equal(normalizeUrl('article.pdf'), null)
    assert.equal(normalizeUrl('./notes.md'), null)
    assert.equal(normalizeUrl('some pasted sentence'), null)
  })

  it('reports a missing file instead of treating it as pasted text', async () => {
    await assert.rejects(() => ingestSource('does-not-exist.txt'), /File not found/)
  })

  it('reports a missing URL target as a file path error for known extensions', async () => {
    await assert.rejects(() => ingestSource('missing-article.pdf'), /File not found/)
  })
})
