import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { looksLikeFeed, parseFeed } from '../src/ingest/feed.js'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>Older post</title>
      <link>https://example.com/older</link>
      <pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate>
      <description>An older summary.</description>
    </item>
    <item>
      <title>Newest post</title>
      <link>/newest</link>
      <pubDate>Thu, 05 Nov 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom article</title>
    <link rel="alternate" href="https://example.com/atom-article"/>
    <published>2026-11-04T09:00:00Z</published>
    <summary>Atom summary.</summary>
  </entry>
</feed>`

describe('feed parsing', () => {
  it('reads RSS items, resolves relative links and sorts newest first', () => {
    const feed = parseFeed(RSS, 'https://example.com/feed.xml')
    assert.equal(feed.title, 'Example Feed')
    assert.deepEqual(feed.items.map((item) => item.title), ['Newest post', 'Older post'])
    assert.equal(feed.items[0]?.link, 'https://example.com/newest')
    assert.equal(feed.items[1]?.summary, 'An older summary.')
  })

  it('reads Atom entries and alternate links', () => {
    const feed = parseFeed(ATOM, 'https://example.com/atom.xml')
    assert.equal(feed.title, 'Atom Feed')
    assert.equal(feed.items[0]?.title, 'Atom article')
    assert.equal(feed.items[0]?.link, 'https://example.com/atom-article')
    assert.equal(feed.items[0]?.published, '2026-11-04T09:00:00Z')
  })

  it('detects XML feeds without mistaking normal HTML for one', () => {
    assert.equal(looksLikeFeed(RSS), true)
    assert.equal(looksLikeFeed('<!doctype html><html><body>Hello</body></html>'), false)
    assert.equal(parseFeed('<rss><channel><title>Empty</title></channel></rss>', 'https://example.com').items.length, 0)
  })
})
