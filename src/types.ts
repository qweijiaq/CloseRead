export type ResourceKind = 'pdf' | 'epub' | 'mobi' | 'web' | 'text' | 'transcript'

export interface Segment {
  index: number
  text: string
  page?: number
  timestamp?: string
  heading?: string
}

export interface ResourceArticle {
  index: number
  title: string
  text: string
  wordCount: number
  segments: Segment[]
}

export interface Resource {
  id: string
  title: string
  kind: ResourceKind
  source: string
  text: string
  wordCount: number
  segments: Segment[]
  articles?: ResourceArticle[]
  /** Manual editorial overrides keyed by article index. */
  articleOverrides?: Record<string, boolean>
  metadata: Record<string, string | number>
  createdAt: string
}

export interface ItemContext {
  resourceId: string
  resourceTitle: string
  segmentIndex: number
  sentence: string
  page?: number
  timestamp?: string
  translation?: string
}

export interface LearningExample {
  text: string
  origin: 'source' | 'dictionary' | 'generated'
}

export interface ItemRelations {
  synonyms: string[]
  antonyms: string[]
  confusables: string[]
  wordFamily: string[]
}

export interface WordFormationPart {
  form: string
  meaning: string
  examples: string[]
}

export interface WordFormation {
  roots: WordFormationPart[]
  prefixes: WordFormationPart[]
  suffixes: WordFormationPart[]
}

export interface SentenceChunk {
  text: string
  role: string
  meaning?: string
}

export interface SentenceCardData {
  original: string
  translation: string
  chunks: SentenceChunk[]
  pattern?: string
  grammar?: string
  variants: string[]
  why?: string
  paragraphIndex?: number
  /** The source paragraph was edited/deleted and the sentence needs review. */
  stale?: boolean
}

export interface DerivationNode {
  id: string
  word: string
  meaningZh?: string
  kind: 'center' | 'root' | 'prefix' | 'suffix' | 'derivative' | 'related'
}

export interface DerivationEdge {
  from: string
  to: string
  label?: string
}

export interface DerivationGraph {
  nodes: DerivationNode[]
  edges: DerivationEdge[]
}

export type ItemTier = 'core' | 'bonus'

export interface SelectionMetadata {
  mode: 'auto' | 'fixed'
  recommended: number
  core: number
  bonus: number
  wordCount: number
  cefr: string
  reason: string
  cachedCards?: number
  /** Items already in the learner's library; they stay as Bonus cards. */
  reused?: number
}

export interface LearningItem {
  id: string
  type: 'word_sense' | 'collocation' | 'pattern' | 'sentence'
  lemma: string
  sense: string
  pos?: string
  ipa?: string
  definition: string
  definitionZh?: string
  cefr?: string
  frequencyRank?: number
  /** Core items enter the review queue; bonus items are shown in the pack only. */
  tier?: ItemTier
  /** Present in the review library before this pack was built. */
  libraryState?: 'new' | 'learning' | 'known'
  contexts: ItemContext[]
  collocations: string[]
  examples: LearningExample[]
  relations: ItemRelations
  /** Present for type "sentence"; the sentence-level card used by the reader and review. */
  sentence?: SentenceCardData
  /** AI-generated word-family/derivation graph, cached with the card. */
  derivation?: DerivationGraph
  /** Roots, prefixes and suffixes that help remember this word and its family. */
  wordFormation?: WordFormation
  /** A short, accurate mnemonic or usage hook. */
  memoryHook?: string
  notes?: string
  tags: string[]
  sourceRef: string
  createdAt: string
  updatedAt: string
}

export interface ReviewState {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  fsrsState: number
  lastReview?: string
}

export interface StoredItem extends LearningItem {
  review: ReviewState
  favorite: boolean
  status: 'active' | 'suspended' | 'known'
}

export interface ClozeExercise {
  sentence: string
  answer: string
  hint?: string
  sentenceZh?: string
  answerZh?: string
}

export interface ComprehensionQuestion {
  question: string
  answer: string
  questionZh?: string
  answerZh?: string
}

export interface DiscussionQuestion {
  question: string
  answer: string
  questionZh?: string
  answerZh?: string
}

export interface ParagraphConnector {
  text: string
  usage: string
}

export interface ParagraphNote {
  summary: string
  role?: string
  keySentence?: string
  keySentenceNote?: string
  grammar?: string
  connectors: ParagraphConnector[]
  background?: string
  question?: string
  answer?: string
}

export interface ReadingParagraph {
  index: number
  original: string
  translation?: string
  itemIds: string[]
  /** Manual sentence boundaries for the sentence-focus reader. */
  customSentences?: string[]
  /** Intensive-reading annotation for this paragraph. */
  note?: ParagraphNote
}

export interface PackExercises {
  cloze: ClozeExercise[]
  comprehension: ComprehensionQuestion[]
  discussion: DiscussionQuestion[]
}

export interface AnalysisResult {
  summary: string
  difficulty: { cefr: string; reason: string }
  items: LearningItem[]
  exercises: PackExercises
  notes: string[]
  frontMatter?: PackFrontMatter
  /** Number of cards reused from the persistent word-card cache. */
  cachedCards?: number
  /** Paragraph-by-paragraph bilingual reading. */
  reading?: ReadingParagraph[]
  /** Long-form Chinese article generated in the requested style. */
  editorial?: string
}

export interface PackFrontMatter {
  title: string
  titleZh?: string
  titleNote?: string
  summaryZh?: string
  lead?: string
  leadZh?: string
  leadNote?: string
  section?: string
  itemIds: string[]
}

export interface LearningPack {
  id: string
  resourceId: string
  title: string
  source: string
  mode: 'heuristic' | 'llm'
  generatedAt: string
  summary: string
  difficulty: { cefr: string; reason: string }
  frontMatter?: PackFrontMatter
  /** Concise, cached reading guide generated from the editorial and cards. */
  readingGuide?: string
  stats: {
    wordCount: number
    itemCount: number
    readingMinutes: number
  }
  items: LearningItem[]
  exercises: PackExercises
  sourceText?: string
  reading?: ReadingParagraph[]
  styleName?: string
  editorial?: string
  selection?: SelectionMetadata
  parentResourceId?: string
  articleIndex?: number
  audio?: PackAudio
}

export interface PackRecord {
  id: string
  resourceId: string
  dir: string
  mode: 'heuristic' | 'llm'
  itemCount: number
  createdAt: string
  /** Article title when the pack covers one article of a larger issue. */
  title?: string
  parentResourceId?: string
  articleIndex?: number
}

export interface PackAudio {
  summary?: string
  words?: string
  items: Record<string, string>
}

export interface ReviewLogEntry {
  itemId: string
  rating: number
  reviewedAt: string
  dueAfter: string
}
