export interface UsageTotals {
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  models: Record<string, { calls: number; promptTokens: number; completionTokens: number }>
}

const totals: UsageTotals = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  models: {},
}

/** Record provider usage for the current server process. */
export function recordUsage(
  model: string,
  usage: { prompt?: number; completion?: number; total?: number } | undefined,
): void {
  totals.calls += 1
  const prompt = Math.max(0, Math.round(usage?.prompt ?? 0))
  const completion = Math.max(0, Math.round(usage?.completion ?? 0))
  const total = Math.max(prompt + completion, Math.round(usage?.total ?? 0))
  totals.promptTokens += prompt
  totals.completionTokens += completion
  totals.totalTokens += total
  const entry = totals.models[model] ?? { calls: 0, promptTokens: 0, completionTokens: 0 }
  entry.calls += 1
  entry.promptTokens += prompt
  entry.completionTokens += completion
  totals.models[model] = entry
}

export function usageSummary(): UsageTotals {
  return {
    ...totals,
    models: Object.fromEntries(Object.entries(totals.models).map(([key, value]) => [key, { ...value }])),
  }
}
