import { z } from 'zod'

import { config } from '../config.js'

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

  let response = await request(body, options.signal)
  if (!response.ok && (response.status === 400 || response.status === 422)) {
    delete body.response_format
    response = await request(body, options.signal)
  }
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> }
  const content = contentText(data.choices?.[0]?.message?.content)
  if (!content.trim()) throw new Error('LLM returned an empty response.')

  const parsed = schema.safeParse(parseJson(content))
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`LLM returned an invalid shape: ${issues}`)
  }
  return parsed.data
}
