import { checkReadableEnglish } from '../ingest/hygiene.js'

/**
 * A deliberately blunt pre-publish screen. It only has to catch obvious cases —
 * porn, gore, calls to violence — because every rule here can also reject a real
 * article, and this library is meant to hold magazine prose.
 */
const EXPLICIT = [
  /\bporn(ography|o)?\b/i,
  /\bnsfw\b/i,
  /\bxxx\b/i,
  /\bsex\s*(cam|tape|video|chat|worker)\b/i,
  /\bescort\s*service/i,
  /色情|黄片|裸聊|约炮|一夜情|成人视频|嫖娼|淫秽/,
]

const GORE = [
  /\b(behead|decapitat|dismember|mutilat|disembowel)/i,
  /\bsnuff\s+(film|video)/i,
  /血腥|肢解|分尸|碎尸|虐杀|剥皮/,
]

/** Only unambiguous, high-harm phrases; a normal politics article must pass. */
const EXTREMIST = [
  /颠覆国家政权/,
  /煽动颠覆/,
  /分裂国家/,
  /推翻政府/,
  /法轮功/,
  /六四事件/,
  /天安门事件/,
  /东突/,
  /疆独/,
  /藏独/,
  /台独势力/,
  /港独/,
  /\b(jihad|jihadi|martyrdom operation)\b/i,
  /\b(child porn|child pornography|csam)\b/i,
]

export interface PublishCheck {
  ok: boolean
  reason?: string
}

function hits(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0)
}

export function checkPublishable(input: { title?: string; text: string }): PublishCheck {
  const text = input.text ?? ''
  const title = input.title ?? ''

  if (process.env.LEARN_MODERATION === 'off') return { ok: true }

  const readable = checkReadableEnglish(text)
  if (!readable.ok) {
    return { ok: false, reason: `${readable.reason} 公共库只收英文精读材料。` }
  }

  const explicit = hits(`${title}\n${text}`, EXPLICIT)
  if (explicit > 0) return { ok: false, reason: '内容含有成人或性相关的表述，不能公开。' }

  const gore = hits(text, GORE)
  if (gore > 0) return { ok: false, reason: '内容含有血腥暴力的描写，不能公开。' }

  const extremist = hits(text, EXTREMIST)
  if (extremist >= 2) {
    return { ok: false, reason: '内容涉及危害公共安全的极端表述，不能公开。' }
  }

  const watermark = (text.match(/zlibrary|z-lib|本书由|本文由.{0,20}下载|下载自/gi) ?? []).length
  if (watermark >= 1) {
    return { ok: false, reason: '这篇文章里还带着下载水印或来源声明，先清理再公开。' }
  }

  return { ok: true }
}
