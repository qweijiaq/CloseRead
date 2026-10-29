import type { ClozeExercise, LearningItem, PackExercises } from '../types.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildCloze(items: LearningItem[], limit = 8): ClozeExercise[] {
  const exercises: ClozeExercise[] = []
  for (const item of items) {
    const sentence = item.contexts[0]?.sentence
    if (!sentence) continue
    const pattern = new RegExp(`\\b${escapeRegExp(item.lemma)}\\w*\\b`, 'i')
    if (!pattern.test(sentence)) continue
    exercises.push({
      sentence: sentence.replace(pattern, '______'),
      answer: item.lemma,
      hint: item.definition !== item.sense ? item.definition : item.sense,
    })
    if (exercises.length >= limit) break
  }
  return exercises
}

export function fallbackExercises(items: LearningItem[]): PackExercises {
  return {
    cloze: buildCloze(items),
    comprehension: [],
    discussion: [
      {
        question: '用 5 句话概括这篇文章，并至少用上 3 个今天的学习项。',
        answer:
          '参考思路：先概括主题，再用 commodity、perishable、undermine 等词描述关键观点；注意每个词都要放回语境。',
      },
      {
        question: '文中哪个观点最有说服力？用英文说明理由。',
        answer:
          '参考思路：可以选“碎片化是隐性税”的比喻，说明它如何增加长期成本；也可以比较“摩擦力”在产品和决策中的作用。',
      },
    ],
  }
}
