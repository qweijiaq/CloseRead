import { z } from 'zod'

import type { LearningPack, MicroStory } from '../types.js'
import { chatJson } from './chat.js'

const microStorySchema = z.object({
  title: z.string().trim().min(1),
  text: z.string().trim().min(200),
  translation: z.string().trim().min(10),
  used: z.array(z.string().trim().min(1)).min(3).max(12),
})

const SYSTEM = `You write very short English stories for a Chinese learner of English.
The story must be original, coherent and concrete: one scene, one small turn or surprise, no explanation and no moral at the end.
Reuse the supplied target expressions naturally, keeping their exact spelling. Do not force every target in; choose the ones that fit.
Write natural, idiomatic English at the requested level. Then translate the story into natural Chinese, not word by word.
Use plain text only: no Markdown, no bold markers, no headings.
Return JSON only:
{"title":"...","text":"...","translation":"...","used":["..."]}`

function compact(value: string | undefined, max: number): string {
  return (value ?? '').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function generateMicroStory(
  pack: LearningPack,
  signal?: AbortSignal,
): Promise<MicroStory> {
  const targets = pack.items
    .filter((item) => item.type !== 'sentence' && item.lemma.trim())
    .slice(0, 12)
  if (targets.length < 3) {
    throw new Error('这篇学习包的词卡太少，至少需要 3 张词卡才能写微故事。')
  }
  const list = targets
    .map((item) => {
      const meaning = compact(item.definitionZh ?? item.sense, 60)
      return `- ${item.lemma}${meaning ? ` — ${meaning}` : ''}`
    })
    .join('\n')
  const result = await chatJson(
    microStorySchema,
    SYSTEM,
    `Article: ${compact(pack.frontMatter?.title ?? pack.title, 160)}
Learner level: ${pack.difficulty.cefr}
Target expressions:
${list}

Write a 100–150 word story. Use 5–8 of the target expressions naturally. Give it a short English title of at most 8 words.
Return JSON only.`,
    { maxTokens: 2200, temperature: 0.8, signal },
  )
  const used: string[] = []
  const seen = new Set<string>()
  for (const value of result.used) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    used.push(compact(value, 80))
  }
  return {
    title: compact(result.title, 120),
    text: compact(result.text, 1800),
    translation: compact(result.translation, 1600),
    used: used.slice(0, 8),
  }
}
