import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import net from 'node:net'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter((candidate): candidate is string => Boolean(candidate))

export function findChrome(): string | undefined {
  return CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
}

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

async function waitForEndpoint(url: string, timeoutMs = 15_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Chrome did not expose ${url} within ${timeoutMs}ms.`)
}

export interface CdpPage {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, any>>
  evaluate: <T = unknown>(expression: string) => Promise<T>
  navigate: (url: string) => Promise<void>
  waitFor: (expression: string, timeoutMs?: number) => Promise<void>
  close: () => Promise<void>
}

export async function launchChrome(
  executable: string,
  profileDir: string,
): Promise<CdpPage> {
  await fs.mkdir(profileDir, { recursive: true })
  const port = await freePort()
  const child: ChildProcess = spawn(
    executable,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const endpoint = `http://127.0.0.1:${port}`
  try {
    await waitForEndpoint(`${endpoint}/json/version`)
  } catch (error) {
    child.kill()
    throw error
  }

  const target = (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' }).then((response) =>
    response.json(),
  )) as { webSocketDebuggerUrl: string }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let nextId = 0
  const pending = new Map<number, (value: Record<string, any>) => void>()
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number
      result?: Record<string, any>
      error?: { message?: string }
    }
    if (message.id && pending.has(message.id)) {
      const resolve = pending.get(message.id)!
      pending.delete(message.id)
      resolve(message.result ?? { error: message.error?.message })
    }
  }
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('Could not connect to Chrome DevTools.'))
  })

  const send = (method: string, params: Record<string, unknown> = {}): Promise<Record<string, any>> =>
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  const evaluate = async <T = unknown>(expression: string): Promise<T> => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Evaluation failed')
    }
    return result.result?.value as T
  }

  const navigate = async (url: string): Promise<void> => {
    const result = await send('Page.navigate', { url })
    if (result.errorText) throw new Error(`Navigation failed: ${result.errorText}`)
    const started = Date.now()
    while (Date.now() - started < 15_000) {
      const ready = await evaluate<string>('document.readyState')
      if (ready === 'complete') return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`Page did not finish loading: ${url}`)
  }

  const waitFor = async (expression: string, timeoutMs = 15_000): Promise<void> => {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const ready = await evaluate<boolean>(`Boolean(${expression})`)
      if (ready) return
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    throw new Error(`Timed out waiting for: ${expression}`)
  }

  const close = async (): Promise<void> => {
    void send('Browser.close').catch(() => {})
    ws.close()
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve()
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        resolve()
      }, 2000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {})
  }

  return { send, evaluate, navigate, waitFor, close }
}
