import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { qrSvg } from '../src/review/qr.js'

describe('phone pairing QR', () => {
  it('renders a self-contained scalable SVG', () => {
    const svg = qrSvg('http://192.168.1.20:4318/?token=abc123')
    assert.match(svg, /^<svg /)
    assert.match(svg, /role="img"/)
    assert.match(svg, /手机访问二维码/)
    assert.match(svg, /viewBox="0 0 /)
    assert.match(svg, /<path /)
    assert.match(svg, /<\/svg>$/)
  })

  it('is deterministic and rejects empty input', () => {
    const first = qrSvg('http://127.0.0.1:4317/?token=x')
    assert.equal(first, qrSvg('http://127.0.0.1:4317/?token=x'))
    assert.equal(qrSvg('   '), '')
  })
})
