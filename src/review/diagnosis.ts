import { randomInt } from 'node:crypto'

export type DiagnosisLevel = 'B1' | 'B2' | 'C1' | 'C2'

export interface DiagnosisWord {
  lemma: string
  level: DiagnosisLevel
  gloss: string
}

/**
 * A self-check word bank sampled from the CEFR bands CloseRead targets. It is
 * deliberately LLM-free: the result only seeds the learner level and the
 * known-word list, both of which can be changed later.
 */
export const DIAGNOSIS_WORDS: DiagnosisWord[] = [
  { lemma: 'improve', level: 'B1', gloss: '改善；提高' },
  { lemma: 'avoid', level: 'B1', gloss: '避免' },
  { lemma: 'provide', level: 'B1', gloss: '提供' },
  { lemma: 'likely', level: 'B1', gloss: '可能的' },
  { lemma: 'reduce', level: 'B1', gloss: '减少' },
  { lemma: 'achieve', level: 'B1', gloss: '实现；达到' },
  { lemma: 'allow', level: 'B1', gloss: '允许；准许' },
  { lemma: 'require', level: 'B1', gloss: '需要；要求' },
  { lemma: 'suggest', level: 'B1', gloss: '建议；表明' },
  { lemma: 'establish', level: 'B1', gloss: '建立；确立' },
  { lemma: 'maintain', level: 'B1', gloss: '保持；维持' },
  { lemma: 'consider', level: 'B1', gloss: '考虑；认为' },
  { lemma: 'sustain', level: 'B2', gloss: '维持；支撑' },
  { lemma: 'decline', level: 'B2', gloss: '下降；拒绝' },
  { lemma: 'attribute', level: 'B2', gloss: '归因于' },
  { lemma: 'framework', level: 'B2', gloss: '框架；体系' },
  { lemma: 'reluctant', level: 'B2', gloss: '不情愿的' },
  { lemma: 'substantial', level: 'B2', gloss: '大量的；实质的' },
  { lemma: 'emerge', level: 'B2', gloss: '出现；显露' },
  { lemma: 'undermine', level: 'B2', gloss: '削弱；损害' },
  { lemma: 'coherent', level: 'B2', gloss: '连贯的；一致的' },
  { lemma: 'feasible', level: 'B2', gloss: '可行的' },
  { lemma: 'accumulate', level: 'B2', gloss: '积累；累积' },
  { lemma: 'comprehensive', level: 'B2', gloss: '全面的；综合的' },
  { lemma: 'ubiquitous', level: 'C1', gloss: '无处不在的' },
  { lemma: 'meticulous', level: 'C1', gloss: '一丝不苟的' },
  { lemma: 'concede', level: 'C1', gloss: '承认；让步' },
  { lemma: 'pervasive', level: 'C1', gloss: '普遍的；渗透的' },
  { lemma: 'reconcile', level: 'C1', gloss: '调和；和解' },
  { lemma: 'compelling', level: 'C1', gloss: '令人信服的' },
  { lemma: 'ambiguous', level: 'C1', gloss: '模棱两可的' },
  { lemma: 'inevitable', level: 'C1', gloss: '不可避免的' },
  { lemma: 'advocate', level: 'C1', gloss: '提倡；主张' },
  { lemma: 'diminish', level: 'C1', gloss: '减少；削弱' },
  { lemma: 'inherent', level: 'C1', gloss: '固有的；内在的' },
  { lemma: 'scrutinize', level: 'C1', gloss: '仔细审查' },
  { lemma: 'ostensibly', level: 'C2', gloss: '表面上；据说' },
  { lemma: 'perfunctory', level: 'C2', gloss: '敷衍的' },
  { lemma: 'insidious', level: 'C2', gloss: '隐蔽有害的' },
  { lemma: 'salient', level: 'C2', gloss: '显著的；突出的' },
  { lemma: 'equivocal', level: 'C2', gloss: '模棱两可的' },
  { lemma: 'trenchant', level: 'C2', gloss: '尖锐深刻的' },
  { lemma: 'idiosyncratic', level: 'C2', gloss: '独特的；古怪的' },
  { lemma: 'obfuscate', level: 'C2', gloss: '混淆；使模糊' },
  { lemma: 'magnanimous', level: 'C2', gloss: '宽宏大量的' },
  { lemma: 'recalcitrant', level: 'C2', gloss: '顽抗的；不服从的' },
  { lemma: 'esoteric', level: 'C2', gloss: '深奥的；小众的' },
  { lemma: 'laconic', level: 'C2', gloss: '简洁的；话少的' },
]

const LEVELS: DiagnosisLevel[] = ['B1', 'B2', 'C1', 'C2']
const PASS_RATIO = 0.6

function shuffle<T>(items: T[], random: (max: number) => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const swap = random(index + 1)
    const current = result[index]!
    result[index] = result[swap]!
    result[swap] = current
  }
  return result
}

/** Draw a fresh mix of words so a repeated check does not feel memorized. */
export function sampleDiagnosisWords(
  countPerLevel = 6,
  random: (max: number) => number = (max) => randomInt(max),
): DiagnosisWord[] {
  const picked: DiagnosisWord[] = []
  for (const level of LEVELS) {
    const band = DIAGNOSIS_WORDS.filter((word) => word.level === level)
    picked.push(...shuffle(band, random).slice(0, Math.min(countPerLevel, band.length)))
  }
  return shuffle(picked, random)
}

/**
 * The level is the highest band the learner passes, requiring the lower bands
 * to pass as well. A short checklist is noisy, so one missed word is allowed
 * in each band of six.
 */
export function computeDiagnosisLevel(
  knownLemmas: string[],
  words: DiagnosisWord[] = DIAGNOSIS_WORDS,
): DiagnosisLevel {
  const known = new Set(knownLemmas.map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))
  let level: DiagnosisLevel = 'B1'
  for (const band of LEVELS) {
    const levelWords = words.filter((word) => word.level === band)
    if (levelWords.length === 0) break
    const hits = levelWords.filter((word) => known.has(word.lemma)).length
    if (hits >= Math.ceil(levelWords.length * PASS_RATIO)) {
      level = band
      continue
    }
    break
  }
  return level
}
