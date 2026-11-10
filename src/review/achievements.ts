import { loadReadingProgress } from '../reading/progress.js'
import type { Store } from '../store/store.js'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
  progress: number
  target: number
}

export interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3
}

export interface AchievementsPayload {
  badges: Achievement[]
  activity: ActivityDay[]
  studyDays: number
  earned: number
  total: number
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addCount(counts: Map<string, number>, date: Date, amount = 1): void {
  const key = localDayKey(date)
  counts.set(key, (counts.get(key) ?? 0) + amount)
}

function badge(
  input: Omit<Achievement, 'earned' | 'progress'> & { progress?: number },
): Achievement {
  const progress = Math.max(0, Math.min(input.target, input.progress ?? input.target))
  return {
    ...input,
    progress,
    earned: progress >= input.target,
  }
}

/**
 * Derived gamification: no extra state on disk. The calendar counts reviews,
 * written outputs, reading progress and finished articles per local day.
 */
export async function achievementPayload(store: Store, now: Date = new Date()): Promise<AchievementsPayload> {
  const logs = store.logsSince('')
  const items = store.listItems()
  const outputs = store.listOutputs(1000, now)
  const preferences = store.preferences()
  const counts = new Map<string, number>()
  let finished = 0

  for (const log of logs) addCount(counts, new Date(log.reviewedAt))
  for (const output of outputs) {
    const date = new Date(`${output.date}T12:00:00`)
    if (!Number.isNaN(date.getTime())) addCount(counts, date)
  }
  for (const pack of store.packs()) {
    const progress = await loadReadingProgress(pack.dir, pack.id, 0)
    if (progress.finishedAt) {
      finished += 1
      addCount(counts, new Date(progress.finishedAt))
    }
    if (progress.readParagraphs.length > 0 || progress.startedAt || progress.finishedAt) {
      addCount(counts, new Date(progress.updatedAt))
    }
  }

  const activity: ActivityDay[] = []
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 83)
  let studyDays = 0
  for (let index = 0; index < 84; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = localDayKey(date)
    const count = counts.get(key) ?? 0
    if (count > 0) studyDays += 1
    activity.push({
      date: key,
      count,
      level: count === 0 ? 0 : count >= 4 ? 3 : count >= 2 ? 2 : 1,
    })
  }

  const known = items.filter((item) => item.status === 'known').length
  const nightOwl = logs.some((log) => {
    const hour = new Date(log.reviewedAt).getHours()
    return hour >= 22 || hour < 4
  })
  const earlyBird = logs.some((log) => {
    const hour = new Date(log.reviewedAt).getHours()
    return hour >= 5 && hour < 8
  })

  const badges: Achievement[] = [
    badge({
      id: 'first-read',
      title: '初次入境',
      description: '读完第一篇文章',
      icon: '📖',
      progress: finished,
      target: 1,
    }),
    badge({
      id: 'five-reads',
      title: '五篇精读',
      description: '累计读完 5 篇文章',
      icon: '📚',
      progress: finished,
      target: 5,
    }),
    badge({
      id: 'streak-3',
      title: '三日不断',
      description: '连续学习 3 天',
      icon: '🔥',
      progress: preferences.streak,
      target: 3,
    }),
    badge({
      id: 'streak-7',
      title: '一周之火',
      description: '连续学习 7 天',
      icon: '🔥',
      progress: preferences.streak,
      target: 7,
    }),
    badge({
      id: 'reviews-100',
      title: '百次重逢',
      description: '累计复习 100 次',
      icon: '🧠',
      progress: logs.length,
      target: 100,
    }),
    badge({
      id: 'outputs-10',
      title: '下笔有神',
      description: '写下 10 篇英文输出',
      icon: '✍️',
      progress: outputs.length,
      target: 10,
    }),
    badge({
      id: 'known-50',
      title: '词汇花园',
      description: '掌握 50 个词或表达',
      icon: '🌱',
      progress: known,
      target: 50,
    }),
    badge({
      id: 'collector-50',
      title: '收藏家',
      description: '词库累计收集 50 张卡',
      icon: '🗂️',
      progress: items.length,
      target: 50,
    }),
    badge({
      id: 'night-owl',
      title: '夜猫子',
      description: '在 22 点后复习一次',
      icon: '🦉',
      progress: nightOwl ? 1 : 0,
      target: 1,
    }),
    badge({
      id: 'early-bird',
      title: '早起鸟',
      description: '在 8 点前复习一次',
      icon: '🌅',
      progress: earlyBird ? 1 : 0,
      target: 1,
    }),
  ]

  return {
    badges,
    activity,
    studyDays,
    earned: badges.filter((entry) => entry.earned).length,
    total: badges.length,
  }
}
