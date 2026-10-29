import type { Segment } from '../types.js'

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+\n/g, '\n').trim())
    .filter((paragraph) => paragraph.length > 0)
}

function headingOf(line: string): string | undefined {
  const match = /^#{1,6}\s+(.+)$/.exec(line.trim())
  return match?.[1]?.trim()
}

export function segmentsFromText(text: string, startIndex = 0, page?: number): Segment[] {
  const paragraphs = splitParagraphs(text)
  const segments: Segment[] = []
  let heading: string | undefined

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n')
    const paragraphHeading = headingOf(lines[0] ?? '')
    let body = paragraph

    if (paragraphHeading) {
      heading = paragraphHeading
      body = lines.slice(1).join('\n').trim()
      if (!body) continue
    }

    if (body.length < 20) continue
    segments.push({
      index: startIndex + segments.length,
      text: body,
      page,
      heading,
    })
  }

  return segments
}

function normalizeTimestamp(value: string): string {
  const match = /(\d{1,2}):(\d{2}):(\d{2})/.exec(value)
  if (!match) return value.trim()
  return `${match[1]!.padStart(2, '0')}:${match[2]}:${match[3]}`
}

/** Parse SRT/VTT cues into timestamped segments. Falls back to paragraphs. */
export function parseTranscript(raw: string): { segments: Segment[]; text: string } {
  const normalized = raw.replace(/\r\n/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const segments: Segment[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) continue

    const timeLine = lines.find((line) => line.includes('-->'))
    if (!timeLine) continue

    const timeIndex = lines.indexOf(timeLine)
    const text = lines
      .slice(timeIndex + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue

    segments.push({
      index: segments.length,
      text,
      timestamp: normalizeTimestamp(timeLine.split('-->')[0] ?? ''),
    })
  }

  if (segments.length === 0) {
    return { segments: segmentsFromText(raw), text: raw.trim() }
  }

  return { segments, text: segments.map((segment) => segment.text).join('\n\n') }
}
