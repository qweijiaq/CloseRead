import { hasLlm } from '../config.js'
import type { StyleProfile } from '../style/profile.js'
import { buildTemplateEditorial } from '../style/profile.js'
import type { AnalysisResult, Resource, SelectionMetadata } from '../types.js'
import { estimateDifficulty } from './tokenize.js'
import { analyzeHeuristic } from './heuristic.js'
import { analyzeWithLlm } from './llm.js'
import { ensureReadingTranslations } from './reading-translation.js'
import { lookupChineseWords, translateMany } from './translate.js'

export interface AnalyzeOptions {
  /** A fixed item count, or "auto" to let the compiler recommend one. */
  limit?: number | 'auto'
  useLlm?: boolean
  /** Fill missing Chinese definitions with a free machine translation. Default true. */
  translate?: boolean
  /** Also translate context sentences. Off by default because the free quota is small. */
  translateContext?: boolean
  /** Optional writing-style reference, loaded from styles/<name>.md. */
  style?: StyleProfile
  /** Known items / total items, used to tune the automatic count. */
  knownRatio?: number
  /** Base forms the learner already knows; exclude them from selection. */
  knownLemmas?: string[]
  /** Words already in the learner's library; prefer new ones, but keep important repeats as Bonus. */
  existingLemmas?: string[]
  /** Words the learner removed repeatedly; exclude them from selection. */
  avoidLemmas?: string[]
  /** Adjust the automatic count from pack-level "too many / too few" feedback. */
  selectionBias?: number
  /** Abort a long build. */
  signal?: AbortSignal
  /** Human-readable stage updates for long-running CLI builds. */
  onProgress?: (message: string) => void
}

export interface AnalyzeOutcome {
  analysis: AnalysisResult
  mode: 'heuristic' | 'llm'
  notes: string[]
  styleName?: string
  selection: SelectionMetadata
}

const SELECTION_MAX_ITEMS = 60

/** Turn a provider error into the one thing the reader can act on. */
export function describeLlmFailure(message: string): string {
  if (/401|403|unauthorized|invalid[_ -]?api[_ -]?key|authentication/i.test(message)) {
    return '模型 Key 无效或没有权限，检查一下 Key'
  }
  if (/404|model[_ -]?not[_ -]?found|does not exist|not found/i.test(message)) {
    return 'Base URL 或模型名不对，Base URL 一般以 /v1 结尾'
  }
  if (/429|rate[_ -]?limit|quota|insufficient/i.test(message)) {
    return '模型限流或额度不足，稍后重试或降低并发'
  }
  if (/timeout|timed out|aborted|超时/i.test(message)) {
    return '模型响应超时，可以换更快的模型'
  }
  if (/cut off|max_tokens|length/i.test(message)) {
    return '模型输出被截断，可以换支持更长输出的模型'
  }
  return '模型调用失败'
}

export function suggestSelection(
  resource: Resource,
  options: Pick<AnalyzeOptions, 'limit' | 'knownRatio' | 'selectionBias'> = {},
): SelectionMetadata {
  const wordCount = resource.wordCount || resource.text.split(/\s+/).filter(Boolean).length
  const difficulty = estimateDifficulty(resource.text)
  // One learning item per 20 words of the article, rounded to a whole item:
  // a 600-word article yields 30 items, a 1200-word one is capped at 60.
  const base = Math.max(1, Math.min(SELECTION_MAX_ITEMS, Math.round(wordCount / 20)))
  const known = options.knownRatio ?? 0
  const bias = Math.max(-5, Math.min(5, Math.round(options.selectionBias ?? 0)))
  const biasAdjust = bias === 0 ? 0 : Math.max(-4, Math.min(5, bias))
  // A known-word ratio is only meaningful when the learner has some known words.
  const knownAdjust = known >= 0.75 ? 1 : known > 0 && known <= 0.25 ? -1 : 0

  if (typeof options.limit === 'number') {
    const recommended = Math.max(1, Math.min(100, Math.round(options.limit)))
    return {
      mode: 'fixed',
      recommended,
      core: recommended,
      bonus: 0,
      wordCount,
      cefr: difficulty.cefr,
      reason: `按固定数量 ${recommended} 项生成；原文 ${wordCount} 词，${difficulty.cefr}。`,
    }
  }

  const recommended = Math.max(1, Math.min(SELECTION_MAX_ITEMS, base + biasAdjust + knownAdjust))
  const knownNote =
    known > 0
      ? `，已知词约占 ${Math.round(known * 100)}%${knownAdjust === 0 ? '' : knownAdjust > 0 ? '，增加 1 项' : '，减少 1 项'}`
      : ''
  const biasNote =
    bias === 0 ? '' : `，按你的反馈${bias > 0 ? '增加' : '减少'} ${Math.abs(biasAdjust)} 项`
  return {
    mode: 'auto',
    recommended,
    core: recommended,
    bonus: 0,
    wordCount,
    cefr: difficulty.cefr,
    reason: `原文 ${wordCount} 词，按每 20 词 1 项建议 ${recommended} 项${knownNote}${biasNote}。`,
  }
}

/** Split the items the LLM actually returned into core and bonus tiers. */
export function applySelectionTiers(
  analysis: AnalysisResult,
  recommendation: SelectionMetadata,
): SelectionMetadata {
  const count = analysis.items.length
  if (count === 0) return { ...recommendation, core: 0, bonus: 0 }
  const core = Math.max(1, Math.min(count, Math.round(count * 0.7)))
  analysis.items.forEach((item, index) => {
    item.tier = index < core ? 'core' : 'bonus'
  })
  return { ...recommendation, core, bonus: Math.max(0, count - core) }
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

async function enrichChinese(analysis: AnalysisResult, options: AnalyzeOptions): Promise<void> {
  if (options.translate === false) return

  const missing = analysis.items.filter((item) => !item.definitionZh)
  if (missing.length > 0) {
    const dictionary = await lookupChineseWords(missing.map((item) => item.lemma))
    for (const item of missing) {
      const chinese = dictionary.get(item.lemma.toLowerCase().trim())
      if (chinese) item.definitionZh = chinese
    }

    const stillMissing = missing.filter((item) => !item.definitionZh)
    const translations =
      stillMissing.length > 0
        ? await translateMany(stillMissing.map((item) => normalize(item.definition)))
        : new Map<string, string>()
    for (const item of stillMissing) {
      const chinese = translations.get(normalize(item.definition))
      if (chinese) item.definitionZh = chinese
    }

    if (dictionary.size > 0 && stillMissing.length === 0) {
      analysis.notes.push('中文释义来自有道词典。')
    } else if (dictionary.size > 0) {
      analysis.notes.push('中文释义优先来自有道词典；未收录的词由 MyMemory 机器翻译，可能存在偏差。')
    } else if (translations.size > 0) {
      analysis.notes.push('中文释义由 MyMemory 免费机器翻译生成，可能存在偏差；配置 LLM 可获得更准确的义项和释义。')
    } else {
      analysis.notes.push('中文释义生成失败（词典和翻译服务不可用）；配置 LLM 模式可获得准确的中文释义。')
    }
  }

  if (options.translateContext) {
    const missingContexts = analysis.items
      .flatMap((item) => item.contexts)
      .filter((context) => !context.translation)
      .map((context) => normalize(context.sentence))
      .filter(Boolean)

    if (missingContexts.length > 0) {
      const translations = await translateMany(missingContexts)
      for (const item of analysis.items) {
        for (const context of item.contexts) {
          if (context.translation) continue
          const chinese = translations.get(normalize(context.sentence))
          if (chinese) context.translation = chinese
        }
      }
    }
  }
}

export async function analyzeResource(resource: Resource, options: AnalyzeOptions = {}): Promise<AnalyzeOutcome> {
  const selection = suggestSelection(resource, {
    limit: options.limit,
    knownRatio: options.knownRatio,
    selectionBias: options.selectionBias,
  })
  const limit = selection.recommended
  const progress = options.onProgress ?? (() => {})
  progress(selection.reason)
  let outcome: AnalyzeOutcome

  if (options.useLlm !== false && hasLlm()) {
    try {
      const analysis = await analyzeWithLlm(
        resource,
        limit,
        options.style,
        progress,
        options.signal,
        options.knownLemmas,
        options.avoidLemmas,
        options.existingLemmas,
      )
      outcome = { analysis, mode: 'llm', notes: analysis.notes, styleName: options.style?.name, selection }
    } catch (error) {
      if (options.signal?.aborted) throw new Error('Build cancelled')
      progress('LLM analysis failed; falling back to heuristic mode…')
      const analysis = await analyzeHeuristic(resource, limit)
      // The one-line note goes on the page; the raw reason is logged for the
      // server and stashed in a collapsed "技术原因" block.
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[llm] fallback to heuristic: ${detail}`)
      progress(`LLM 模式失败：${detail}`)
      analysis.notes.push(
        `这篇学习包用启发式模式生成（${describeLlmFailure(detail)}），释义和搭配来自词典与原文。`,
      )
      analysis.notes.push(`技术原因：${detail}`)
      outcome = { analysis, mode: 'heuristic', notes: analysis.notes, styleName: options.style?.name, selection }
    }
  } else {
    progress('Selecting items in heuristic mode…')
    const analysis = await analyzeHeuristic(resource, limit)
    outcome = { analysis, mode: 'heuristic', notes: analysis.notes, styleName: options.style?.name, selection }
  }

  const known = new Set((options.knownLemmas ?? []).map((lemma) => lemma.toLowerCase().trim()))
  if (known.size > 0) {
    const before = outcome.analysis.items.length
    outcome.analysis.items = outcome.analysis.items.filter((item) => !known.has(item.lemma.toLowerCase().trim()))
    if (outcome.analysis.items.length < before) {
      outcome.notes.push(`已排除 ${before - outcome.analysis.items.length} 个已掌握词。`)
    }
    if (outcome.analysis.items.length === 0) {
      throw new Error('No new words were found; all selected candidates are already known. Try a harder article.')
    }
  }

  const avoid = new Set((options.avoidLemmas ?? []).map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))
  if (avoid.size > 0) {
    const before = outcome.analysis.items.length
    outcome.analysis.items = outcome.analysis.items.filter((item) => !avoid.has(item.lemma.toLowerCase().trim()))
    if (outcome.analysis.items.length < before) {
      outcome.notes.push(`已按反馈排除 ${before - outcome.analysis.items.length} 个词。`)
    }
    if (outcome.analysis.items.length === 0) {
      throw new Error('No new words were found after applying your feedback. Try another article or a different count.')
    }
  }

  outcome.selection = applySelectionTiers(outcome.analysis, {
    ...selection,
    ...(outcome.analysis.cachedCards ? { cachedCards: outcome.analysis.cachedCards } : {}),
  })
  progress(
    `Selected ${outcome.analysis.items.length} items (${outcome.selection.core} core, ${outcome.selection.bonus} bonus).`,
  )
  if (options.translate !== false) progress('Filling Chinese definitions (dictionary and free translation)…')
  await enrichChinese(outcome.analysis, options)

  if ((outcome.analysis.reading ?? []).some((paragraph) => !paragraph.translation?.trim())) {
    progress('Repairing missing paragraph translations…')
    const repaired = await ensureReadingTranslations(outcome.analysis.reading ?? [], { signal: options.signal })
    if (repaired.filled > 0) {
      outcome.notes.push(`补充了 ${repaired.filled} 段缺失译文。`)
    }
    if (repaired.remaining.length > 0) {
      const message = `有 ${repaired.remaining.length} 段译文未能生成，已停止生成不完整的学习包。请重试或更换模型。`
      if (outcome.mode === 'llm') throw new Error(message)
      outcome.notes.push(`警告：${message}`)
    }
  }

  if (options.style && !outcome.analysis.editorial) {
    progress('Building the styled editorial from the style reference…')
    outcome.analysis.editorial = buildTemplateEditorial(
      resource.title,
      resource.source,
      outcome.analysis.summary,
      outcome.analysis.items,
      options.style,
    )
  }

  return outcome
}
