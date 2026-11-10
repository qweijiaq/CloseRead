import type { Store } from '../store/store.js'

export interface PetState {
  name: string
  emoji: string
  stage: string
  level: number
  xp: number
  nextXp: number
  streak: number
  reviews: number
  known: number
  mood: string
}

const STAGES = [
  { at: 0, name: '词芽', emoji: '🌱', stage: 'seed' },
  { at: 30, name: '小书虫', emoji: '🐛', stage: 'larva' },
  { at: 120, name: '守词兽', emoji: '🦊', stage: 'fox' },
  { at: 320, name: '阅读龙', emoji: '🐲', stage: 'dragon' },
  { at: 700, name: '词灵', emoji: '🦉', stage: 'owl' },
]

export function petState(store: Store): PetState {
  const stats = store.stats()
  const reviews = store.logsSince('').length
  const known = store.listItems().filter((item) => item.status === 'known').length
  const streak = store.preferences().streak
  const xp = reviews + known * 4 + streak * 12 + stats.newItems * 2
  let current = STAGES[0]!
  for (const stage of STAGES) if (xp >= stage.at) current = stage
  const next = STAGES.find((stage) => stage.at > xp)
  const mood = streak >= 7 ? '精力充沛' : reviews === 0 ? '有点饿' : known > 20 ? '心满意足' : '好奇地张望'
  return {
    name: current.name,
    emoji: current.emoji,
    stage: current.stage,
    level: STAGES.indexOf(current) + 1,
    xp,
    nextXp: next?.at ?? xp,
    streak,
    reviews,
    known,
    mood,
  }
}
