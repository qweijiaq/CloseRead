import { strFromU8, unzipSync } from 'fflate'

export interface DocxText {
  title: string
  text: string
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function paragraphText(xml: string): string {
  return decodeXml(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
}

/** Extract plain text and the core title from a DOCX package. */
export function readDocxBuffer(buffer: Buffer, fallbackTitle = ''): DocxText {
  if (buffer.length === 0) throw new Error('The uploaded DOCX is empty.')
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('The uploaded file is not a valid DOCX (ZIP) package.')
  }
  const document = files['word/document.xml']
  if (!document) throw new Error('The DOCX has no word/document.xml.')

  const xml = strFromU8(document)
  const paragraphs: string[] = []
  const pattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g
  for (const match of xml.matchAll(pattern)) {
    const text = paragraphText(match[1] ?? '').replace(/\r\n?/g, '\n').trimEnd()
    if (text.trim()) paragraphs.push(text)
  }

  const core = files['docProps/core.xml'] ? strFromU8(files['docProps/core.xml']!) : ''
  const titleMatch = /<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i.exec(core)
  const title = titleMatch ? decodeXml(titleMatch[1] ?? '').trim() : ''

  return {
    title: title || fallbackTitle,
    text: paragraphs.join('\n\n'),
  }
}
