import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import http from 'node:http'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { promisify } from 'node:util'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-lan-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')
delete process.env.LEARN_ACCESS_TOKEN

const execFileAsync = promisify(execFile)
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((candidate): candidate is string => Boolean(candidate))
const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))

const { startReviewServer } = await import('../src/review/server.js')
const { isLocalHostName, isLoopbackAddress } = await import('../src/review/lan.js')

describe('phone access', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let lanPort = 0
  let token = ''
  let cookie = ''

  before(async () => {
    server = await startReviewServer({ port: 0 })
  })

  after(async () => {
    await server.close()
    await fs.rm(temp, { recursive: true, force: true })
  })

  it('recognizes loopback addresses', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true)
    assert.equal(isLoopbackAddress('::1'), true)
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
    assert.equal(isLoopbackAddress('192.168.1.10'), false)
    assert.equal(isLoopbackAddress(undefined), false)
    assert.equal(isLocalHostName('127.0.0.1:4317'), true)
    assert.equal(isLocalHostName('localhost:4317'), true)
    assert.equal(isLocalHostName('[::1]:4317'), true)
    assert.equal(isLocalHostName('evil.example'), false)
  })

  it('enables a token-protected LAN server', async () => {
    const reboundStatus = await new Promise<number>((resolve, reject) => {
      const request = http.request(server.url, { headers: { host: 'evil.example' } }, (response) => {
        response.resume()
        resolve(response.statusCode ?? 0)
      })
      request.on('error', reject)
      request.end()
    })
    assert.equal(reboundStatus, 403)

    const initial = (await fetch(`${server.url}/api/lan`).then((response) => response.json())) as {
      enabled: boolean
      local: boolean
      urls: string[]
    }
    assert.equal(initial.enabled, false)
    assert.equal(initial.local, true)

    const crossOrigin = await fetch(`${server.url}/api/lan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ enabled: true }),
    })
    assert.equal(crossOrigin.status, 403)

    const enabled = (await fetch(`${server.url}/api/lan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }).then((response) => response.json())) as {
      enabled: boolean
      local: boolean
      port: number | null
      urls: string[]
      qr: Array<{ url: string; svg: string }>
    }
    assert.equal(enabled.enabled, true)
    assert.equal(enabled.local, true)
    assert.ok(enabled.port)
    assert.ok(Array.isArray(enabled.urls))
    assert.equal(enabled.qr.length, enabled.urls.length)
    if (enabled.qr[0]) {
      assert.equal(enabled.qr[0].url, enabled.urls[0])
      assert.match(enabled.qr[0].svg, /手机访问二维码/)
    }
    lanPort = enabled.port!

    const access = JSON.parse(await fs.readFile(path.join(temp, 'access.json'), 'utf8')) as { token: string }
    token = access.token
    assert.ok(token.length >= 16)
    const mode = (await fs.stat(path.join(temp, 'access.json'))).mode & 0o777
    assert.equal(mode, 0o600)
  })

  it('requires the token and then remembers it in a cookie', async () => {
    const denied = await fetch(`http://127.0.0.1:${lanPort}/`)
    assert.equal(denied.status, 401)
    assert.match(await denied.text(), /需要访问令牌/)

    const redirect = await fetch(`http://127.0.0.1:${lanPort}/?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    })
    assert.equal(redirect.status, 302)
    assert.equal(redirect.headers.get('location'), '/')
    const setCookie = redirect.headers.get('set-cookie') ?? ''
    assert.match(setCookie, /closeread_token=/)
    assert.match(setCookie, /HttpOnly/)
    cookie = setCookie.split(';')[0]!

    const page = await fetch(`http://127.0.0.1:${lanPort}/`, { headers: { cookie } })
    assert.equal(page.status, 200)
    assert.match(await page.text(), /精读 · CloseRead/)

    const api = await fetch(`http://127.0.0.1:${lanPort}/api/today`, { headers: { cookie } })
    assert.equal(api.status, 200)

    const status = (await fetch(`http://127.0.0.1:${lanPort}/api/lan`, { headers: { cookie } }).then((response) =>
      response.json(),
    )) as { enabled: boolean; local: boolean; urls: string[] }
    assert.equal(status.enabled, true)
    assert.equal(status.local, false)
    assert.deepEqual(status.urls, [])

    const control = await fetch(`http://127.0.0.1:${lanPort}/api/lan`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    assert.equal(control.status, 403)
  })

  it('keeps the phone token to reading, review and practice', async () => {
    const importDenied = await fetch(`http://127.0.0.1:${lanPort}/api/import/text`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'This should not be imported.' }),
    })
    assert.equal(importDenied.status, 403)
    assert.match(await importDenied.text(), /手机访问只支持/)

    const settingsDenied = await fetch(`http://127.0.0.1:${lanPort}/api/llm`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'not-used' }),
    })
    assert.equal(settingsDenied.status, 403)

    const backupDenied = await fetch(`http://127.0.0.1:${lanPort}/api/backup`, { headers: { cookie } })
    assert.equal(backupDenied.status, 403)

    const read = await fetch(`http://127.0.0.1:${lanPort}/api/resources`, { headers: { cookie } })
    assert.equal(read.status, 200)
  })

  it(
    'shows the phone access button in a browser',
    { skip: chrome ? false : 'Chrome not found; set CHROME_PATH to run the LAN UI smoke test.' },
    async () => {
      assert.ok(chrome)
      const { stdout } = await execFileAsync(
        chrome,
        [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${path.join(temp, 'chrome-lan')}`,
          '--virtual-time-budget=3000',
          '--window-size=1200,900',
          '--dump-dom',
          server.url,
        ],
        { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
      )
      const button = /<button[^>]*id="lan-toggle"[^>]*>/.exec(stdout)?.[0] ?? ''
      assert.ok(button)
      assert.ok(!/hidden/.test(button))
      assert.ok(stdout.includes('id="lan-panel"'))
    },
  )

  it('closes the LAN server when disabled', async () => {
    const disabled = (await fetch(`${server.url}/api/lan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    }).then((response) => response.json())) as { enabled: boolean; port: number | null }
    assert.equal(disabled.enabled, false)
    assert.equal(disabled.port, null)
    await assert.rejects(fs.access(path.join(temp, 'access.json')))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await assert.rejects(() => fetch(`http://127.0.0.1:${lanPort}/`, { headers: { cookie } }))
  })
})
