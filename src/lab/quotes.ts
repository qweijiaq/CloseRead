import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'

export interface Quote {
  id: string
  text: string
  translation?: string
  packId?: string
  sourceTitle?: string
  commentary?: string
  createdAt: string
}

function quotesPath(): string {
  return path.join(config.dataDir, 'quotes.json')
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalize(value: unknown): Quote | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const text = clean(raw.text, 2000)
  if (!text) return undefined
  return {
    id: clean(raw.id, 80) || `quote-${randomUUID()}`,
    text,
    ...(clean(raw.translation, 2000) ? { translation: clean(raw.translation, 2000) } : {}),
    ...(clean(raw.packId, 160) ? { packId: clean(raw.packId, 160) } : {}),
    ...(clean(raw.sourceTitle, 240) ? { sourceTitle: clean(raw.sourceTitle, 240) } : {}),
    ...(clean(raw.commentary, 1200) ? { commentary: clean(raw.commentary, 1200) } : {}),
    createdAt: clean(raw.createdAt, 40) || new Date().toISOString(),
  }
}

async function read(): Promise<Quote[]> {
  try {
    const data = JSON.parse(await fs.readFile(quotesPath(), 'utf8')) as unknown
    if (!Array.isArray(data)) return []
    return data.map(normalize).filter((quote): quote is Quote => Boolean(quote))
  } catch {
    return []
  }
}

async function write(quotes: Quote[]): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true })
  const target = quotesPath()
  const temp = `${target}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify(quotes, null, 2), 'utf8')
  await fs.rename(temp, target)
}

export async function listQuotes(): Promise<Quote[]> {
  const quotes = await read()
  return quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function addQuote(input: {
  text: string
  translation?: string
  packId?: string
  sourceTitle?: string
  commentary?: string
}): Promise<Quote> {
  const text = clean(input.text, 2000)
  if (!text) throw new Error('金句不能为空。')
  const quote: Quote = {
    id: `quote-${randomUUID()}`,
    text,
    ...(clean(input.translation, 2000) ? { translation: clean(input.translation, 2000) } : {}),
    ...(clean(input.packId, 160) ? { packId: clean(input.packId, 160) } : {}),
    ...(clean(input.sourceTitle, 240) ? { sourceTitle: clean(input.sourceTitle, 240) } : {}),
    ...(clean(input.commentary, 1200) ? { commentary: clean(input.commentary, 1200) } : {}),
    createdAt: new Date().toISOString(),
  }
  const quotes = await read()
  await write([quote, ...quotes].slice(0, 500))
  return quote
}

export async function deleteQuote(id: string): Promise<boolean> {
  const quotes = await read()
  const next = quotes.filter((quote) => quote.id !== id)
  if (next.length === quotes.length) return false
  await write(next)
  return true
}

export async function setQuoteCommentary(
  id: string,
  commentary: string,
  translation?: string,
): Promise<Quote | undefined> {
  const quotes = await read()
  const index = quotes.findIndex((quote) => quote.id === id)
  if (index === -1) return undefined
  const text = clean(commentary, 1200)
  const zh = clean(translation, 2000)
  const updated: Quote = { ...quotes[index]!, ...(text ? { commentary: text } : {}) }
  if (!text) delete updated.commentary
  if (zh) updated.translation = zh
  quotes[index] = updated
  await write(quotes)
  return updated
}
