import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { strToU8, zipSync } from 'fflate'

import { readEpubBuffer } from '../src/ingest/epub.js'
import { readMobi, readMobiBuffer } from '../src/ingest/mobi.js'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))

function makeEpub(): Buffer {
  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`
  const nav = `<html><body><nav><ol>
    <li><a href="ch1.xhtml">Chapter One</a></li>
    <li><a href="ch2.xhtml">Chapter Two</a></li>
    <li><a href="ch3.xhtml">Third from TOC</a></li>
  </ol></nav></body></html>`
  const chapter = `<html><body>
    <h1>Chapter One</h1>
    <p>Every morning, millions of people reach for a small rectangle of glass. Before they speak to another person, they have given a piece of their attention away.</p>
    <p>The exchange feels free, but it is not. Attention is the currency, and the bill arrives later.</p>
  </body></html>`
  const chapterTwo = `<html><body>
    <h1>Chapter Two</h1>
    <p>A well-made documentary, a difficult novel or a thoughtful conversation can leave a person more alert than before.</p>
    <p>The question is who gets to choose the direction of that alertness, and who pays for the choice.</p>
  </body></html>`
  const chapterThree = `<html><body>
    <p>The third chapter has no heading of its own, so its title has to come from the navigation document.</p>
    <p>That is exactly the case this test is covering.</p>
  </body></html>`

  return Buffer.from(
    zipSync({
      'META-INF/container.xml': strToU8(container),
      'OEBPS/content.opf': strToU8(opf),
      'OEBPS/nav.xhtml': strToU8(nav),
      'OEBPS/ch1.xhtml': strToU8(chapter),
      'OEBPS/ch2.xhtml': strToU8(chapterTwo),
      'OEBPS/ch3.xhtml': strToU8(chapterThree),
    }),
  )
}

describe('epub buffer', () => {
  it('extracts title, author, text, segments and articles without a file path', async () => {
    const result = await readEpubBuffer(makeEpub(), 'fallback')
    assert.equal(result.title, 'Test Book')
    assert.equal(result.creator, 'Test Author')
    assert.ok(result.text.includes('Attention is the currency'))
    assert.ok(result.segments.length >= 2)
    assert.equal(result.metadata.format, 'epub')
    assert.equal(result.articles.length, 3)
    assert.deepEqual(result.articles.map((article) => article.title), [
      'Chapter One',
      'Chapter Two',
      'Third from TOC',
    ])
    assert.ok(result.articles.every((article) => article.wordCount > 10))
  })

  it('reports a non-ZIP file clearly', async () => {
    await assert.rejects(() => readEpubBuffer(Buffer.from('not a zip'), 'bad'), /not a valid ZIP/i)
  })
})

describe('mobi parsing', () => {
  it('reads a MOBI (version 6) book', async () => {
    const result = await readMobi(path.join(fixtures, 'alice.mobi'))
    assert.match(result.title, /Alice/i)
    assert.ok(result.text.length > 10_000)
    assert.ok(result.segments.length > 100)
    assert.equal(result.metadata.parser, 'mobi')
    assert.match(result.text, /Rabbit-Hole/i)
    assert.ok(result.articles.length > 10)
    assert.ok(result.articles.some((article) => /Rabbit-Hole/i.test(article.title)))
  })

  it('reads a KF8 book and falls back past a broken chapter loader', async () => {
    const result = await readMobi(path.join(fixtures, 'alice-kf8.mobi'))
    assert.match(result.title, /Alice/i)
    assert.ok(result.text.length > 10_000)
    assert.ok(result.segments.length > 100)
    assert.equal(result.metadata.parser, 'azw3')
    assert.match(result.text, /Rabbit-Hole/i)
    assert.ok(result.articles.length > 10)
  })

  it('rejects a non-ebook buffer clearly', async () => {
    await assert.rejects(
      () => readMobiBuffer(Buffer.from('not a mobi'), { fallbackTitle: 'bad.mobi' }),
      /Could not read bad\.mobi/,
    )
  })
})
