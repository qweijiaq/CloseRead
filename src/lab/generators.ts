import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import type { LearningItem, LearningPack } from '../types.js'
import { cached, labCacheKey } from './cache.js'
import { packPrompt } from './context.js'

const quoteSchema = z.object({
  commentary: z.string().trim().min(5).max(500),
  translation: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(4).default([]),
})

export interface QuoteInsight {
  commentary: string
  translation?: string
  tags: string[]
}

export async function generateQuoteInsight(text: string, sourceTitle: string): Promise<QuoteInsight> {
  return cached(labCacheKey('quote', [text, sourceTitle]), async () => {
    const result = await chatJson(
      quoteSchema,
      `You are an English writing coach for a Chinese learner. Explain why one sentence is effective in plain Chinese.
Focus on one concrete craft point: rhythm, contrast, a verb, a metaphor, a turn, or a precise word. Do not praise vaguely.
Optionally give a natural Chinese translation. Return JSON only:
{"commentary":"...","translation":"...","tags":["..."]}`,
      `Source: ${sourceTitle}
Sentence: ${text}`,
      { maxTokens: 700, temperature: 0.6 },
    )
    return {
      commentary: result.commentary,
      ...(result.translation ? { translation: result.translation } : {}),
      tags: (result.tags ?? []).slice(0, 4),
    }
  })
}

const registerSchema = z.object({
  model: z.string().trim().min(10).max(1200),
  feedback: z.string().trim().min(5).max(900),
  notes: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  score: z.number().int().min(1).max(5).optional(),
})

export type RegisterStyle = 'tweet' | 'email' | 'headline' | 'poem'

export interface RegisterResult {
  model: string
  feedback: string
  notes: string[]
  score?: number
}

export async function generateRegisterRemix(
  pack: LearningPack,
  paragraphIndex: number,
  target: RegisterStyle,
  learnerText?: string,
): Promise<RegisterResult> {
  const paragraph = (pack.reading ?? []).find((entry) => entry.index === paragraphIndex) ?? pack.reading?.[0]
  if (!paragraph) throw new Error('这篇文章还没有可改写的段落。')
  const style = {
    tweet: 'a punchy tweet (under 240 characters)',
    email: 'a short professional email to a colleague',
    headline: 'a news headline (under 14 words)',
    poem: 'a four-line poem that keeps the original idea',
  }[target]
  return cached(labCacheKey('register', [pack.id, paragraphIndex, target, learnerText ?? '']), async () => {
    const result = await chatJson(
      registerSchema,
      `You are an English register coach for a Chinese learner. The learner rewrites one vocabulary example for a new audience.
Give one strong model rewrite in the requested register, then concise feedback in Chinese. If the learner supplied a draft, respond to that draft specifically.
Do not rewrite the whole vocabulary set. Do not use Markdown. Return JSON only:
{"model":"...","feedback":"...","notes":["..."],"score":1}`,
      `${packPrompt(pack, 5000)}

Vocabulary example:
${paragraph.original}

Target register: ${style}
${learnerText ? `Learner draft:\n${learnerText}` : 'The learner has not written a draft yet. Give a model rewrite and 2–4 concrete tips for doing it themselves.'}`,
      { maxTokens: 1200, temperature: 0.6 },
    )
    return {
      model: result.model,
      feedback: result.feedback,
      notes: result.notes ?? [],
      ...(result.score ? { score: result.score } : {}),
    }
  })
}

const soloPodcastSchema = z.object({
  title: z.string().trim().min(2).max(120),
  script: z.string().trim().min(60).max(2200),
  segments: z
    .array(z.object({ heading: z.string().trim().min(1).max(60), text: z.string().trim().min(10).max(600) }))
    .min(2)
    .max(5),
  questions: z
    .array(z.object({ question: z.string().trim().min(5).max(240), answer: z.string().trim().max(400).optional() }))
    .max(3)
    .default([]),
})

const duoPodcastSchema = z.object({
  title: z.string().trim().min(2).max(120),
  turns: z
    .array(
      z.object({
        speaker: z.enum(['A', 'B']),
        text: z.string().trim().min(3).max(500),
      }),
    )
    .min(6)
    .max(16),
  questions: z
    .array(z.object({ question: z.string().trim().min(5).max(240), answer: z.string().trim().max(400).optional() }))
    .max(3)
    .default([]),
})

export interface PodcastPayload {
  mode: 'solo' | 'duo'
  title: string
  script: string
  segments?: Array<{ heading: string; text: string }>
  turns?: Array<{ speaker: 'A' | 'B'; text: string }>
  questions: Array<{ question: string; answer?: string }>
}

export async function generatePodcast(pack: LearningPack, mode: 'solo' | 'duo'): Promise<PodcastPayload> {
  return cached(labCacheKey('podcast', [pack.id, mode]), async () => {
    if (mode === 'solo') {
      const result = await chatJson(
        soloPodcastSchema,
        `You write a 70–100 second solo English podcast briefing for a Chinese learner.
It should sound spoken, not like an essay: a hook, 2–3 clear points about the target words, and a practical takeaway.
Keep the language at the vocabulary set's CEFR level. Add 2–3 comprehension questions with short answers.
Return JSON only: {"title":"...","script":"...","segments":[{"heading":"...","text":"..."}],"questions":[{"question":"...","answer":"..."}]}`,
        `${packPrompt(pack, 7000)}

Write the briefing. Use the target words and their context sentences; do not invent facts.`,
        { maxTokens: 2000, temperature: 0.7 },
      )
      return { mode, ...result, questions: result.questions ?? [] }
    }
    const result = await chatJson(
      duoPodcastSchema,
      `You write a natural 8–14 turn English podcast between two hosts, A and B, for a Chinese learner.
They disagree a little, explain how the target words are used, and end with one practical takeaway. Keep each turn short and spoken.
Add 2–3 comprehension questions with short answers.
Return JSON only: {"title":"...","turns":[{"speaker":"A","text":"..."}],"questions":[{"question":"...","answer":"..."}]}`,
      `${packPrompt(pack, 7000)}

Write the dialogue around the target words and their contexts; do not invent facts.`,
      { maxTokens: 2200, temperature: 0.75 },
    )
    const script = result.turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')
    return { mode, title: result.title, script, turns: result.turns, questions: result.questions ?? [] }
  })
}

const newsSchema = z.object({
  title: z.string().trim().min(2).max(100),
  scenes: z
    .array(
      z.object({
        caption: z.string().trim().min(2).max(80),
        narration: z.string().trim().min(10).max(400),
        seconds: z.number().min(3).max(12),
      }),
    )
    .min(3)
    .max(5),
  hashtags: z.array(z.string().trim().min(1).max(30)).max(4).default([]),
})

export interface NewsShortPayload {
  title: string
  scenes: Array<{ caption: string; narration: string; seconds: number }>
  script: string
  hashtags: string[]
}

export async function generateNewsShort(pack: LearningPack): Promise<NewsShortPayload> {
  return cached(labCacheKey('news-short', [pack.id]), async () => {
    const result = await chatJson(
      newsSchema,
      `You turn a vocabulary set into a 30-second vertical news short for a Chinese learner of English.
Write 3–4 scenes. Each scene has a short on-screen caption (max 8 words), one spoken narration sentence, and a duration in seconds.
Open with a hook, give the key fact, then a consequence or question. Do not invent facts.
Return JSON only: {"title":"...","scenes":[{"caption":"...","narration":"...","seconds":7}],"hashtags":["..."]}`,
      `${packPrompt(pack, 6000)}

Make the total duration 25–40 seconds.`,
      { maxTokens: 1400, temperature: 0.7 },
    )
    return { ...result, hashtags: result.hashtags ?? [], script: result.scenes.map((scene) => scene.narration).join(' ') }
  })
}

const dubbingSchema = z.object({
  title: z.string().trim().min(2).max(100),
  setting: z.string().trim().min(5).max(300),
  roles: z.array(z.string().trim().min(1).max(40)).min(2).max(3),
  lines: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(40),
        text: z.string().trim().min(3).max(300),
        translation: z.string().trim().max(300).optional(),
      }),
    )
    .min(6)
    .max(14),
})

export interface DubbingPayload {
  title: string
  setting: string
  roles: string[]
  lines: Array<{ role: string; text: string; translation?: string }>
}

export async function generateDubbing(pack: LearningPack): Promise<DubbingPayload> {
  return cached(labCacheKey('dubbing', [pack.id]), async () => {
    const result = await chatJson(
      dubbingSchema,
      `You build a short English mini-drama around target vocabulary for pronunciation and role-play practice.
Use 2–3 characters and 6–12 short lines. Put the target words into a concrete scene with a small conflict.
Every line must belong to one of the roles. Add a natural Chinese translation for each line.
Return JSON only: {"title":"...","setting":"...","roles":["..."],"lines":[{"role":"...","text":"...","translation":"..."}]}`,
      `${packPrompt(pack, 6000)}

The learner will read one role aloud, so make the lines speakable and not too long.`,
      { maxTokens: 2000, temperature: 0.75 },
    )
    return result
  })
}

const lifeSchema = z.object({
  examples: z
    .array(
      z.object({
        en: z.string().trim().min(10).max(300),
        zh: z.string().trim().min(3).max(300),
      }),
    )
    .min(3)
    .max(3),
  note: z.string().trim().max(400).optional(),
})

export interface LifeExamplesPayload {
  examples: Array<{ en: string; zh: string }>
  note?: string
}

export async function generateLifeExamples(item: LearningItem, context: string): Promise<LifeExamplesPayload> {
  return cached(labCacheKey('life-examples', [item.id, item.updatedAt, context]), async () => {
    return chatJson(
      lifeSchema,
      `You write personal English examples for a Chinese learner.
Use the target expression in three concrete, everyday situations that fit the learner's chosen context.
Keep each English sentence natural and short (8–24 words), and translate it into natural Chinese.
Do not use the target in the same sentence frame every time. Return JSON only:
{"examples":[{"en":"...","zh":"..."}],"note":"..."}`,
      `Target: ${item.lemma}
Sense: ${item.sense}
Definition: ${item.definition}
${item.definitionZh ? `Chinese: ${item.definitionZh}` : ''}
Context: ${context || 'daily life'}
Article sentence: ${item.contexts[0]?.sentence ?? '(none)'}`,
      { maxTokens: 700, temperature: 0.8 },
    )
  })
}

const argumentSchema = z.object({
  claim: z.string().trim().min(10).max(500),
  evidence: z
    .array(z.object({ text: z.string().trim().min(5).max(400), paragraph: z.number().int().min(0).optional() }))
    .min(2)
    .max(5),
  assumptions: z.array(z.string().trim().min(3).max(300)).min(1).max(4),
  counterpoints: z.array(z.string().trim().min(3).max(300)).min(1).max(3),
})

export interface ArgumentMapPayload {
  claim: string
  evidence: Array<{ text: string; paragraph?: number }>
  assumptions: string[]
  counterpoints: string[]
}

export async function generateArgumentMap(pack: LearningPack): Promise<ArgumentMapPayload> {
  return cached(labCacheKey('argument-map', [pack.id]), async () => {
    const maxParagraph = Math.max(0, (pack.reading?.length ?? 1) - 1)
    const result = await chatJson(
      argumentSchema,
      `You are a critical-reading coach. Map how a set of target words is used for a Chinese learner.
Identify the central usage claim, 2–4 example sentences actually present in the set, 1–3 unstated usage assumptions, and 1–3 counterpoints or confusions.
Evidence must quote or closely paraphrase the vocabulary examples and include the example index when possible.
Return JSON only: {"claim":"...","evidence":[{"text":"...","paragraph":0}],"assumptions":["..."],"counterpoints":["..."]}`,
      `${packPrompt(pack, 7000)}

Paragraph indices run from 0 to ${maxParagraph}. Do not invent evidence that is not in the vocabulary examples.`,
      { maxTokens: 1600, temperature: 0.4 },
    )
    return {
      ...result,
      evidence: result.evidence.map((entry) => ({
        text: entry.text,
        ...(entry.paragraph !== undefined ? { paragraph: Math.min(maxParagraph, Math.max(0, entry.paragraph)) } : {}),
      })),
    }
  })
}

const subtitleSchema = z.object({
  title: z.string().trim().min(2).max(100),
  lines: z.array(z.string().trim().min(5).max(240)).length(4),
  errorLine: z.number().int().min(0).max(3),
  wrong: z.string().trim().min(1).max(80),
  correct: z.string().trim().min(1).max(80),
  options: z.array(z.string().trim().min(1).max(80)).length(3),
  explanation: z.string().trim().min(5).max(500),
})

export interface SubtitleHunterPayload {
  title: string
  lines: string[]
  errorLine: number
  wrong: string
  correct: string
  options: string[]
  explanation: string
  script: string
}

export async function generateSubtitleHunter(pack: LearningPack): Promise<SubtitleHunterPayload> {
  return cached(labCacheKey('subtitle-hunter', [pack.id]), async () => {
    const result = await chatJson(
      subtitleSchema,
      `You make a listening game for a Chinese learner.
Create 4 short subtitle lines in English based on the vocabulary examples. Exactly one line contains one listening trap: a wrong number, negation, tense, name, or easily confused word.
The audio will read the corrected version, while the screen shows the line with the trap.
Provide the wrong text exactly as it appears in that line, the correct text, and three correction options (one correct, two plausible).
Explain in Chinese what the ear should notice. Return JSON only:
{"title":"...","lines":["..."],"errorLine":0,"wrong":"...","correct":"...","options":["..."],"explanation":"..."}`,
      `${packPrompt(pack, 5000)}

The trap must be clearly wrong when read carefully, not merely a different opinion.`,
      { maxTokens: 1200, temperature: 0.6 },
    )
    const line = result.lines[result.errorLine] ?? ''
    if (!line.includes(result.wrong)) throw new Error('字幕题的生成本次不可靠，请再试一次。')
    if (new Set(result.options.map((option) => option.toLowerCase())).size !== 3) {
      throw new Error('字幕题生成了重复选项，请再试一次。')
    }
    if (!result.options.some((option) => option.toLowerCase() === result.correct.toLowerCase())) {
      throw new Error('字幕题缺少正确选项，请再试一次。')
    }
    const corrected = line.replace(result.wrong, result.correct)
    return {
      title: result.title,
      lines: result.lines,
      errorLine: result.errorLine,
      wrong: result.wrong,
      correct: result.correct,
      options: result.options,
      explanation: result.explanation,
      script: result.lines.map((entry, index) => (index === result.errorLine ? corrected : entry)).join(' '),
    }
  })
}

const dungeonSchema = z.object({
  rooms: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        enemy: z.string().trim().min(1).max(40),
        intro: z.string().trim().min(5).max(200),
      }),
    )
    .length(3),
  boss: z.object({ name: z.string().trim().min(1).max(40), intro: z.string().trim().min(5).max(200) }),
  victory: z.string().trim().min(5).max(200),
})

export interface DungeonFlavorPayload {
  rooms: Array<{ name: string; enemy: string; intro: string }>
  boss: { name: string; intro: string }
  victory: string
}

export async function generateDungeonFlavor(words: string[]): Promise<DungeonFlavorPayload> {
  return cached(labCacheKey('dungeon', [words]), async () => {
    return chatJson(
      dungeonSchema,
      `You are the narrator of a tiny vocabulary dungeon for a Chinese English learner.
Create 3 rooms and a boss. Each room has a short name, an enemy, and one vivid sentence of setup.
Do not mention game mechanics or answers. Keep the English simple and playful.
Return JSON only: {"rooms":[{"name":"...","enemy":"...","intro":"..."}],"boss":{"name":"...","intro":"..."},"victory":"..."}`,
      `The words in this run: ${words.join(', ')}`,
      { maxTokens: 700, temperature: 0.9 },
    )
  })
}

const petSchema = z.object({
  line: z.string().trim().min(3).max(160),
})

export async function generatePetLine(stats: {
  stage: string
  streak: number
  reviews: number
  known: number
}): Promise<string> {
  return cached(labCacheKey('pet-line', [stats.stage, stats.streak, stats.reviews, stats.known]), async () => {
    const result = await chatJson(
      petSchema,
      `You are a tiny, affectionate vocabulary pet living in a Chinese learner's app.
Say one short line in Chinese (max 40 characters) that reacts to the learner's stats and nudges them to review. Be specific, not generic.
Return JSON only: {"line":"..."}`,
      JSON.stringify(stats),
      { maxTokens: 200, temperature: 0.9 },
    )
    return result.line
  })
}

const adventureSchema = z.object({
  feedback: z.string().trim().min(5).max(700),
  natural: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  awkward: z
    .array(z.object({ word: z.string().trim().min(1).max(60), why: z.string().trim().min(3).max(240) }))
    .max(5)
    .default([]),
  rewrite: z.string().trim().min(10).max(600),
})

export interface AdventureFeedback {
  feedback: string
  natural: string[]
  awkward: Array<{ word: string; why: string }>
  rewrite: string
}

export async function generateAdventureFeedback(words: string[], text: string): Promise<AdventureFeedback> {
  return cached(labCacheKey('word-adventure', [words, text]), async () => {
    return chatJson(
      adventureSchema,
      `You are an encouraging English writing coach for a Chinese learner.
The learner had to use five target expressions in one short story. Check whether the expressions are used naturally, not forced.
List the expressions that fit, the ones that feel forced, and give a light model rewrite that keeps the learner's idea.
Be honest but kind. Feedback in Chinese. Return JSON only:
{"feedback":"...","natural":["..."],"awkward":[{"word":"...","why":"..."}],"rewrite":"..."}`,
      `Target expressions: ${words.join(', ')}
Learner story:
${text}`,
      { maxTokens: 900, temperature: 0.6 },
    ).then((result) => ({
      ...result,
      natural: result.natural ?? [],
      awkward: result.awkward ?? [],
    }))
  })
}

const dictationSchema = z.object({
  hint: z.string().trim().min(3).max(300),
  focus: z.string().trim().min(2).max(80),
})

export async function generateDictationHint(sentence: string, typed: string): Promise<{ hint: string; focus: string }> {
  return cached(labCacheKey('dictation-hint', [sentence, typed]), async () => {
    return chatJson(
      dictationSchema,
      `You are a listening coach for a Chinese learner. The learner typed what they heard; compare it with the source.
Give one short Chinese hint about what to listen for next time (connected speech, a number, a weak form, a word ending) and a focus label.
Do not simply repeat the whole sentence. Return JSON only: {"hint":"...","focus":"..."}`,
      `Source: ${sentence}
Heard/typed: ${typed || '(empty)'}`,
      { maxTokens: 300, temperature: 0.4 },
    )
  })
}
