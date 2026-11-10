export type DiagnosisLevel = 'B1' | 'B2' | 'C1' | 'C2'

export interface DiagnosisWord {
  lemma: string
  level: DiagnosisLevel
  gloss: string
}

/**
 * A short self-check sampled from the CEFR bands CloseRead targets. It is
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
  { lemma: 'sustain', level: 'B2', gloss: '维持；支撑' },
  { lemma: 'decline', level: 'B2', gloss: '下降；拒绝' },
  { lemma: 'attribute', level: 'B2', gloss: '归因于' },
  { lemma: 'framework', level: 'B2', gloss: '框架；体系' },
  { lemma: 'reluctant', level: 'B2', gloss: '不情愿的' },
  { lemma: 'substantial', level: 'B2', gloss: '大量的；实质的' },
  { lemma: 'ubiquitous', level: 'C1', gloss: '无处不在的' },
  { lemma: 'meticulous', level: 'C1', gloss: '一丝不苟的' },
  { lemma: 'concede', level: 'C1', gloss: '承认；让步' },
  { lemma: 'pervasive', level: 'C1', gloss: '普遍的；渗透的' },
  { lemma: 'reconcile', level: 'C1', gloss: '调和；和解' },
  { lemma: 'compelling', level: 'C1', gloss: '令人信服的' },
  { lemma: 'ostensibly', level: 'C2', gloss: '表面上；据说' },
  { lemma: 'perfunctory', level: 'C2', gloss: '敷衍的' },
  { lemma: 'insidious', level: 'C2', gloss: '隐蔽有害的' },
  { lemma: 'salient', level: 'C2', gloss: '显著的；突出的' },
  { lemma: 'equivocal', level: 'C2', gloss: '模棱两可的' },
  { lemma: 'trenchant', level: 'C2', gloss: '尖锐深刻的' },
]

const LEVELS: DiagnosisLevel[] = ['B1', 'B2', 'C1', 'C2']
const PASS_RATIO = 0.6

/**
 * The level is the highest band the learner passes, requiring the lower bands
 * to pass as well. A short checklist is noisy, so one missed word is allowed
 * in each band of six.
 */
export function computeDiagnosisLevel(knownLemmas: string[]): DiagnosisLevel {
  const known = new Set(knownLemmas.map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))
  let level: DiagnosisLevel = 'B1'
  for (const band of LEVELS) {
    const words = DIAGNOSIS_WORDS.filter((word) => word.level === band)
    const hits = words.filter((word) => known.has(word.lemma)).length
    if (hits >= Math.ceil(words.length * PASS_RATIO)) {
      level = band
      continue
    }
    break
  }
  return level
}
