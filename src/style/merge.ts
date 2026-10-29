import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import { config, hasLlm } from '../config.js'
import { listStyleProfiles, loadStyleProfile, saveStyleProfile } from './profile.js'

const mergeSchema = z.object({
  title: z.string().min(1),
  style: z.string().min(1),
})

export type StyleFocus = 'balanced' | 'light-longterm'

export interface MergeStyleOptions {
  names?: string[]
  outName?: string
  force?: boolean
  focus?: StyleFocus
}

function focusInstruction(focus: StyleFocus): string {
  if (focus === 'balanced') {
    return 'Keep a balanced mix of exam-oriented strengths and long-term learning strengths.'
  }
  return `The user wants a LIGHT-ENTRY, LONG-TERM learning methodology. Weight the sources accordingly:
- High weight: relatable hooks, short daily sessions, authentic input, deep reading, sustainable habits, intrinsic motivation. Prioritize the strengths of the supplied cards, not any one teacher's signature quirks.
- Lower weight: heavy exam drills, dense grammar terminology, score pressure. Keep dense grammar and exam-focused cards as optional advanced modules, not the main path.
- The default article should have 8-10 expressions, 600-1000 Chinese characters, and a 20-25 minute daily study loop.
- Tone: encouraging, low-pressure; no "must", "99% of people", or score-anxiety framing.
- Include an "进阶模块" section for grammar and exam work that learners can opt into.`
}

export interface MergeStyleResult {
  file: string
  title: string
  sources: string[]
}

/**
 * Synthesize several writer style cards into one house style.
 * The prompt explicitly keeps strengths and drops weaknesses/quirks.
 */
export async function mergeStyles(options: MergeStyleOptions = {}): Promise<MergeStyleResult> {
  if (!hasLlm()) {
    throw new Error('Merging styles needs an LLM. Configure LEARN_API_KEY or LEARN_ENV_FILE first.')
  }

  const outName = options.outName ?? 'unified'
  const profiles = options.names?.length
    ? await Promise.all(options.names.map((name) => loadStyleProfile(name)))
    : (await listStyleProfiles()).filter((profile) => profile.name !== outName)

  if (profiles.length < 2) {
    throw new Error('Need at least two style profiles to merge. Add another EPUB with: pnpm dev style add <name> <path>.')
  }

  const system = `You are a curriculum editor for Chinese English-learning content. Merge the following writer style cards into ONE unified learning methodology and house style.

The goal is 扬长避短:
- Keep each writer's real strengths: hooks, close reading, examples, grammar clarity, exam focus, cultural context, humor, structure, drills, review habits.
- Explicitly drop weaknesses, quirks, clickbait excess, self-promotion, digressions, over-correction, insults, and signature catchphrases.
- Do not copy long passages or imitate any one writer's personal voice too closely.

${focusInstruction(options.focus ?? 'balanced')}

Return JSON only: {"title":"...","style":"Markdown body"}

The Markdown body must contain:
1. 方法论总览（学习闭环：诊断 → 输入 → 精读 → 输出 → 复习 → 周复盘）
2. 定位与目标读者
3. 统一语气
4. 标题规则
5. 文章结构模板
6. 词汇讲解模板
7. 语法/长难句讲解规则
8. 练习与输出任务（写作/口语/翻译，含反馈标准）
9. 复习与迁移（间隔复习、错题本、词汇复用）
10. 素材选择与难度控制（i+1、主题、长度、目标）
11. 质量检查清单
12. 来源风格取舍表（每个来源：保留什么 / 放弃什么）
13. 明确禁止：不复制任何来源的长段落或标志性口头禅；不在正文中提具体作者名。
14. 每日/每周学习节奏（轻量、可持续）
15. 进阶模块（语法/应试，可选）

The source trade-off table and the daily rhythm must reflect the weighting above.`

  const user = profiles
    .map((profile, index) => `## Source ${index + 1}: ${profile.name}\n${profile.guide.slice(0, 8000)}`)
    .join('\n\n')

  const result = await chatJson(mergeSchema, system, user, { maxTokens: 8000 })
  const file = await saveStyleProfile(
    {
      name: outName,
      title: result.title,
      guide: result.style,
      source: profiles.map((profile) => profile.name).join(', '),
      model: config.llm.model,
      samples: profiles.length,
    },
    { force: options.force },
  )

  return { file, title: result.title, sources: profiles.map((profile) => profile.name) }
}
