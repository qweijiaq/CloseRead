import crypto from 'node:crypto'

export function itemId(lemma: string, sense: string): string {
  const normalized = `${lemma.toLowerCase().trim()}|${sense.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)}`
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12)
}
