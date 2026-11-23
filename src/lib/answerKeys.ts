// ============================================================
// Phase 4: Official Answer Key Ingestion, ID Mapping & Re-Scoring
// ============================================================
// Scope Items 14, 15, and 16 & SRD Section 6
// - Maps NTA internal Question & Option IDs to serials & options (A, B, C, D)
// - Handles 'Dropped', 'Bonus', and Multiple correct answers
// - Re-scores past Practice and Exam attempts upon key change
// - Stamps re_scored_at and shows student one plain message:
//   "Marks updated because the official answer key changed."

import { v4 as uuid } from 'uuid';
import {
  getTable,
  updateRow,
  insertRow,
  insertAuditLog,
  createAlert,
  getAllQuestions,
  getAllQuestionAnswers,
  getPatternProfile,
  getPaper,
} from './db';
import type {
  Question,
  QuestionAnswer,
  Attempt,
  Response,
  RevisionItem,
  Paper,
} from './types';

export interface NtaRawKeyEntry {
  question_id: string; // e.g. "7095061234"
  question_number?: number;
  option_ids?: string[]; // e.g. ["7095064567", "7095064568", "7095064569", "7095064570"]
  correct_option_id: string; // e.g. "7095064569" or "Dropped" or "Bonus"
  notice_reference?: string; // e.g. "NTA Final Answer Key Notice 12-Apr-2026"
}

export interface KeyVersionRecord {
  id: string;
  paper_id: string;
  version_number: number;
  key_status: 'provisional' | 'final' | 'correction';
  notice_reference: string;
  changes_summary: Array<{
    question_number: number;
    old_answer: string;
    new_answer: string;
    status: string;
  }>;
  re_scored_at: string;
  re_scored_by: string;
  created_at: string;
}

/**
 * Resolves NTA internal ID key entry into standard choice ('A', 'B', 'C', 'D' or numerical)
 */
export function resolveNtaKey(entry: NtaRawKeyEntry): { answer: string; status: 'Normal' | 'Dropped' | 'Bonus' | 'Multiple correct' } {
  const rawCorrect = entry.correct_option_id.trim();

  // Special NTA designations
  if (rawCorrect.toLowerCase() === 'dropped' || rawCorrect.toLowerCase() === 'drop') {
    return { answer: 'Dropped', status: 'Dropped' };
  }
  if (rawCorrect.toLowerCase() === 'bonus') {
    return { answer: 'Bonus', status: 'Bonus' };
  }

  // If question has option IDs, map by ascending order (Option 1 -> A, Option 2 -> B, etc.)
  if (entry.option_ids && entry.option_ids.length === 4) {
    const sortedOptionIds = [...entry.option_ids].sort();
    const letters = ['A', 'B', 'C', 'D'];

    // Multiple correct (e.g. comma-separated)
    if (rawCorrect.includes(',')) {
      const parts = rawCorrect.split(',').map(s => s.trim());
      const choices = parts.map(p => {
        const idx = sortedOptionIds.indexOf(p);
        return idx !== -1 ? letters[idx] : p;
      });
      return { answer: choices.join(', '), status: 'Multiple correct' };
    }

    const idx = sortedOptionIds.indexOf(rawCorrect);
    if (idx !== -1) {
      return { answer: letters[idx], status: 'Normal' };
    }
  }

  // If already a letter or numerical string
  if (['A', 'B', 'C', 'D'].includes(rawCorrect.toUpperCase())) {
    return { answer: rawCorrect.toUpperCase(), status: 'Normal' };
  }

  return { answer: rawCorrect, status: 'Normal' };
}

export interface ReScoreResult {
  key_version_id: string;
  affected_attempts_count: number;
  affected_responses_count: number;
  changes_applied: number;
  re_scored_at: string;
}

/**
 * Applies a new answer key version to a paper and re-scores affected attempts
 */
export function applyAnswerKeyVersion(
  paperId: string,
  keyEntries: NtaRawKeyEntry[],
  versionData: {
    key_status: 'provisional' | 'final' | 'correction';
    notice_reference: string;
  },
  monitorId: string
): ReScoreResult {
  const paper = getPaper(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);

  const patternProfile = paper.pattern_profile_id ? getPatternProfile(paper.pattern_profile_id) : null;
  const marksCorrectMcq = patternProfile ? patternProfile.marks_correct_mcq : 4;
  const marksWrongMcq = patternProfile ? patternProfile.marks_wrong_mcq : -1;
  const marksCorrectNvq = patternProfile ? patternProfile.marks_correct_nvq : 4;
  const marksWrongNvq = patternProfile ? patternProfile.marks_wrong_nvq : 0;

  const now = new Date().toISOString();
  const existingKeyVersions = getTable<KeyVersionRecord>('key_versions').filter(k => k.paper_id === paperId);
  const nextVersionNumber = existingKeyVersions.length + 1;

  const questions = getAllQuestions().filter(q => q.paper_id === paperId);
  const answers = getAllQuestionAnswers();
  const changes_summary: KeyVersionRecord['changes_summary'] = [];

  // 1. Update questions and question_answers
  for (const entry of keyEntries) {
    const qNum = entry.question_number;
    const q = questions.find(item => item.number === qNum);
    if (!q) continue;

    const resolved = resolveNtaKey(entry);
    const qa = answers.find(a => a.question_id === q.id);

    if (qa && qa.correct_answer !== resolved.answer) {
      changes_summary.push({
        question_number: q.number,
        old_answer: qa.correct_answer,
        new_answer: resolved.answer,
        status: resolved.status,
      });

      updateRow<QuestionAnswer>('question_answers', qa.id, {
        correct_answer: resolved.answer,
        answer_status: resolved.status,
      });

      updateRow<Question>('questions', q.id, {
        answer_status: resolved.status,
        updated_at: now,
      });
    }
  }

  // 2. Re-score responses & attempts
  const allResponses = getTable<Response>('responses');
  const allAttempts = getTable<Attempt>('attempts');
  const qIds = new Set(questions.map(q => q.id));

  const affectedAttempts = new Set<string>();
  let affectedResponsesCount = 0;

  for (const r of allResponses) {
    if (!qIds.has(r.question_id) || r.submitted_at === null) continue;

    const q = questions.find(item => item.id === r.question_id)!;
    const qa = getAllQuestionAnswers().find(a => a.question_id === q.id);
    if (!qa) continue;

    const oldCorrect = r.is_correct;
    let newCorrect = false;
    let newMarks = 0;

    if (qa.answer_status === 'Dropped' || qa.answer_status === 'Bonus') {
      newCorrect = true;
      newMarks = q.type === 'MCQ' ? marksCorrectMcq : marksCorrectNvq;
    } else if (qa.answer_status === 'Multiple correct') {
      const allowed = qa.correct_answer.split(',').map(s => s.trim().toUpperCase());
      newCorrect = r.answer ? allowed.includes(r.answer.toUpperCase()) : false;
      newMarks = newCorrect
        ? (q.type === 'MCQ' ? marksCorrectMcq : marksCorrectNvq)
        : (r.answer ? (q.type === 'MCQ' ? marksWrongMcq : marksWrongNvq) : 0);
    } else {
      newCorrect = r.answer !== null && r.answer.trim().toUpperCase() === qa.correct_answer.trim().toUpperCase();
      newMarks = newCorrect
        ? (q.type === 'MCQ' ? marksCorrectMcq : marksCorrectNvq)
        : (r.answer ? (q.type === 'MCQ' ? marksWrongMcq : marksWrongNvq) : 0);
    }

    if (oldCorrect !== newCorrect || r.marks !== newMarks) {
      updateRow<Response>('responses', r.id, {
        is_correct: newCorrect,
        marks: newMarks,
        updated_at: now,
      });
      affectedResponsesCount++;
      affectedAttempts.add(r.attempt_id);

      // Refresh Mistake Notebook (Item 15)
      const mistakes = getTable<RevisionItem>('revision_items');
      const existingMistake = mistakes.find(m => m.student_id === r.student_id && m.question_id === r.question_id);
      if (newCorrect && existingMistake) {
        // Cleared because key updated to correct
        updateRow<RevisionItem>('revision_items', existingMistake.id, { cleared: true });
      } else if (!newCorrect && !existingMistake) {
        // Newly incorrect -> add to Stage 1
        const due = new Date();
        due.setDate(due.getDate() + 3);
        insertRow<RevisionItem>('revision_items', {
          id: uuid(),
          student_id: r.student_id,
          question_id: r.question_id,
          stage: 1,
          due_at: due.toISOString(),
          cleared: false,
          added_reason: 'wrong_answer',
          last_attempt_at: now,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  // 3. Update total scores on affected attempts
  for (const attemptId of affectedAttempts) {
    const attempt = allAttempts.find(a => a.id === attemptId);
    if (!attempt) continue;

    const attemptResponses = getTable<Response>('responses').filter(r => r.attempt_id === attemptId);
    const newTotalScore = attemptResponses.reduce((sum, r) => sum + (r.marks || 0), 0);

    updateRow<Attempt>('attempts', attemptId, {
      ...(attempt as any),
      score: newTotalScore,
      // Stamp re_scored_at and student notification note (Item 15)
      re_scored_at: now,
      re_score_notice: 'Marks updated because the official answer key changed.',
    });
  }

  // 4. Record Key Version record
  const keyVersionId = uuid();
  const keyRecord: KeyVersionRecord = {
    id: keyVersionId,
    paper_id: paperId,
    version_number: nextVersionNumber,
    key_status: versionData.key_status,
    notice_reference: versionData.notice_reference,
    changes_summary,
    re_scored_at: now,
    re_scored_by: monitorId,
    created_at: now,
  };
  insertRow('key_versions', keyRecord);

  // 5. Update Paper key status
  updateRow<Paper>('papers', paperId, {
    key_status: versionData.key_status === 'final' ? 'final' : 'provisional',
    key_source: 'NTA final',
  });

  // 6. Audit log & In-app monitor alert (Item 15)
  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'key_rescore_applied',
    entity_type: 'paper',
    entity_id: paperId,
    details: {
      key_version_id: keyVersionId,
      version_number: nextVersionNumber,
      notice_reference: versionData.notice_reference,
      changes_count: changes_summary.length,
      affected_attempts: affectedAttempts.size,
      affected_responses: affectedResponsesCount,
    },
    created_at: now,
  });

  const student = getTable<{ id: string }>('profiles').find(p => (p as any).role === 'student');
  createAlert({
    student_id: student ? student.id : 'student',
    alert_type: 'answer_key_changed',
    severity: 'warning',
    dedupe_key: `key_update_${paperId}_${nextVersionNumber}`,
    title: 'Answer Key Updated & Re-Scored',
    message: `Answer key for ${paper.exam} ${paper.year} (${paper.shift}) updated to v${nextVersionNumber} (${versionData.key_status}). Re-scored ${affectedAttempts.size} attempts with notice: "${versionData.notice_reference}".`,
    status: 'active',
    metadata: { paper_id: paperId, version: nextVersionNumber, affected_attempts: affectedAttempts.size },
  });

  return {
    key_version_id: keyVersionId,
    affected_attempts_count: affectedAttempts.size,
    affected_responses_count: affectedResponsesCount,
    changes_applied: changes_summary.length,
    re_scored_at: now,
  };
}
