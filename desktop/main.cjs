const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')

let PORT = Number(process.env.CLOSEREAD_PORT || 4317)
let server
let window
let splash

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, '127.0.0.1')
  })
}

async function pickPort() {
  if (process.env.CLOSEREAD_PORT) return PORT
  for (let candidate = 4317; candidate < 4350; candidate++) {
    if (await portAvailable(candidate)) return candidate
  }
  throw new Error('没有可用的本地端口（4317–4349）。')
}

function waitForServer(timeoutMs = 120000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const request = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1000 }, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) resolve()
        else retry()
      })
      request.on('error', retry)
      request.on('timeout', () => { request.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('CloseRead server did not start in time.'))
      else setTimeout(tick, 300)
    }
    tick()
  })
}

function startServer() {
  const root = app.getAppPath()
  const cli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const source = path.join(root, 'src', 'cli.ts')
  if (!fs.existsSync(cli) || !fs.existsSync(source)) {
    throw new Error('CloseRead source or tsx runtime is missing from the app bundle.')
  }
  // Allow a shell-launched desktop app to share the CLI's library when needed.
  const dataDir = process.env.LEARN_DATA_DIR
    ? path.resolve(process.env.LEARN_DATA_DIR)
    : path.join(app.getPath('userData'), 'data')
  const packsDir = process.env.LEARN_PACKS_DIR
    ? path.resolve(process.env.LEARN_PACKS_DIR)
    : path.join(app.getPath('userData'), 'packs')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(packsDir, { recursive: true })
  server = spawn(process.execPath, [cli, source, 'review', '--port', String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      LEARN_DATA_DIR: dataDir,
      LEARN_PACKS_DIR: packsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', (chunk) => process.stdout.write(`[closeread] ${chunk}`))
  server.stderr.on('data', (chunk) => process.stderr.write(`[closeread] ${chunk}`))
  server.on('exit', (code) => {
    if (code && window) {
      dialog.showErrorBox('CloseRead 服务已停止', `本地服务退出，代码 ${code}。请重新打开应用。`)
    }
  })
}

function createSplash() {
  splash = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: '#f6f2e8',
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{height:100%;margin:0;background:#f6f2e8;color:#1c1a16;font:14px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
    main{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 42px;box-sizing:border-box}
    h1{margin:0;font:600 34px Georgia,serif;letter-spacing:-.02em}
    p{margin:8px 0 0;color:rgba(28,26,22,.55)}
    i{display:block;width:36px;height:2px;background:#b03a2e;margin-top:22px}
  </style></head><body><main><h1>CloseRead</h1><p>正在启动本地阅读服务…</p><p>第一次启动需要半分钟，之后会快很多。</p><i></i></main></body></html>`
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  splash.on('closed', () => { splash = undefined })
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'CloseRead',
    backgroundColor: '#f6f2e8',
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  if (splash && !splash.isDestroyed()) splash.close()
  window.loadURL(`http://127.0.0.1:${PORT}/`)
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(`http://127.0.0.1:${PORT}`)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
  window.on('closed', () => { window = undefined })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })
  app.whenReady().then(async () => {
    try {
      createSplash()
      PORT = await pickPort()
      startServer()
      await waitForServer()
      createWindow()
    } catch (error) {
      if (splash && !splash.isDestroyed()) splash.close()
      dialog.showErrorBox('CloseRead 启动失败', error instanceof Error ? error.message : String(error))
      app.quit()
    }
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  app.on('before-quit', () => { if (server) server.kill() })
}
