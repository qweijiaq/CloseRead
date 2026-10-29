import { hasLlm } from '../config.js'
import type { StyleProfile } from '../style/profile.js'
import { buildTemplateEditorial } from '../style/profile.js'
import type { AnalysisResult, Resource, SelectionMetadata } from '../types.js'
import { estimateDifficulty } from './tokenize.js'
import { analyzeHeuristic } from './heuristic.js'
import { analyzeWithLlm } from './llm.js'
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

export function suggestSelection(
  resource: Resource,
  options: Pick<AnalyzeOptions, 'limit' | 'knownRatio' | 'selectionBias'> = {},
): SelectionMetadata {
  const wordCount = resource.wordCount || resource.text.split(/\s+/).filter(Boolean).length
  const difficulty = estimateDifficulty(resource.text)
  const base = Math.min(14, Math.max(7, Math.round(wordCount / 90)))
  const cefrAdjust = difficulty.cefr === 'C2' ? 2 : difficulty.cefr === 'C1' ? 1 : difficulty.cefr === 'B1' ? -1 : 0
  const known = options.knownRatio ?? 0
  const knownAdjust = known > 0.65 ? 1 : known > 0 && known < 0.25 ? -1 : 0
  const bias = Math.max(-5, Math.min(5, Math.round(options.selectionBias ?? 0)))
  const biasAdjust = bias === 0 ? 0 : Math.max(-4, Math.min(5, bias))

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

  const recommended = Math.max(4, Math.min(20, base + cefrAdjust + knownAdjust + biasAdjust))
  const knownNote = known > 0 ? `，已知词约占 ${Math.round(known * 100)}%` : ''
  const biasNote =
    bias === 0 ? '' : `，按你的反馈${bias > 0 ? '增加' : '减少'} ${Math.abs(biasAdjust)} 项`
  return {
    mode: 'auto',
    recommended,
    core: recommended,
    bonus: 0,
    wordCount,
    cefr: difficulty.cefr,
    reason: `原文 ${wordCount} 词，难度 ${difficulty.cefr}${knownNote}${biasNote}；按每天 20–25 分钟建议 ${recommended} 项。`,
  }
}

function applyTiers(analysis: AnalysisResult, recommendation: SelectionMetadata): SelectionMetadata {
  const count = analysis.items.length
  if (count === 0) return { ...recommendation, core: 0, bonus: 0 }
  const core = Math.max(1, Math.min(count, Math.round(recommendation.recommended * 0.7)))
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
      analysis.notes.push(
        `LLM 模式失败，已回退到启发式模式：${error instanceof Error ? error.message : String(error)}`,
      )
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

  outcome.selection = applyTiers(outcome.analysis, {
    ...selection,
    ...(outcome.analysis.cachedCards ? { cachedCards: outcome.analysis.cachedCards } : {}),
  })
  progress(
    `Selected ${outcome.analysis.items.length} items (${outcome.selection.core} core, ${outcome.selection.bonus} bonus).`,
  )
  if (options.translate !== false) progress('Filling Chinese definitions (dictionary and free translation)…')
  await enrichChinese(outcome.analysis, options)

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
