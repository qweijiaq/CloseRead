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

  it('rejects unsupported content types with a clear message', async () => {
    await assert.rejects(() => fetchUrl(`${base}/binary`), /Unsupported content type/)
  })

  it('reports HTTP failures with the status', async () => {
    await assert.rejects(() => fetchUrl(`${base}/missing`), /HTTP 404/)
  })
})
