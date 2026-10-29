import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizePdfText, reflowPdfPage, stripRunningLines } from '../src/ingest/pdf.js'

describe('pdf text cleanup', () => {
  it('normalizes ligatures, soft hyphens, and curly quotes', () => {
    const text = normalizePdfText('The \uFB01ne print has a soft\u00adhyphen and \u201cquotes\u201d.')
    assert.equal(text, 'The fine print has a softhyphen and "quotes".')
  })

  it('rejoins hard-wrapped lines and keeps hyphenated words joined', () => {
    const reflowed = reflowPdfPage(
      [
        'The cost of attention is',
        'paid in small pieces.',
        'A well-',
        'known problem.',
      ].join('\n'),
    )
    assert.equal(reflowed, 'The cost of attention is paid in small pieces.\n\nA well-known problem.')
  })

  it('does not mistake a sentence for a document title', () => {
    const reflowed = reflowPdfPage('Every morning, millions of people\nreach for a small rectangle of glass.')
    assert.equal(reflowed, 'Every morning, millions of people reach for a small rectangle of glass.')
  })

  it('joins a word split across lines without a hyphen', () => {
    assert.equal(reflowPdfPage('Before t\nhey arrived, the room was quiet.'), 'Before they arrived, the room was quiet.')
    assert.equal(reflowPdfPage('I\nam here.'), 'I am here.')
  })

  it('removes repeated running headers and page numbers', () => {
    const pages = Array.from({ length: 5 }, (_, index) => ({
      page: index + 1,
      text: `THE BOOK TITLE\nPage ${index + 1}\nUnique paragraph ${index + 1} stays.`,
    }))
    const cleaned = stripRunningLines(pages)
    assert.ok(cleaned.every((page) => !page.text.includes('THE BOOK TITLE')))
    assert.ok(cleaned.every((page) => !page.text.includes('Page ')))
    assert.equal(cleaned[2]?.page, 3)
    assert.ok(cleaned[2]?.text.includes('Unique paragraph 3'))
  })

  it('leaves short documents untouched', () => {
    const pages = [
      { page: 1, text: 'THE BOOK TITLE\nPage 1' },
      { page: 2, text: 'THE BOOK TITLE\nPage 2' },
    ]
    assert.deepEqual(stripRunningLines(pages), pages)
  })
})
