import { deflateSync } from 'node:zlib'

const ICON_BACKGROUND = { r: 30, g: 107, b: 78, a: 255 }
const ICON_INK = { r: 255, g: 255, b: 255, a: 255 }

function pointInPolygon(x: number, y: number, points: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!
    const [xj, yj] = points[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const value of data) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function pixel(pixels: Buffer, size: number, x: number, y: number, color: typeof ICON_BACKGROUND): void {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const offset = (y * size + x) * 4
  pixels[offset] = color.r
  pixels[offset + 1] = color.g
  pixels[offset + 2] = color.b
  pixels[offset + 3] = color.a
}

/**
 * Render a small PNG app icon without a native image dependency.
 * A white bookmark on the CloseRead green reads at 48px and 512px.
 */
export function appIconPng(size: number): Buffer {
  const scale = size / 512
  const pixels = Buffer.alloc(size * size * 4)
  const bookmark: Array<[number, number]> = [
    [170, 96],
    [342, 96],
    [342, 416],
    [256, 346],
    [170, 416],
  ].map(([x, y]) => [x * scale, y * scale])
  const hole = { x: 256 * scale, y: 206 * scale, radius: 34 * scale }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const centerX = x + 0.5
      const centerY = y + 0.5
      const inBookmark = pointInPolygon(centerX, centerY, bookmark)
      const inHole =
        (centerX - hole.x) ** 2 + (centerY - hole.y) ** 2 <= hole.radius ** 2
      pixel(pixels, size, x, y, inBookmark && !inHole ? ICON_INK : ICON_BACKGROUND)
    }
  }

  const rowBytes = size * 4 + 1
  const raw = Buffer.alloc(rowBytes * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0
    pixels.copy(raw, y * rowBytes + 1, y * size * 4, (y + 1) * size * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

export function pwaManifest(): Record<string, unknown> {
  return {
    name: 'CloseRead',
    short_name: 'CloseRead',
    description: 'Local-first English intensive reading workspace.',
    start_url: '/?tab=home',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f6f3',
    theme_color: '#243b53',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: '今日', url: '/?tab=home' },
      { name: '阅读', url: '/?tab=packs' },
      { name: '词库', url: '/?tab=library' },
    ],
  }
}

/** Head tags and install-prompt hook shared by the app, reader and lab. */
export function pwaHead(): string {
  return `<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#243b53">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="CloseRead">
<script>window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__closereadInstall=event;var button=document.getElementById('settings-install');if(button)button.hidden=false;});if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}</script>`
}
