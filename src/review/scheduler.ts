import { State, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Card, Grade as FsrsGrade } from 'ts-fsrs'

import type { ReviewState } from '../types.js'

const scheduler = fsrs({ enable_fuzz: false })

export type Grade = 1 | 2 | 3 | 4

export function newReviewState(now: Date = new Date()): ReviewState {
  return fromCard(createEmptyCard(now))
}

export function toCard(review: ReviewState): Card {
  return {
    due: new Date(review.due),
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.elapsedDays,
    scheduled_days: review.scheduledDays,
    learning_steps: review.learningSteps,
    reps: review.reps,
    lapses: review.lapses,
    state: review.fsrsState as State,
    last_review: review.lastReview ? new Date(review.lastReview) : undefined,
  }
}

export function fromCard(card: Card): ReviewState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    fsrsState: card.state,
    lastReview: card.last_review?.toISOString(),
  }
}

export function rateReview(
  review: ReviewState,
  grade: Grade,
  now: Date = new Date(),
): { review: ReviewState; log: { rating: number; reviewedAt: string; dueAfter: string } } {
  const result = scheduler.next(toCard(review), now, grade as FsrsGrade)
  return {
    review: fromCard(result.card),
    log: {
      rating: grade,
      reviewedAt: now.toISOString(),
      dueAfter: result.card.due.toISOString(),
    },
  }
}

export function isDue(review: ReviewState, now: Date = new Date()): boolean {
  return new Date(review.due).getTime() <= now.getTime()
}

export function isNew(review: ReviewState): boolean {
  return review.reps === 0
}

export function stateLabel(review: ReviewState): string {
  if (review.reps === 0) return 'new'
  switch (review.fsrsState) {
    case State.Learning:
    case State.Relearning:
      return 'learning'
    case State.Review:
      return 'review'
    default:
      return 'new'
  }
}
