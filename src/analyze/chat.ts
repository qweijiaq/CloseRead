import { z } from 'zod'

import { config } from '../config.js'
import { recordUsage } from './usage.js'

/** Extract the first JSON object from an LLM reply, including fenced blocks. */
export function parseJson(content: string): unknown {
  let text = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  if (fenced) text = fenced[1]!
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('LLM response was not valid JSON.')
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

function retryDelay(attempt: number): number {
  return 400 * 2 ** attempt + Math.floor(Math.random() * 150)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function canRetry(status: number, attempt: number): boolean {
  return attempt < 2 && RETRYABLE_STATUS.has(status)
}

async function request(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(180_000)
  return fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  })
}

async function requestAnthropic(
  system: string,
  user: string,
  options: ChatOptions,
): Promise<Response> {
  const timeout = AbortSignal.timeout(180_000)
  return fetch(`${config.llm.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.llm.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
  })
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '')
        return ''
      })
      .join('')
  }
  return ''
}

/** Call an OpenAI-compatible chat endpoint and validate the JSON reply with zod. */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export async function chatJson<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  options: ChatOptions = {},
): Promise<T> {
  if (!config.llm.apiKey.trim()) throw new Error('No LLM API key configured.')

  if (config.llm.provider === 'anthropic') {
    let content = ''
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1))
      if (options.signal?.aborted) throw new Error('Request cancelled.')
      const response = await requestAnthropic(system, user, options)
      if (response.ok) {
        const data = (await response.json()) as {
          content?: unknown
          usage?: { input_tokens?: number; output_tokens?: number }
        }
        recordUsage(config.llm.model, {
          prompt: data.usage?.input_tokens,
          completion: data.usage?.output_tokens,
        })
        content = contentText(data.content)
        if (content.trim()) break
        if (attempt === 2) throw new Error('Anthropic returned an empty response.')
        continue
      }
      if (canRetry(response.status, attempt)) {
        await response.text().catch(() => {})
        continue
      }
      const detail = await response.text()
      throw new Error(`Anthropic request failed (${response.status}): ${detail.slice(0, 500)}`)
    }
    const parsed = schema.safeParse(parseJson(content))
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      throw new Error(`Anthropic returned an invalid shape: ${issues}`)
    }
    return parsed.data
  }

  const body: Record<string, unknown> = {
    model: config.llm.model,
    temperature: options.temperature ?? 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  }
  if (options.maxTokens) body.max_tokens = options.maxTokens

  let triedWithoutFormat = false
  let content = ''
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await sleep(retryDelay(attempt - 1))
    if (options.signal?.aborted) throw new Error('Request cancelled.')
    let response = await request(body, options.signal)
    if (!response.ok && !triedWithoutFormat && (response.status === 400 || response.status === 422)) {
      triedWithoutFormat = true
      await response.text().catch(() => {})
      delete body.response_format
      response = await request(body, options.signal)
    }
    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      recordUsage(config.llm.model, {
        prompt: data.usage?.prompt_tokens,
        completion: data.usage?.completion_tokens,
        total: data.usage?.total_tokens,
      })
      content = contentText(data.choices?.[0]?.message?.content)
      if (content.trim()) break
      if (attempt === 2) throw new Error('LLM returned an empty response.')
      continue
    }
    if (canRetry(response.status, attempt)) {
      await response.text().catch(() => {})
      continue
    }
    const detail = await response.text()
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const parsed = schema.safeParse(parseJson(content))
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`LLM returned an invalid shape: ${issues}`)
  }
  return parsed.data
}
