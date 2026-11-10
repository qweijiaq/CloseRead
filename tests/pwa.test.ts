import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { appIconPng, pwaHead, pwaManifest } from '../src/review/pwa.js'

describe('PWA packaging', () => {
  it('generates valid square PNG icons at both install sizes', () => {
    for (const size of [192, 512]) {
      const png = appIconPng(size)
      assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      assert.equal(png.readUInt32BE(16), size)
      assert.equal(png.readUInt32BE(20), size)
      assert.ok(png.length > 500)
    }
  })

  it('declares a standalone manifest with install icons and shortcuts', () => {
    const manifest = pwaManifest() as {
      display: string
      start_url: string
      scope: string
      icons: Array<{ src: string; sizes: string }>
      shortcuts: Array<{ url: string }>
    }
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.start_url, '/?tab=home')
    assert.equal(manifest.scope, '/')
    assert.deepEqual(
      manifest.icons.map((icon) => [icon.src, icon.sizes]),
      [
        ['/icon-192.png', '192x192'],
        ['/icon-512.png', '512x512'],
      ],
    )
    assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === '/?tab=packs'))
  })

  it('adds manifest, icon and service-worker tags to pages', () => {
    const head = pwaHead()
    assert.match(head, /rel="manifest" href="\/manifest.webmanifest"/)
    assert.match(head, /apple-touch-icon/)
    assert.match(head, /serviceWorker\.register\('\/sw\.js'\)/)
    assert.match(head, /beforeinstallprompt/)
  })
})
