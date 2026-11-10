import qrcode from 'qrcode-generator'

/**
 * Render a compact, scalable SVG QR code for a local URL.
 * The QR is generated on the machine that owns the token, never by a third party.
 */
export function qrSvg(value: string): string {
  const text = value.trim()
  if (!text) return ''
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr
    .createSvgTag({ cellSize: 4, margin: 4, scalable: true })
    .replace('<svg ', '<svg role="img" aria-label="手机访问二维码" ')
}
