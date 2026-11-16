/**
 * Import hygiene: strip the watermark lines that come with downloaded PDFs and
 * refuse files that are not English prose at all. Both checks are deliberately
 * conservative — a false positive here means someone cannot import their book.
 */

const WATERMARK_LINES: RegExp[] = [
  /本文由.{0,20}(下载|整理|收集|搬运|制作)/,
  /(由|来自)\s*book\s*zzz|bookzz/i,
  /z-?library|z-lib|libgen|anna'?s?\s*archive/i,
  /^(下载|转载)自?\s*[:：]?\s*https?:\/\//i,
  /^(downloaded|generated|converted)\s+(from|by)\b/i,
  /^this (article|ebook|document) (was|is) (downloaded|provided)\b/i,
  /^https?:\/\/\S+$/i,
  /^www\.\S+\.\S+$/i,
  /^仅供(个人|学习|研究)/,
  /^版权所有[，,、\s]/,
  /^(未经|禁止)(授权)?(许可)?(转载|复制|传播)/,
  /^[—–\-\s·]*\d{1,4}[—–\-\s·]*$/,
]

function isWatermark(line: string): boolean {
  const text = line.trim()
  if (!text) return false
  return WATERMARK_LINES.some((pattern) => pattern.test(text))
}

/** Drop watermark lines and collapse the blank runs they leave behind. */
export function stripBoilerplate(text: string): string {
  const kept = text
    .split('\n')
    .filter((line) => !isWatermark(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return kept || text.trim()
}

export interface ReadabilityCheck {
  ok: boolean
  reason?: string
  englishRatio: number
  letters: number
}

/** Rough "is this English prose" test used at import time and before publishing. */
export function checkReadableEnglish(text: string): ReadabilityCheck {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length
  // Short snippets are legitimate (a paragraph, a fixture); only judge prose.
  if (text.length < 400) return { ok: true, englishRatio: 1, letters }
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const total = letters + chinese
  const englishRatio = total === 0 ? 0 : letters / total
  if (letters < 120) {
    return { ok: false, reason: '这段内容里的英文太少，可能不是一篇正文。', englishRatio, letters }
  }
  if (englishRatio < 0.45) {
    return {
      ok: false,
      reason: '这段内容以中文为主，精读需要英文正文；可以只粘贴英文部分。',
      englishRatio,
      letters,
    }
  }
  return { ok: true, englishRatio, letters }
}
