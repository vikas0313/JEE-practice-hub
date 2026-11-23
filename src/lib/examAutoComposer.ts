// ============================================================
// Enhancement E7: Auto-Compose Exam Draft & Study Planner Engine
// Strictly Monitor-Only draft generation based on official NTA distribution.
// Respects Zero-Student-Email policy, drafts remain hidden until published.
// ============================================================

import {
  Question,
  Subject,
  Chapter,
  Exam,
  ExamQuestion,
  AutoComposeCriteria,
  AutoComposeResult,
  StudyPlan,
  PracticedQuestion,
} from './types';
import { v4 as uuid } from 'uuid';

/**
 * Auto-compose an exam draft according to official JEE Main distribution:
 * - 3 subjects (Physics, Chemistry, Mathematics).
 * - Default 25 questions per subject (20 MCQ Section A + 5 NVQ Section B).
 * - Generates draft status, ensuring student visibility is strictly 0 until explicitly published.
 */
export function autoComposeExamDraft(
  criteria: AutoComposeCriteria,
  allQuestions: Question[],
  subjects: Subject[],
  chapters: Chapter[]
): AutoComposeResult {
  const examId = uuid();
  const unfulfilled_notices: string[] = [];
  const selectedExamQuestions: ExamQuestion[] = [];

  const questionsPerSubject = criteria.questions_per_subject ?? 25;
  const targetMcqCount = Math.min(20, questionsPerSubject);
  const targetNvqCount = questionsPerSubject - targetMcqCount;

  // Filter usable questions (active only)
  const usable = allQuestions.filter((q) => q.is_active !== false);

  let globalOrderIndex = 1;

  for (const subj of subjects) {
    const subjQuestions = usable.filter((q) => q.subject_id === subj.id);

    // MCQs (Section A)
    const mcqs = subjQuestions.filter((q) => q.type === 'MCQ');
    // NVQs (Section B)
    const nvqs = subjQuestions.filter((q) => q.type === 'NVQ');

    const chosenMcqs = mcqs.slice(0, targetMcqCount);
    const chosenNvqs = nvqs.slice(0, targetNvqCount);

    if (chosenMcqs.length < targetMcqCount) {
      unfulfilled_notices.push(
        `${subj.name} Section A (MCQ): Found ${chosenMcqs.length} of ${targetMcqCount} requested questions.`
      );
    }

    if (chosenNvqs.length < targetNvqCount) {
      unfulfilled_notices.push(
        `${subj.name} Section B (NVQ): Found ${chosenNvqs.length} of ${targetNvqCount} requested questions.`
      );
    }

    for (const q of chosenMcqs) {
      selectedExamQuestions.push({
        id: uuid(),
        exam_id: examId,
        question_id: q.id,
        subject_id: subj.id,
        chapter_id: q.chapter_id,
        section: 'A',
        order_index: globalOrderIndex++,
        created_at: new Date().toISOString(),
      });
    }

    for (const q of chosenNvqs) {
      selectedExamQuestions.push({
        id: uuid(),
        exam_id: examId,
        question_id: q.id,
        subject_id: subj.id,
        chapter_id: q.chapter_id,
        section: 'B',
        order_index: globalOrderIndex++,
        created_at: new Date().toISOString(),
      });
    }
  }

  const totalQuestions = selectedExamQuestions.length;
  const maxMarks = totalQuestions * 4;

  const exam: Exam = {
    id: examId,
    name: criteria.exam_name,
    pattern_profile_id: criteria.pattern_profile_id || null,
    duration_minutes: criteria.duration_minutes ?? 180,
    grace_period_seconds: 60,
    start_window_start: null,
    start_window_end: null,
    status: 'draft', // Strictly draft mode, hidden from student until published
    is_template: false,
    copy_of_id: null,
    marks_correct_mcq: 4,
    marks_wrong_mcq: -1,
    marks_correct_nvq: 4,
    marks_wrong_nvq: -1,
    marks_unattempted: 0,
    total_questions: totalQuestions,
    max_marks: maxMarks,
    allow_fresh_questions: criteria.allow_fresh_questions ?? false,
    fresh_question_share_pct: criteria.fresh_question_share_pct ?? 0,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    exam,
    exam_questions: selectedExamQuestions,
    unfulfilled_notices,
  };
}

/**
 * Recalculate study plan progress from student's practiced questions.
 */
export function computeStudyPlanProgress(
  plan: StudyPlan,
  practicedQuestions: PracticedQuestion[],
  allQuestions: Question[]
): StudyPlan {
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  const chapterAttemptCounts = new Map<string, number>();

  for (const pq of practicedQuestions) {
    const q = qMap.get(pq.question_id);
    if (q) {
      const prev = chapterAttemptCounts.get(q.chapter_id) || 0;
      chapterAttemptCounts.set(q.chapter_id, prev + (pq.practice_attempts || 1));
    }
  }

  const updatedWeeklyTargets = plan.weekly_targets.map((wt) => {
    const completed = chapterAttemptCounts.get(wt.chapter_id) || 0;
    return {
      ...wt,
      completed_questions: completed,
    };
  });

  return {
    ...plan,
    weekly_targets: updatedWeeklyTargets,
    updated_at: new Date().toISOString(),
  };
}

