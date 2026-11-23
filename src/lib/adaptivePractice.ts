// ============================================================
// JEE Practice Hub — Module E1: Adaptive Practice & Spaced Repetition v2
// ============================================================

import { v4 as uuid } from 'uuid';
import type { SpacedRepetitionCard, TodayRecommendation } from './types';
import {
  getSettings,
  getSpacedRepetitionCards,
  saveSpacedRepetitionCard,
  getDueSpacedRepetitionCards,
  getAllQuestions,
  getSubjects,
  getChapters,
  getRevisionItems,
  getChapterWeightages,
} from './db';

const FIXED_INTERVALS = [3.0, 7.0, 21.0];

/**
 * Calculates the next review interval and ease factor.
 * When flag is OFF or at defaults, cleanly falls back to fixed [3, 7, 21] day schedule.
 */
export function calculateNextReview(options: {
  currentInterval: number;
  easeFactor: number;
  consecutiveCorrect: number;
  isCorrect: boolean;
  adaptiveFlagEnabled?: boolean;
}): { nextIntervalDays: number; newEaseFactor: number; newConsecutiveCorrect: number } {
  const {
    currentInterval,
    easeFactor,
    consecutiveCorrect,
    isCorrect,
    adaptiveFlagEnabled = false,
  } = options;

  if (!adaptiveFlagEnabled) {
    // Backward-compatible fallback: fixed 3, 7, 21 days
    if (!isCorrect) {
      return { nextIntervalDays: 3.0, newEaseFactor: 2.5, newConsecutiveCorrect: 0 };
    }
    const nextIdx = Math.min(consecutiveCorrect, FIXED_INTERVALS.length - 1);
    return {
      nextIntervalDays: FIXED_INTERVALS[nextIdx],
      newEaseFactor: 2.5,
      newConsecutiveCorrect: consecutiveCorrect + 1,
    };
  }

  // Dynamic SM-2 adaptive calculation
  if (!isCorrect) {
    return {
      nextIntervalDays: 1.0,
      newEaseFactor: Math.max(1.3, Number((easeFactor - 0.2).toFixed(2))),
      newConsecutiveCorrect: 0,
    };
  }

  const newConsecutiveCorrect = consecutiveCorrect + 1;
  let nextInterval: number;
  if (consecutiveCorrect === 0) {
    nextInterval = 1.0;
  } else if (consecutiveCorrect === 1) {
    nextInterval = 3.0;
  } else {
    nextInterval = Number((currentInterval * easeFactor).toFixed(1));
  }

  const newEaseFactor = Math.max(1.3, Math.min(3.5, Number((easeFactor + 0.1).toFixed(2))));

  return {
    nextIntervalDays: nextInterval,
    newEaseFactor,
    newConsecutiveCorrect,
  };
}

/**
 * Records a practice or revision attempt for a spaced repetition card.
 */
export function recordCardReview(
  studentId: string,
  questionId: string,
  isCorrect: boolean,
  asOf = new Date().toISOString()
): SpacedRepetitionCard {
  const settings = getSettings();
  const flagEnabled = settings.flag_e1_adaptive_repetition ?? false;

  const existingCards = getSpacedRepetitionCards(studentId);
  const existing = existingCards.find((c) => c.question_id === questionId);

  const currentInterval = existing?.interval_days ?? 3.0;
  const currentEase = existing?.ease_factor ?? 2.5;
  const currentConsecutive = existing?.consecutive_correct ?? 0;

  const calc = calculateNextReview({
    currentInterval,
    easeFactor: currentEase,
    consecutiveCorrect: currentConsecutive,
    isCorrect,
    adaptiveFlagEnabled: flagEnabled,
  });

  const baseTime = new Date(asOf).getTime();
  const nextDue = new Date(baseTime + calc.nextIntervalDays * 86400000).toISOString();

  const card: SpacedRepetitionCard = {
    id: existing?.id ?? uuid(),
    student_id: studentId,
    question_id: questionId,
    interval_days: calc.nextIntervalDays,
    ease_factor: calc.newEaseFactor,
    consecutive_correct: calc.newConsecutiveCorrect,
    next_review_due: nextDue,
    last_reviewed_at: asOf,
    updated_at: asOf,
  };

  return saveSpacedRepetitionCard(card);
}

/**
 * Generates transparent "Today" focus recommendations strictly capped at 3 questions.
 * ZERO GAMIFICATION: No pressure badges, no streaks, no point countdowns.
 */
export function getTodayRecommendations(studentId: string, limit = 3): TodayRecommendation[] {
  const questions = getAllQuestions();
  const subjects = getSubjects();
  const chapters = getChapters();
  const weightages = getChapterWeightages();
  const mistakes = getRevisionItems(studentId).filter((m) => !m.cleared);

  const dueCards = getDueSpacedRepetitionCards(studentId);
  const seenQuestionIds = new Set<string>();
  const recommendations: TodayRecommendation[] = [];

  const getDetails = (qId: string) => {
    const q = questions.find((item) => item.id === qId);
    if (!q) return null;
    const sub = subjects.find((s) => s.id === q.subject_id)?.name ?? 'Physics';
    const chap = chapters.find((c) => c.id === q.chapter_id)?.name ?? 'General';
    return { q, sub, chap };
  };

  // 1. Spaced Repetition Due Cards (Primary focus)
  for (const card of dueCards) {
    if (recommendations.length >= limit) break;
    if (seenQuestionIds.has(card.question_id)) continue;

    const details = getDetails(card.question_id);
    if (details) {
      recommendations.push({
        question_id: card.question_id,
        subject_name: details.sub,
        chapter_name: details.chap,
        reason_badge: 'Review due',
        due_date: card.next_review_due,
      });
      seenQuestionIds.add(card.question_id);
    }
  }

  // 2. Unmastered Mistakes (Secondary focus)
  for (const m of mistakes) {
    if (recommendations.length >= limit) break;
    if (seenQuestionIds.has(m.question_id)) continue;

    const details = getDetails(m.question_id);
    if (details) {
      recommendations.push({
        question_id: m.question_id,
        subject_name: details.sub,
        chapter_name: details.chap,
        reason_badge: 'Mistake review',
      });
      seenQuestionIds.add(m.question_id);
    }
  }

  // 3. High Weightage Chapters (Tertiary fill)
  if (recommendations.length < limit) {
    const sortedWeightages = [...weightages].sort((a, b) => b.expected_questions - a.expected_questions);
    for (const w of sortedWeightages) {
      if (recommendations.length >= limit) break;
      const targetChap = chapters.find((c) => c.name === w.chapter);
      const candidateQ = questions.find(
        (q) => (targetChap ? q.chapter_id === targetChap.id : true) && !seenQuestionIds.has(q.id)
      );
      if (candidateQ) {
        const details = getDetails(candidateQ.id);
        if (details) {
          recommendations.push({
            question_id: candidateQ.id,
            subject_name: details.sub,
            chapter_name: details.chap,
            reason_badge: 'High weightage',
          });
          seenQuestionIds.add(candidateQ.id);
        }
      }
    }
  }

  return recommendations.slice(0, limit);
}
