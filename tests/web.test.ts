import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, describe, it } from 'node:test'

import { detectBlockedPage, extractArticle, fetchUrl, titleFromUrl } from '../src/ingest/web.js'

const ARTICLE_HTML = `<!doctype html>
<html>
<head>
  <meta property="og:title" content="The Article Title">
  <title>Site Title</title>
</head>
<body>
  <nav>NAVIGATION SHOULD DISAPPEAR</nav>
  <div class="cookie-banner">COOKIE BANNER SHOULD DISAPPEAR</div>
  <article>
    <h1>The Article Title</h1>
    <p>Every morning, millions of people reach for a small rectangle of glass. Before they speak to another person, they have given a piece of their attention to a company they will never meet.</p>
    <p>The exchange feels free, but it is not. Attention is the currency, and the bill arrives later, in the form of tiredness and scattered thought.</p>
  </article>
  <footer>FOOTER SHOULD DISAPPEAR</footer>
</body>
</html>`

const NOISY_ARTICLE_HTML = `<!doctype html>
<html>
<head><title>Noisy Article</title></head>
<body>
  <article>
    <div class="share-tools"><a href="https://facebook.com/dialog/share?app_id=1">Share</a></div>
    <p><a href="https://www.facebook.com/dialog/share?app_id=350309542584520&amp;display=popup&amp;href=https%3A%2F%2Fexample.com%2Fstory"></a><a href="https://twitter.com/intent/tweet?text=Story&amp;url=https%3A%2F%2Fexample.com%2Fstory"></a></p>
    <p>Add us as a preferred source</p>
    <figure><img src="mandela.jpg"><figcaption>Nelson Mandela against a curtain | Per-Anders Pettersson/GettyImages</figcaption></figure>
    <p>Nelson Mandela was the president of South Africa from 1994 to 1999. He is best known for helping to end the nation's segregated apartheid system and fostering a peaceful transition to democracy.</p>
    <p>Prior to his election, he spent 27 years in prison for opposing the apartheid system. While there, he managed to pen a draft of his autobiography in secret, with the help of fellow prisoners.</p>
    <p>Mandela was sentenced to life in prison in 1964 for his work in the armed faction of the African National Congress. The manuscript was later smuggled out of prison and became the basis of a book.</p>
    <p>Nelson Mandela celebrating World Reconciliation Day in Melbourne | Hamish Blair/GettyImages</p>
    <p>Read More:</p>
    <p>Home/HISTORY</p>
  </article>
</body>
</html>`

describe('article extraction', () => {
  it('prefers the article container and removes page furniture', () => {
    const article = extractArticle(ARTICLE_HTML, 'example.com')
    assert.equal(article.title, 'The Article Title')
    assert.equal(article.selector, 'article')
    assert.ok(article.chars > 200)
    assert.ok(article.text.includes('Attention is the currency'))
    assert.ok(!article.text.includes('NAVIGATION'))
    assert.ok(!article.text.includes('COOKIE BANNER'))
    assert.ok(!article.text.includes('FOOTER'))
  })

  it('drops share widgets, image captions and site prompts from an article', () => {
    const article = extractArticle(NOISY_ARTICLE_HTML, 'example.com')
    assert.equal(article.selector, 'article')
    assert.ok(article.text.includes('Nelson Mandela was the president'))
    assert.ok(article.text.includes('Prior to his election'))
    assert.ok(!article.text.includes('facebook.com'))
    assert.ok(!article.text.includes('twitter.com'))
    assert.ok(!article.text.includes('preferred source'))
    assert.ok(!article.text.includes('GettyImages'))
    assert.ok(!article.text.includes('Read More'))
    assert.ok(!article.text.includes('Home/HISTORY'))
    assert.ok(!article.text.includes('Share'))
    assert.equal(article.text.split(/\n{2,}/).filter(Boolean).length, 3)
  })

  it('detects a bot or paywall page only as a hint', () => {
    const blocked = detectBlockedPage(
      '<html><head><title>Just a moment...</title></head><body>Checking your browser before accessing.</body></html>',
    )
    assert.match(blocked ?? '', /paywall|login|bot check/i)
    assert.equal(detectBlockedPage(ARTICLE_HTML), null)
  })

  it('falls back to the body when no article container exists', () => {
    const paragraph =
      'Attention is shaped by the environment, and a room full of interruptions teaches a different relationship to silence. '
    const article = extractArticle(`<html><body><div><p>${paragraph.repeat(4)}</p></div></body></html>`, 'example.com')
    assert.equal(article.selector, 'body')
    assert.ok(article.text.includes('Attention is shaped by the environment'))
  })

  it('derives a readable title from a URL', () => {
    assert.equal(titleFromUrl('https://example.com/my-great-article'), 'My Great Article')
    assert.equal(titleFromUrl('https://example.com/files/report.pdf'), 'Report')
    assert.equal(titleFromUrl('https://example.com/'), 'example.com')
  })
})

describe('url fetching', () => {
  let server: http.Server
  let base: string

  before(async () => {
    server = http.createServer((request, response) => {
      switch (request.url) {
        case '/article':
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          response.end(ARTICLE_HTML)
          break
        case '/plain':
          response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
          response.end('Plain text from a URL.')
          break
        case '/pdf':
          response.writeHead(200, { 'content-type': 'application/pdf' })
          response.end('%PDF-1.4\nfake pdf body')
          break
        case '/feed':
          response.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' })
          response.end('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>')
          break
        case '/feed-html':
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          response.end('<?xml version="1.0"?><feed><title>Feed</title></feed>')
          break
        case '/binary':
          response.writeHead(200, { 'content-type': 'application/octet-stream' })
          response.end('binary')
          break
        default:
          response.writeHead(404, { 'content-type': 'text/plain' })
          response.end('not found')
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    base = `http://127.0.0.1:${port}`
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('classifies HTML, plain text, and PDF responses', async () => {
    const html = await fetchUrl(`${base}/article`)
    assert.ok(html.html?.includes('The Article Title'))
    assert.equal(html.finalUrl, `${base}/article`)

    const plain = await fetchUrl(`${base}/plain`)
    assert.equal(plain.text, 'Plain text from a URL.')

    const pdf = await fetchUrl(`${base}/pdf`)
    assert.ok(pdf.pdf && pdf.pdf.byteLength > 0)
    assert.equal(pdf.html, undefined)
  })

  it('detects RSS/Atom by content type and by XML body', async () => {
    const feed = await fetchUrl(`${base}/feed`)
    assert.ok(feed.xml?.includes('<rss>'))
    assert.equal(feed.html, undefined)

    const disguised = await fetchUrl(`${base}/feed-html`)
    assert.ok(disguised.xml?.includes('<feed>'))
    assert.equal(disguised.html, undefined)
  })

  it('rejects unsupported content types with a clear message', async () => {
    await assert.rejects(() => fetchUrl(`${base}/binary`), /Unsupported content type/)
  })

  it('reports HTTP failures with the status', async () => {
    await assert.rejects(() => fetchUrl(`${base}/missing`), /HTTP 404/)
  })
})
