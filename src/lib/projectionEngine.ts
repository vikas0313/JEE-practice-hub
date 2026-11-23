import {
  getTarget,
  getEstimateSnapshots,
  getPracticedQuestions,
  getAllQuestions,
  getChapters,
  getSubjects,
  getTopics,
  getAllVisits,
  getResponsesByStudent,
  getAttemptsByStudent,
  getSettings,
  getChapterWeightages,
  getPatternProfiles,
} from './db';
import {
  ShrinkageProjectionResult,
  ShrinkageProjectionPoint,
  ExamConditionsAdjustmentResult,
  AssignmentSuggestion,
  EstimateSnapshot,
} from './types';

export const PROJECTION_DISCLAIMER =
  'Illustrative projection based on current trajectory under the assumption of consistent practice. Not a guarantee.';

/**
 * Phase 6 M7: Retrieves all estimate snapshots for a specific target, ordered chronologically.
 */
export function getEstimateSnapshotsForTarget(
  studentId: string,
  targetId: string
): EstimateSnapshot[] {
  return getEstimateSnapshots(studentId)
    .filter(s => s.target_id === targetId)
    .sort((a, b) => new Date(a.as_of || a.created_at).getTime() - new Date(b.as_of || b.created_at).getTime());
}

/**
 * Phase 6 M7: Bayesian Shrinkage Projection Engine
 * Model: P_hat(t) = P_current + delta_t * beta_shrunk +/- 1.96 * SE(t)
 * Shrinkage factor: lambda = N / (N + K), K default 50
 *
 * Strict Minimum Gates:
 * - >= 4 weeks (28 days) of practice history
 * - >= 200 qualifying first answers
 * - >= 10 distinct chapters practiced
 */
export function computeShrinkageProjection(options: {
  studentId: string;
  targetId: string;
  shrinkagePriorK?: number;
}): ShrinkageProjectionResult {
  const { studentId, targetId, shrinkagePriorK = 50 } = options;
  const target = getTarget(targetId);
  const now = new Date();

  // 1. Gather qualifying first answers and timestamps
  const practiced = getPracticedQuestions(studentId).filter(
    pq => pq.first_answer !== null && pq.first_practiced_at !== null
  );
  const questions = getAllQuestions();
  const qMap = new Map(questions.map(q => [q.id, q]));

  let earliestTime = now.getTime();
  let latestTime = 0;
  const chapterSet = new Set<string>();

  practiced.forEach(pq => {
    const q = qMap.get(pq.question_id);
    if (!q) return;
    if (q.chapter_id) chapterSet.add(q.chapter_id);

    const t = new Date(pq.first_practiced_at!).getTime();
    if (t < earliestTime) earliestTime = t;
    if (t > latestTime) latestTime = t;
  });

  const currentFirstAnswers = practiced.length;
  const chaptersCovered = chapterSet.size;
  const elapsedDays = practiced.length > 0 ? (latestTime - earliestTime) / (1000 * 3600 * 24) : 0;
  const currentWeeks = Number((elapsedDays / 7).toFixed(1));

  const REQUIRED_WEEKS = 4;
  const REQUIRED_FIRST_ANSWERS = 200;
  const REQUIRED_CHAPTERS = 10;

  // Check Gate Conditions
  const meetsWeeks = elapsedDays >= 28;
  const meetsAnswers = currentFirstAnswers >= REQUIRED_FIRST_ANSWERS;
  const meetsChapters = chaptersCovered >= REQUIRED_CHAPTERS;

  if (!meetsWeeks || !meetsAnswers || !meetsChapters) {
    const missing: string[] = [];
    if (!meetsWeeks) missing.push(`at least 4 weeks of practice history (currently ${currentWeeks} weeks)`);
    if (!meetsAnswers) missing.push(`200 qualifying first answers (currently ${currentFirstAnswers})`);
    if (!meetsChapters) missing.push(`10 chapters covered (currently ${chaptersCovered})`);

    return {
      status: 'insufficient_history',
      current_weeks: currentWeeks,
      required_weeks: REQUIRED_WEEKS,
      current_first_answers: currentFirstAnswers,
      required_first_answers: REQUIRED_FIRST_ANSWERS,
      chapters_covered: chaptersCovered,
      required_chapters: REQUIRED_CHAPTERS,
      message: `Projection requires ${missing.join(', ')}.`,
      disclaimer: PROJECTION_DISCLAIMER,
    };
  }

  // 2. Fetch history of estimate snapshots
  const snapshots = getEstimateSnapshotsForTarget(studentId, targetId);
  const validSnapshots = snapshots.filter(s => s.chance_probability_rounded !== null);

  let currentChance = 50;
  if (validSnapshots.length > 0) {
    currentChance = (validSnapshots[validSnapshots.length - 1].chance_probability_rounded || 0.5) * 100;
  }

  // 3. Compute OLS slope on snapshot history or weekly progress
  const points: Array<{ xWeeks: number; yPct: number }> = [];
  if (validSnapshots.length >= 2) {
    const t0 = new Date(validSnapshots[0].as_of || validSnapshots[0].created_at).getTime();
    validSnapshots.forEach(s => {
      const dtWeeks = (new Date(s.as_of || s.created_at).getTime() - t0) / (1000 * 3600 * 24 * 7);
      points.push({ xWeeks: dtWeeks, yPct: (s.chance_probability_rounded || 0.5) * 100 });
    });
  } else {
    // If fewer than 2 snapshots exist, simulate slope from practice progress
    points.push({ xWeeks: 0, yPct: Math.max(10, currentChance - 10) });
    points.push({ xWeeks: currentWeeks, yPct: currentChance });
  }

  const N = points.length;
  const meanX = points.reduce((acc, p) => acc + p.xWeeks, 0) / N;
  const meanY = points.reduce((acc, p) => acc + p.yPct, 0) / N;

  let num = 0;
  let den = 0;
  points.forEach(p => {
    num += (p.xWeeks - meanX) * (p.yPct - meanY);
    den += Math.pow(p.xWeeks - meanX, 2);
  });

  const olsSlope = den !== 0 ? num / den : 0;

  // 4. Shrinkage regularization: lambda = N / (N + K)
  const shrinkageFactor = N / (N + shrinkagePriorK);
  const shrunkSlope = olsSlope * shrinkageFactor;

  // Residual variance estimation for standard error
  let residualSumSq = 0;
  points.forEach(p => {
    const yHat = meanY + olsSlope * (p.xWeeks - meanX);
    residualSumSq += Math.pow(p.yPct - yHat, 2);
  });
  const sResidual = Math.sqrt(residualSumSq / Math.max(1, N - 2)) || 2.5;

  // 5. Target exam date extrapolation
  const targetDateStr = target?.exam_date || new Date(now.getTime() + 12 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const targetDateTime = new Date(targetDateStr).getTime();
  const weeksToExam = Math.max(1, Math.min(26, (targetDateTime - now.getTime()) / (1000 * 3600 * 24 * 7)));

  const projectedExamChance = Math.min(99, Math.max(1, currentChance + shrunkSlope * weeksToExam));
  const seAtExam = sResidual * Math.sqrt(1 + 1 / N + (den !== 0 ? Math.pow(weeksToExam, 2) / den : 0.1));
  const ciLower = Math.max(0, Number((projectedExamChance - 1.96 * seAtExam).toFixed(1)));
  const ciUpper = Math.min(100, Number((projectedExamChance + 1.96 * seAtExam).toFixed(1)));

  // Generate trajectory points for UI chart (weekly steps up to target exam date)
  const trajectoryPoints: ShrinkageProjectionPoint[] = [];
  const totalWeeks = Math.ceil(weeksToExam);
  for (let w = 1; w <= totalWeeks; w++) {
    const ptDate = new Date(now.getTime() + w * 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const ptProjected = Math.min(99, Math.max(1, currentChance + shrunkSlope * w));
    const ptSe = sResidual * Math.sqrt(1 + 1 / N + (den !== 0 ? Math.pow(w, 2) / den : 0.1));
    trajectoryPoints.push({
      week: w,
      date: ptDate,
      projected_pct: Number(ptProjected.toFixed(1)),
      ci_lower_pct: Math.max(0, Number((ptProjected - 1.96 * ptSe).toFixed(1))),
      ci_upper_pct: Math.min(100, Number((ptProjected + 1.96 * ptSe).toFixed(1))),
    });
  }

  return {
    status: 'sufficient',
    current_weeks: currentWeeks,
    required_weeks: REQUIRED_WEEKS,
    current_first_answers: currentFirstAnswers,
    required_first_answers: REQUIRED_FIRST_ANSWERS,
    chapters_covered: chaptersCovered,
    required_chapters: REQUIRED_CHAPTERS,
    current_chance_pct: Number(currentChance.toFixed(1)),
    ols_slope_pct_per_week: Number(olsSlope.toFixed(2)),
    shrinkage_factor: Number(shrinkageFactor.toFixed(3)),
    shrunk_slope_pct_per_week: Number(shrunkSlope.toFixed(2)),
    target_exam_date: targetDateStr,
    projected_exam_chance_pct: Number(projectedExamChance.toFixed(1)),
    ci_lower_pct: ciLower,
    ci_upper_pct: ciUpper,
    trajectory_points: trajectoryPoints,
    disclaimer: PROJECTION_DISCLAIMER,
  };
}

/**
 * Phase 6 M7: Exam-Conditions Adjustment Calculator
 * Formula: Adjustment = Accuracy(fresh, exam) - Accuracy(practice)
 * Gate: Requires >= 100 timed fresh exam answers.
 */
export function computeExamConditionsAdjustment(studentId: string): ExamConditionsAdjustmentResult {
  const REQUIRED_COUNT = 100;

  // 1. Fetch all fresh responses submitted during exams
  // Must be from completed exams (ended_at !== null) where first_answer_source was 'exam'
  const practiced = getPracticedQuestions(studentId);
  const examFreshQids = new Set(
    practiced.filter(pq => pq.first_answer_source === 'exam').map(pq => pq.question_id)
  );

  const completedAttempts = getAttemptsByStudent(studentId).filter(
    a => a.mode === 'exam' && a.ended_at !== null
  );
  const completedAttemptIds = new Set(completedAttempts.map(a => a.id));

  const allResponses = getResponsesByStudent(studentId);
  const timedFreshExamResponses = allResponses.filter(
    r =>
      completedAttemptIds.has(r.attempt_id) &&
      examFreshQids.has(r.question_id) &&
      r.submitted_at !== null &&
      r.answer !== null
  );

  const freshExamCount = timedFreshExamResponses.length;

  if (freshExamCount < REQUIRED_COUNT) {
    return {
      eligible: false,
      fresh_exam_answers_count: freshExamCount,
      required_count: REQUIRED_COUNT,
      adjustment_delta: 0,
      message: `Requires at least 100 timed fresh answers in exams (currently ${freshExamCount}/${REQUIRED_COUNT}).`,
    };
  }

  // 2. Compute Accuracy(fresh, exam)
  const examCorrect = timedFreshExamResponses.filter(r => r.is_correct === true).length;
  const examAccuracy = examCorrect / freshExamCount;

  // 3. Compute Accuracy(practice)
  const practiceFirstAnswers = practiced.filter(pq => pq.first_answer_source === 'practice');
  const practiceCorrect = practiceFirstAnswers.filter(pq => pq.last_result === true).length;
  const practiceTotal = Math.max(1, practiceFirstAnswers.length);
  const practiceAccuracy = practiceCorrect / practiceTotal;

  // 4. Delta Adjustment
  const delta = examAccuracy - practiceAccuracy;

  return {
    eligible: true,
    fresh_exam_answers_count: freshExamCount,
    required_count: REQUIRED_COUNT,
    exam_accuracy_pct: Math.round(examAccuracy * 100),
    practice_accuracy_pct: Math.round(practiceAccuracy * 100),
    adjustment_delta: Number(delta.toFixed(4)),
    message: `Exam-conditions adjustment: ${(delta * 100).toFixed(1)}% accuracy differential based on ${freshExamCount} timed fresh exam answers.`,
  };
}

/**
 * Phase 6 M7: Assignment Suggestions Generator
 * Recommends high-impact practice assignments based on:
 * 1. Weak chapters (< 60% accuracy on qualifying first answers with >= 5 attempts)
 * 2. Slow pacing (> 1.5x ideal time per question)
 * 3. High-weightage coverage gaps (unvisited topics in High weightage chapters)
 *
 * NOTE: Suggestions are purely advisory. They never auto-assign.
 */
export function generateAssignmentSuggestions(studentId: string): AssignmentSuggestion[] {
  const suggestions: AssignmentSuggestion[] = [];
  const practiced = getPracticedQuestions(studentId);
  const questions = getAllQuestions();
  const qMap = new Map(questions.map(q => [q.id, q]));
  const chapters = getChapters();
  const subjects = getSubjects();
  const topics = getTopics();
  const visits = getAllVisits().filter(v => v.student_id === studentId);
  const settings = getSettings();
  const patternProfiles = getPatternProfiles();
  const defaultPpId = patternProfiles[0]?.id;
  const weightages = defaultPpId ? getChapterWeightages(defaultPpId) : [];
  const highWeightageChapterNames = new Set(
    weightages.filter(w => w.expected_questions >= 2).map(w => w.chapter)
  );

  // Group practiced questions by chapter
  const chapterStats = new Map<string, { total: number; correct: number }>();
  practiced.forEach(pq => {
    const q = qMap.get(pq.question_id);
    if (!q || !q.chapter_id) return;
    const stats = chapterStats.get(q.chapter_id) || { total: 0, correct: 0 };
    stats.total += 1;
    if (pq.last_result === true) stats.correct += 1;
    chapterStats.set(q.chapter_id, stats);
  });

  // 1. Weak Chapters Detection
  chapterStats.forEach((stats, chapterId) => {
    if (stats.total >= 5) {
      const acc = stats.correct / stats.total;
      if (acc < 0.60) {
        const chap = chapters.find(c => c.id === chapterId);
        const subj = chap ? subjects.find(s => s.id === chap.subject_id) : null;
        suggestions.push({
          id: `sug-weak-${chapterId}`,
          type: 'weak_chapter',
          title: `Reinforce ${chap?.name || 'Chapter'} (${subj?.name || 'Subject'})`,
          description: `Qualifying first-attempt accuracy is ${(acc * 100).toFixed(0)}% across ${stats.total} questions. Targeted drill recommended.`,
          subject_id: chap?.subject_id || '',
          chapter_id: chapterId,
          recommended_question_count: 15,
          metric_summary: `${(acc * 100).toFixed(0)}% accuracy (${stats.correct}/${stats.total})`,
        });
      }
    }
  });

  const responses = getResponsesByStudent(studentId);
  const respMap = new Map(responses.map(r => [r.id, r]));

  // 2. Slow Pacing Detection
  const chapterTimes = new Map<string, { totalSec: number; count: number }>();
  visits.forEach(v => {
    const qid = respMap.get(v.response_id)?.question_id;
    if (!qid) return;
    const q = qMap.get(qid);
    if (!q || !q.chapter_id || !v.active_seconds) return;
    const item = chapterTimes.get(q.chapter_id) || { totalSec: 0, count: 0 };
    item.totalSec += v.active_seconds;
    item.count += 1;
    chapterTimes.set(q.chapter_id, item);
  });

  chapterTimes.forEach((item, chapterId) => {
    if (item.count >= 5) {
      const avgSec = item.totalSec / item.count;
      const idealSec = settings.ideal_time_medium || 120;
      if (avgSec > idealSec * 1.5) {
        const chap = chapters.find(c => c.id === chapterId);
        const subj = chap ? subjects.find(s => s.id === chap.subject_id) : null;
        suggestions.push({
          id: `sug-slow-${chapterId}`,
          type: 'slow_pacing',
          title: `Speed Drill: ${chap?.name || 'Chapter'}`,
          description: `Average active time is ${Math.round(avgSec)}s per question (ideal: ${idealSec}s). Focused timed set will build pacing rhythm.`,
          subject_id: chap?.subject_id || '',
          chapter_id: chapterId,
          recommended_question_count: 10,
          metric_summary: `Avg time ${Math.round(avgSec)}s vs ${idealSec}s ideal`,
        });
      }
    }
  });

  // 3. High-Weightage Unvisited Topics
  const visitedTopicIds = new Set(
    practiced.map(pq => qMap.get(pq.question_id)?.topic_id).filter(Boolean) as string[]
  );

  topics.forEach(t => {
    const chap = chapters.find(c => c.id === t.chapter_id);
    if (chap && highWeightageChapterNames.has(chap.name) && !visitedTopicIds.has(t.id)) {
      const chap = chapters.find(c => c.id === t.chapter_id);
      const subj = chap ? subjects.find(s => s.id === chap.subject_id) : null;
      if (suggestions.filter(s => s.type === 'unvisited_topic').length < 3) {
        suggestions.push({
          id: `sug-unvisited-${t.id}`,
          type: 'unvisited_topic',
          title: `Unvisited Topic: ${t.name}`,
          description: `High-weightage topic in ${chap?.name} has not yet been practiced. Start with a foundational 10-question set.`,
          subject_id: chap?.subject_id || '',
          chapter_id: t.chapter_id,
          topic_id: t.id,
          recommended_question_count: 10,
          metric_summary: 'High weightage • 0 attempts recorded',
        });
      }
    }
  });

  return suggestions;
}
