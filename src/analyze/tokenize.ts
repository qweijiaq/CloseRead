import nlp from 'compromise'

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves`
    .split(/\s+/)
    .filter(Boolean),
)

const COMMON_WORDS = new Set(
  `able ago agree allow already also always among another answer around ask available back bad became become begin behind believe best better big bit body book both bring build business buy call came case change child city clear close come community company could country course court current day decide decision develop die difference different difficult door draw early east easy eat effect end enough even event ever every example experience eye face fact fall family far father feel few field fight figure fill find fine fire first five follow food foot force form four free friend front full fund future game general get girl give glass go goal good government great group grow growth guy hand happen hard head health hear heart help high history home hope hour house however huge human idea important improve include increase indeed industry information inside instead interest issue job keep key kid kind know land language large last late later law lead leader learn leave left less let letter level life light like line list little live local long look lose loss lot love low machine main major make man manage many market matter may maybe mean measure media meet member message method middle might mind minute miss model moment money month moon more morning most mother move movement much music must name nation natural nature near nearly need network never new news next nice night none north note nothing notice now number occur off offer office often oil old open operation opportunity order organization other outside over own page paper parent part particular party pass past patient pattern pay people per perhaps period person phone pick picture piece place plan plant play point police policy political poor popular position possible power practice prepare present president press pressure pretty price private probably problem process produce product program project property provide public pull purpose push put quality question quickly quite race radio raise range rate rather reach read ready real reality reason receive recent recently recognize record red reduce region relate relationship religious remain remember remove report represent require research resource respond response rest result return reveal rich right rise risk road rock role room rule run safe save say school science score sea season seat second section security see seek seem sell send sense series serious serve service set seven share short should show side sign significant similar simple simply since sing sister sit site situation six size skill small social society soldier some somebody someone something sometimes son song soon sort sound source south space speak special specific speech spend sport spring staff stage stand standard star start state station stay step still stock stop store story street strong structure student study stuff style subject success successful such suddenly suffer suggest summer support sure surface system table take talk task tax teach teacher team technology television tell tend term test than thank thing think third though thought thousand threat three through throughout throw thus time today together tonight too top total tough toward town trade traditional training travel treat tree trial trip trouble true truth try turn type under understand unit until upon use usually value various victim view visit voice vote wait walk wall want war watch water way weapon wear week weight well west western whatever whether while white whole whom whose wide wife will win wind window wish with within without woman wonder word work worker world worry would write wrong yard year yes yet young`
    .split(/\s+/)
    .filter(Boolean),
)

const POS_WEIGHT: Record<string, number> = {
  verb: 1.25,
  noun: 1.2,
  adjective: 1.1,
  adverb: 0.75,
}

const MAX_UNIQUE_TO_SCAN = 400

export interface Candidate {
  lemma: string
  surface: string
  pos?: string
  count: number
  score: number
  exampleSentence: string
}

const ABBREVIATIONS = new Set(
  'mr mrs ms dr prof st sr jr vs no fig jan feb mar apr jun jul aug sep sept oct nov dec e.g i.e al'.split(
    /\s+/,
  ),
)

function isNonTerminalAbbreviation(segment: string): boolean {
  const token = segment.trim().split(/\s+/).pop()?.replace(/["'”’)\]]+$/, '') ?? ''
  const lower = token.toLowerCase().replace(/\.$/, '')
  if (ABBREVIATIONS.has(lower)) return true
  return /^[A-Z]\.$/.test(token)
}

function isAcronym(segment: string): boolean {
  const token = segment.trim().split(/\s+/).pop()?.replace(/["'”’)\]]+$/, '') ?? ''
  return /^(?:[A-Z]\.){2,}$/.test(token)
}

function startsSentence(segment: string): boolean {
  return /^(?:The|This|That|These|Those|It|He|She|They|We|You|I|But|However|Yet|Still|Instead|Meanwhile|After|Before|In|On|At|For|As|When|While|If|Although|Because|Given|Now|Then|There|Here|Such|Many|Most|Some|All|No|Not|A|An|One|Two|Three|First|Second|Finally|So|And|Or)\b/.test(
    segment.trim(),
  )
}

export function sentences(text: string): string[] {
  const cleaned = text
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []

  const raw = cleaned.split(/(?<=[.!?]["'”’)\]]*)\s+(?=[A-Z0-9"'“‘(])/g)
  const merged: string[] = []
  for (const part of raw) {
    const segment = part.trim()
    if (!segment) continue
    const previous = merged[merged.length - 1]
    if (previous && isNonTerminalAbbreviation(previous)) {
      merged[merged.length - 1] = `${previous} ${segment}`
      continue
    }
    // U.S./U.K. can end a sentence, but usually not before a noun (U.S. government).
    if (previous && isAcronym(previous) && !startsSentence(segment)) {
      merged[merged.length - 1] = `${previous} ${segment}`
      continue
    }
    merged.push(segment)
  }
  return merged
}

export function posOf(word: string): string | undefined {
  const doc = nlp(word)
  if (doc.has('#Verb')) return 'verb'
  if (doc.has('#Noun')) return 'noun'
  if (doc.has('#Adjective')) return 'adjective'
  if (doc.has('#Adverb')) return 'adverb'
  return undefined
}

export function lemmaOf(word: string): string {
  const lower = word.toLowerCase().replace(/[’']s$/, '')
  if (lower.length <= 2) return lower
  const doc = nlp(lower)
  if (doc.has('#Verb')) {
    const infinitive = doc.verbs().toInfinitive().text().trim().toLowerCase()
    if (infinitive) return infinitive
  }
  if (doc.has('#Noun')) {
    const singular = doc.nouns().toSingular().text().trim().toLowerCase()
    if (singular) return singular
  }
  return lower
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findContextSentence(text: string, lemma: string): string {
  const pattern = new RegExp(`\\b${escapeRegExp(lemma)}(?:s|es|ed|ing)?\\b`, 'i')
  for (const sentence of sentences(text)) {
    if (pattern.test(sentence)) return sentence.slice(0, 600)
  }
  const index = text.toLowerCase().indexOf(lemma.toLowerCase())
  if (index < 0) return ''
  const start = Math.max(0, text.lastIndexOf('\n', index))
  const end = text.indexOf('\n', index)
  return text.slice(start, end < 0 ? Math.min(text.length, index + 400) : end).trim().slice(0, 600)
}

export function extractCollocations(text: string, lemma: string, max = 3): string[] {
  const pattern = new RegExp(`\\b${escapeRegExp(lemma)}\\w*\\b`, 'i')
  const scores = new Map<string, number>()

  for (const sentence of sentences(text)) {
    if (!pattern.test(sentence)) continue
    const words = sentence.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
    for (let size = 2; size <= 4; size++) {
      for (let index = 0; index + size <= words.length; index++) {
        const gram = words.slice(index, index + size)
        if (!gram.some((word) => word.toLowerCase().startsWith(lemma.toLowerCase()))) continue
        const contentWords = gram.filter(
          (word) => !STOPWORDS.has(word.toLowerCase()) && !COMMON_WORDS.has(word.toLowerCase()),
        )
        if (contentWords.length === 0) continue
        const first = gram[0]!.toLowerCase()
        const last = gram[gram.length - 1]!.toLowerCase()
        if (STOPWORDS.has(first) || STOPWORDS.has(last)) continue
        const phrase = gram.join(' ').toLowerCase().replace(/[.,!?;:]$/, '')
        scores.set(phrase, (scores.get(phrase) ?? 0) + (5 - size))
      }
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .reduce<string[]>((selected, [phrase]) => {
      if (selected.length >= max) return selected
      if (selected.some((chosen) => phrase.includes(chosen))) return selected
      selected.push(phrase)
      return selected
    }, [])
}

function isProperNoun(token: string, indexInSentence: number): boolean {
  if (indexInSentence === 0) return false
  if (token.length <= 1) return false
  if (/^[A-Z][A-Z]+$/.test(token)) return true
  return /^[A-Z]/.test(token)
}

export function extractCandidates(text: string, limit: number): Candidate[] {
  const counts = new Map<string, { surface: string; count: number; exampleSentence: string }>()

  for (const sentence of sentences(text)) {
    const matches = [...sentence.matchAll(/[A-Za-z][A-Za-z'’-]*/g)]
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]!
      const raw = match[0].replace(/[’']s$/, '')
      const lower = raw.toLowerCase()
      if (raw.length < 3) continue
      if (lower.length < 3) continue
      if (STOPWORDS.has(lower) || COMMON_WORDS.has(lower)) continue
      if (isProperNoun(raw, index)) continue
      if (!/^[a-z][a-z'’-]*$/i.test(raw)) continue

      const existing = counts.get(lower)
      if (existing) {
        existing.count++
      } else {
        counts.set(lower, { surface: raw, count: 1, exampleSentence: sentence })
      }
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[0].length - a[0].length)
    .slice(0, MAX_UNIQUE_TO_SCAN)

  const merged = new Map<string, Candidate>()
  for (const [surfaceLower, entry] of ranked) {
    const lemma = lemmaOf(entry.surface)
    if (STOPWORDS.has(lemma) || COMMON_WORDS.has(lemma)) continue
    const pos = posOf(entry.surface) ?? posOf(lemma)
    const weight = pos ? (POS_WEIGHT[pos] ?? 0.9) : 0.6
    const score = entry.count * (1 + Math.min(lemma.length, 12) / 12) * weight
    const existing = merged.get(lemma)
    if (existing) {
      existing.count += entry.count
      existing.score += score
      continue
    }
    merged.set(lemma, {
      lemma,
      surface: entry.surface,
      pos,
      count: entry.count,
      score,
      exampleSentence: entry.exampleSentence,
    })
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, Math.max(1, limit))
    .map((candidate) => ({
      ...candidate,
      exampleSentence: findContextSentence(text, candidate.lemma) || candidate.exampleSentence,
    }))
}

export interface DifficultyEstimate {
  cefr: string
  reason: string
}

export function estimateDifficulty(text: string): DifficultyEstimate {
  const sentenceList = sentences(text)
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
  const unique = new Set(words.map((word) => word.toLowerCase()))
  const averageSentenceLength = words.length / Math.max(1, sentenceList.length)
  const longWordRatio = words.filter((word) => word.length >= 8).length / Math.max(1, words.length)
  const uniqueRatio = unique.size / Math.max(1, words.length)
  const score = averageSentenceLength / 12 + longWordRatio * 1.2 + uniqueRatio * 0.3

  let cefr = 'C2'
  if (score < 0.95) cefr = 'A2'
  else if (score < 1.2) cefr = 'B1'
  else if (score < 1.6) cefr = 'B2'
  else if (score < 1.95) cefr = 'C1'

  return {
    cefr,
    reason: `平均句长 ${averageSentenceLength.toFixed(1)} 词，长词占比 ${(longWordRatio * 100).toFixed(0)}%，词汇多样性 ${(uniqueRatio * 100).toFixed(0)}%。`,
  }
}
