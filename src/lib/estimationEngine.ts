// ============================================================
// Bayesian Monte Carlo Chance-of-Target Estimation Engine
// (Phase 3: SRD FR-10.2, FR-10.3, Section 6.1)
// ============================================================

import type {
  Target, PercentileMap, ChapterWeightage, EstimateSnapshot,
  StudentEstimate, CoarseBand, EstimateDisplayMode, Difficulty,
} from './types';
import {
  getTarget, getPercentileMap, getChapterWeightages,
  getAllQuestions, getPracticedQuestions, interpolatePercentile,
  saveEstimateSnapshot, saveStudentEstimate, getSubjects, getChapters,
  getQuestionAnswerMonitor, getSettings, getPaper,
} from './db';
import { computeExamConditionsAdjustment } from './projectionEngine';

// ---- Seeded PRNG (Mulberry32) for deterministic simulations ----

export function createMulberry32(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples a value from Gamma(shape, 1) using Marsaglia and Tsang method.
 */
function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    const u = rand();
    return sampleGamma(shape + 1, rand) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let z = 0;
    let v = 0;
    do {
      // Standard normal via Box-Muller
      const u1 = Math.max(1e-12, rand());
      const u2 = rand();
      z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      v = 1 + c * z;
    } while (v <= 0);

    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * z * z * z * z) return d * v;
    if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Samples from Beta(alpha, beta) using two Gamma variates.
 */
export function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const g1 = sampleGamma(Math.max(1e-6, alpha), rand);
  const g2 = sampleGamma(Math.max(1e-6, beta), rand);
  if (g1 + g2 === 0) return 0.5;
  return g1 / (g1 + g2);
}

// ---- Weighting by Difficulty Level ----

export function getDifficultyWeight(diff: Difficulty): number {
  switch (diff) {
    case 'Basic': return 0.8;
    case 'Medium': return 1.0;
    case 'Advanced': return 1.2;
    default: return 1.0;
  }
}

export interface ChapterPosterior {
  subject: string;
  chapter: string;
  alpha: number;
  beta: number;
  practicedCount: number;
  weight: number; // expected questions in exam paper
}

export interface EstimationOptions {
  studentId: string;
  targetId: string;
  as_of?: string;
  seed?: number;
  draws?: number;
  minQuestionsThreshold?: number;
  minChaptersThreshold?: number;
  displayMode?: EstimateDisplayMode;
}

export interface EstimationResult {
  status: 'sufficient' | 'insufficient_data' | 'needs_percentile_map';
  qualifyingCount: number;
  chaptersCount: number;
  coveragePercentage: number;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  probabilityRounded: number | null;
  coarseBand: CoarseBand;
  snapshot: EstimateSnapshot | null;
  studentEstimate: StudentEstimate | null;
}

/**
 * Runs the Bayesian Monte Carlo Chance-of-Target Projection.
 */
export function runChanceEstimation(options: EstimationOptions): EstimationResult {
  const {
    studentId,
    targetId,
    as_of = new Date().toISOString(),
    seed = 123456789,
    draws = 10000,
    minQuestionsThreshold = 200,
    minChaptersThreshold = 10,
    displayMode = 'range',
  } = options;

  const target = getTarget(targetId);
  if (!target) {
    throw new Error(`Target ${targetId} not found`);
  }

  // 1. Resolve Target Percentile Threshold T
  let targetPercentile: number | null = null;
  if (target.target_type === 'percentile') {
    targetPercentile = target.target_value;
  } else if (target.target_type === 'rank') {
    const N = target.candidate_count ?? 1400000;
    targetPercentile = Number((((N - target.target_value) / N) * 100).toFixed(2));
  } else if (target.target_type === 'cutoff') {
    if (target.cutoff_unit === 'percentile') {
      targetPercentile = target.target_value;
    } else if (target.reference_map_id) {
      targetPercentile = interpolatePercentile(target.reference_map_id, target.target_value);
    }
  }

  // Check map requirement
  if (!target.reference_map_id || !getPercentileMap(target.reference_map_id)) {
    const emptySnapshot = saveEstimateSnapshot({
      student_id: studentId,
      target_id: targetId,
      as_of,
      qualifying_questions_count: 0,
      qualifying_chapters_count: 0,
      coverage_percentage: 0,
      p10_percentile: null,
      p50_percentile: null,
      p90_percentile: null,
      chance_probability_rounded: null,
      model_metadata: {
        status: 'needs_percentile_map',
        message: 'A shift marks-to-percentile map must be linked to compute projections.',
      },
    });

    const emptyStudentEstimate = saveStudentEstimate({
      student_id: studentId,
      target_id: targetId,
      display_mode: displayMode,
      projected_range_low: null,
      projected_range_high: null,
      coarse_band: 'Not enough data yet',
      as_of,
    });

    return {
      status: 'needs_percentile_map',
      qualifyingCount: 0,
      chaptersCount: 0,
      coveragePercentage: 0,
      p10: null,
      p50: null,
      p90: null,
      probabilityRounded: null,
      coarseBand: 'Not enough data yet',
      snapshot: emptySnapshot,
      studentEstimate: emptyStudentEstimate,
    };
  }

  const mapId = target.reference_map_id;

  // 2. Fetch Practice first answers strictly prior to as_of
  const asOfTime = new Date(as_of).getTime();
  const allPracticed = getPracticedQuestions(studentId);
  const questions = getAllQuestions();

  const qualifyingFirstAnswers: Array<{
    questionId: string;
    subject: string;
    chapter: string;
    difficulty: Difficulty;
    isCorrect: boolean;
    source: 'practice' | 'exam';
  }> = [];

  const chapterPracticedSet = new Set<string>();

  allPracticed.forEach(pq => {
    if (!pq.first_answer || !pq.first_practiced_at) return;
    if (new Date(pq.first_practiced_at).getTime() > asOfTime) return;

    const q = questions.find(item => item.id === pq.question_id);
    if (!q) return;

    // Filter out Dropped, Bonus, Flagged, and JEE Advanced questions
    if (q.answer_status === 'Dropped' || q.answer_status === 'Bonus') return;
    if (q.verification_status === 'Flagged') return;
    if ((q as any).source === 'jee_advanced') return;
    const paper = getPaper(q.paper_id);
    if (paper?.source === 'jee_advanced') return;

    const sName = (q as any).subject || getSubjects().find(s => s.id === q.subject_id)?.name || 'Physics';
    const cName = (q as any).chapter || getChapters().find(c => c.id === q.chapter_id)?.name || 'General';

    const qa = getQuestionAnswerMonitor(q.id);
    const isCorrect = typeof (pq.first_answer as any) === 'object' && (pq.first_answer as any)?.is_correct !== undefined
      ? Boolean((pq.first_answer as any).is_correct)
      : (pq.last_result ?? (qa && pq.first_answer ? pq.first_answer === qa.correct_answer : false));

    qualifyingFirstAnswers.push({
      questionId: q.id,
      subject: sName,
      chapter: cName,
      difficulty: q.difficulty,
      isCorrect,
      source: pq.first_answer_source || 'practice',
    });

    chapterPracticedSet.add(cName);
  });

  const qualifyingCount = qualifyingFirstAnswers.length;
  const chaptersCount = chapterPracticedSet.size;
  const practiceFirstCount = qualifyingFirstAnswers.filter(fa => fa.source === 'practice').length;
  const examFreshCount = qualifyingFirstAnswers.filter(fa => fa.source === 'exam').length;

  const settings = getSettings();
  const examAdj = settings.exam_conditions_adjustment_enabled
    ? computeExamConditionsAdjustment(studentId)
    : null;
  const adjDelta = (examAdj && examAdj.eligible) ? examAdj.adjustment_delta : 0;

  let dataNote = `Total qualifying first answers: ${qualifyingCount} (Practice: ${practiceFirstCount}, Exam fresh: ${examFreshCount})`;
  if (adjDelta !== 0) {
    dataNote += ` [Exam-conditions adjustment of ${(adjDelta * 100).toFixed(1)}% applied]`;
  }

  // Get syllabus chapters and weightages
  const weightages = getChapterWeightages();
  const totalSyllabusChapters = weightages.length || 30;
  const coveragePercentage = Number(((chaptersCount / totalSyllabusChapters) * 100).toFixed(1));

  // 3. Minimum Data Gate Check
  if (qualifyingCount < minQuestionsThreshold || chaptersCount < minChaptersThreshold) {
    const insufficientSnapshot = saveEstimateSnapshot({
      student_id: studentId,
      target_id: targetId,
      as_of,
      qualifying_questions_count: qualifyingCount,
      qualifying_chapters_count: chaptersCount,
      coverage_percentage: coveragePercentage,
      p10_percentile: null,
      p50_percentile: null,
      p90_percentile: null,
      chance_probability_rounded: null,
      model_metadata: {
        status: 'insufficient_data',
        message: `Needs at least ${minQuestionsThreshold} first answers across ${minChaptersThreshold} chapters. Currently: ${qualifyingCount} questions across ${chaptersCount} chapters.`,
        practice_first_answers_count: practiceFirstCount,
        exam_fresh_answers_count: examFreshCount,
        exam_conditions_adjustment_applied: adjDelta !== 0,
        exam_conditions_adjustment_delta: adjDelta,
        data_note: dataNote,
      },
    });

    const insufficientStudentEst = saveStudentEstimate({
      student_id: studentId,
      target_id: targetId,
      display_mode: displayMode,
      projected_range_low: null,
      projected_range_high: null,
      coarse_band: 'Not enough data yet',
      as_of,
    });

    return {
      status: 'insufficient_data',
      qualifyingCount,
      chaptersCount,
      coveragePercentage,
      p10: null,
      p50: null,
      p90: null,
      probabilityRounded: null,
      coarseBand: 'Not enough data yet',
      snapshot: insufficientSnapshot,
      studentEstimate: insufficientStudentEst,
    };
  }

  // 4. Calculate Subject-Pooled Priors and Chapter Posteriors
  const subjects = ['Physics', 'Chemistry', 'Mathematics'];
  const subjectStats: Record<string, { successWeight: number; failureWeight: number }> = {
    Physics: { successWeight: 0, failureWeight: 0 },
    Chemistry: { successWeight: 0, failureWeight: 0 },
    Mathematics: { successWeight: 0, failureWeight: 0 },
  };

  qualifyingFirstAnswers.forEach(fa => {
    const w = getDifficultyWeight(fa.difficulty);
    if (subjectStats[fa.subject]) {
      if (fa.isCorrect) subjectStats[fa.subject].successWeight += w;
      else subjectStats[fa.subject].failureWeight += w;
    }
  });

  // Weak prior Beta(1,1) per chapter
  const posteriors: ChapterPosterior[] = [];
  weightages.forEach(cw => {
    const chapterAnswers = qualifyingFirstAnswers.filter(fa => fa.chapter === cw.chapter && fa.subject === cw.subject);
    let s = 0;
    let f = 0;
    chapterAnswers.forEach(ca => {
      const w = getDifficultyWeight(ca.difficulty);
      if (ca.isCorrect) s += w;
      else f += w;
    });

    // Uniform prior Alpha0 = 1, Beta0 = 1
    let alpha = 1 + s;
    let beta = 1 + f;

    // Shrinkage towards subject-pooled rate if chapter has < 5 answers
    if (chapterAnswers.length < 5) {
      const pool = subjectStats[cw.subject];
      if (pool && (pool.successWeight + pool.failureWeight > 0)) {
        const poolAlpha = 1 + (pool.successWeight / 10);
        const poolBeta = 1 + (pool.failureWeight / 10);
        alpha = (alpha + poolAlpha) / 2;
        beta = (beta + poolBeta) / 2;
      }
    }

    posteriors.push({
      subject: cw.subject,
      chapter: cw.chapter,
      alpha,
      beta,
      practicedCount: chapterAnswers.length,
      weight: cw.expected_questions,
    });
  });

  // 5. Monte Carlo Simulation (10,000 draws)
  const rand = createMulberry32(seed);
  const simulatedPercentiles: number[] = new Array(draws);
  let targetExceededCount = 0;
  const T = targetPercentile ?? 99.0;

  for (let m = 0; m < draws; m++) {
    let expectedCorrect = 0;
    let expectedIncorrect = 0;

    for (let c = 0; c < posteriors.length; c++) {
      const post = posteriors[c];
      const rawTheta = sampleBeta(post.alpha, post.beta, rand); // sampled mastery in [0, 1]
      const theta = adjDelta !== 0
        ? Math.max(0.01, Math.min(0.99, rawTheta + adjDelta))
        : rawTheta;
      expectedCorrect += post.weight * theta;
      expectedIncorrect += post.weight * (1 - theta);
    }

    // JEE Main scoring: +4 for correct, -1 for incorrect
    const rawScore = 4 * expectedCorrect - 1 * expectedIncorrect;
    const clampedScore = Math.max(0, Math.min(300, rawScore));

    // Convert score to percentile using reference map
    const pct = interpolatePercentile(mapId, clampedScore) ?? 0;
    simulatedPercentiles[m] = pct;

    if (pct >= T) {
      targetExceededCount++;
    }
  }

  // 6. Aggregate Output Statistics
  simulatedPercentiles.sort((a, b) => a - b);
  const p10 = Number(simulatedPercentiles[Math.floor(draws * 0.10)].toFixed(2));
  const p50 = Number(simulatedPercentiles[Math.floor(draws * 0.50)].toFixed(2));
  const p90 = Number(simulatedPercentiles[Math.floor(draws * 0.90)].toFixed(2));

  // Probability rounded to nearest 5% (0.00, 0.05, 0.10, ..., 1.00)
  const rawProb = targetExceededCount / draws;
  const probabilityRounded = Number((Math.round(rawProb * 20) / 20).toFixed(2));

  // Coarse Band assignment
  let coarseBand: CoarseBand = 'Medium';
  if (probabilityRounded < 0.40) coarseBand = 'Low';
  else if (probabilityRounded > 0.70) coarseBand = 'High';

  // 7. Save to separate tables
  // Monitor snapshot (full internals)
  const snapshot = saveEstimateSnapshot({
    student_id: studentId,
    target_id: targetId,
    as_of,
    qualifying_questions_count: qualifyingCount,
    qualifying_chapters_count: chaptersCount,
    coverage_percentage: coveragePercentage,
    p10_percentile: p10,
    p50_percentile: p50,
    p90_percentile: p90,
    chance_probability_rounded: probabilityRounded,
    model_metadata: {
      status: 'sufficient',
      target_percentile: T,
      draws_count: draws,
      coverage_percentage: coveragePercentage,
      practice_first_answers_count: practiceFirstCount,
      exam_fresh_answers_count: examFreshCount,
      exam_conditions_adjustment_applied: adjDelta !== 0,
      exam_conditions_adjustment_delta: adjDelta,
      data_note: dataNote,
      chapter_posteriors: posteriors.reduce((acc, p) => {
        acc[p.chapter] = { alpha: Number(p.alpha.toFixed(2)), beta: Number(p.beta.toFixed(2)), expected_questions: p.weight };
        return acc;
      }, {} as Record<string, any>),
    },
  });

  // Student estimate (projection: range or band only)
  const studentEstimate = saveStudentEstimate({
    student_id: studentId,
    target_id: targetId,
    display_mode: displayMode,
    projected_range_low: p10,
    projected_range_high: p90,
    coarse_band: coarseBand,
    as_of,
  });

  return {
    status: 'sufficient',
    qualifyingCount,
    chaptersCount,
    coveragePercentage,
    p10,
    p50,
    p90,
    probabilityRounded,
    coarseBand,
    snapshot,
    studentEstimate,
  };
}
