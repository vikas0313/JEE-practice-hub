// ============================================================
// JEE Practice Hub — Controlled Syllabus Import Validation Engine
// Enforces strict 3-tier resolution (Exact -> Alias -> Reject / Allow-Untagged)
// CRITICAL: Never creates chapters or topics silently during import!
// ============================================================

import { v4 as uuid } from 'uuid';
import type { PilotQuestionRecord, Question, QuestionAnswer, Solution } from './types';
import {
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  getSyllabusSubtopics,
  getSyllabusAliases,
  getAllQuestions,
  insertQuestion,
  updateQuestion,
  getAllQuestionAnswers,
  insertQuestionAnswer,
  getTable,
  insertRow,
  updateRow,
  findOrCreatePaper,
  findOrCreateSubject,
  findOrCreateChapter,
  findOrCreateTopic,
  insertAuditLog,
} from './db';
import { normalizeSyllabusName } from './syllabusSeed';

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolvedSubjectId?: string | null;
  resolvedChapterId?: string | null;
  resolvedTopicId?: string | null;
  resolvedSubtopicId?: string | null;
  isHidden: boolean;
}

export interface ValidationOptions {
  allowUntagged?: boolean;
}

/**
 * 3-Tier Resolution for Chapter:
 * 1. Exact normalized name or external_id match in syllabus_chapters
 * 2. Alias lookup in syllabus_aliases
 * 3. Not found (Null)
 */
export function resolveSyllabusChapter(subjectId: string, chapterQuery: string) {
  if (!chapterQuery || !chapterQuery.trim()) return null;

  const chapters = getSyllabusChapters().filter(c => c.subject_id === subjectId);
  const normQuery = normalizeSyllabusName(chapterQuery);

  // 1. Exact match by external_id or normalized name
  const exact = chapters.find(
    c => (c.external_id && c.external_id.toLowerCase() === chapterQuery.trim().toLowerCase()) ||
         normalizeSyllabusName(c.name) === normQuery
  );
  if (exact) {
    return { chapter: exact, matchedBy: 'exact' as const };
  }

  // 2. Alias lookup
  const aliases = getSyllabusAliases(subjectId);
  const aliasMatch = aliases.find(
    a => a.target_type === 'chapter' && normalizeSyllabusName(a.alias) === normQuery
  );
  if (aliasMatch) {
    const aliasChapter = chapters.find(c => c.id === aliasMatch.target_id);
    if (aliasChapter) {
      return { chapter: aliasChapter, matchedBy: 'alias' as const };
    }
  }

  return null;
}

/**
 * 3-Tier Resolution for Topic under a Chapter:
 * 1. Exact normalized name match in syllabus_topics
 * 2. Alias lookup in syllabus_aliases
 * 3. Not found (Null)
 */
export function resolveSyllabusTopic(chapterId: string, topicQuery: string) {
  if (!topicQuery || !topicQuery.trim()) return null;

  const topics = getSyllabusTopics(chapterId);
  const normQuery = normalizeSyllabusName(topicQuery);

  // 1. Exact match
  const exact = topics.find(t => normalizeSyllabusName(t.name) === normQuery);
  if (exact) {
    return { topic: exact, matchedBy: 'exact' as const };
  }

  // 2. Alias lookup
  const aliases = getTable<any>('syllabus_aliases');
  const aliasMatch = aliases.find(
    (a: any) => a.target_type === 'topic' && normalizeSyllabusName(a.alias) === normQuery
  );
  if (aliasMatch) {
    const aliasTopic = topics.find(t => t.id === aliasMatch.target_id);
    if (aliasTopic) {
      return { topic: aliasTopic, matchedBy: 'alias' as const };
    }
  }

  return null;
}

/**
 * Validates a single question record against the controlled syllabus.
 * Strict rules:
 * - Missing answer, empty text, or invalid question number -> Fatal error.
 * - Unknown subject -> Fatal error.
 * - Unknown chapter -> Error unless options.allowUntagged is true.
 * - Inactive chapter -> Warning + question hidden from student practice.
 * - Unknown topic -> Error unless options.allowUntagged is true.
 * - NEVER creates any chapters or topics silently.
 */
export function validateImportRecord(
  rec: PilotQuestionRecord,
  options?: ValidationOptions
): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isHidden = false;

  // Basic question checks
  if (!rec.number || typeof rec.number !== 'number' || rec.number <= 0) {
    errors.push('Invalid or missing question number');
  }
  if (!rec.correct_answer || typeof rec.correct_answer !== 'string' || rec.correct_answer.trim() === '') {
    errors.push(`Q${rec.number}: missing correct_answer`);
  }
  if (!rec.question_text || typeof rec.question_text !== 'string' || rec.question_text.trim() === '') {
    errors.push(`Q${rec.number}: empty question_text`);
  }
  if (rec.type === 'MCQ') {
    if (!rec.options || !Array.isArray(rec.options) || rec.options.length !== 4) {
      errors.push(`Q${rec.number}: MCQ must have exactly 4 options`);
    }
  }

  // 1. Resolve Subject
  const subjects = getSyllabusSubjects();
  const subName = rec.subject ? rec.subject.trim() : '';
  const sylSub = subjects.find(
    s => normalizeSyllabusName(s.name) === normalizeSyllabusName(subName)
  );

  if (!sylSub) {
    errors.push(`Q${rec.number}: Unknown subject "${rec.subject}". Must be Physics, Chemistry, or Mathematics.`);
    return { valid: false, errors, warnings, isHidden: true };
  }

  // 2. Resolve Chapter
  let resolvedChapterId: string | null = null;
  const chRes = resolveSyllabusChapter(sylSub.id, rec.chapter);

  if (chRes) {
    resolvedChapterId = chRes.chapter.id;
    // Check chapter active status & syllabus_status
    if (chRes.chapter.status === 'inactive' || chRes.chapter.syllabus_status === 'verify_current_syllabus') {
      warnings.push(
        `Q${rec.number}: Chapter "${chRes.chapter.name}" is inactive (${chRes.chapter.syllabus_status}). Question will be hidden from student practice.`
      );
      isHidden = true;
    }
  } else {
    if (options?.allowUntagged) {
      warnings.push(
        `Q${rec.number}: Chapter "${rec.chapter}" is unmapped. Imported as untagged and hidden from student practice.`
      );
      isHidden = true;
    } else {
      errors.push(
        `Q${rec.number}: Chapter "${rec.chapter}" does not match any controlled chapter or alias in ${sylSub.name}.`
      );
    }
  }

  // 3. Resolve Topic
  let resolvedTopicId: string | null = null;
  if (resolvedChapterId && rec.topic && rec.topic.trim()) {
    const topRes = resolveSyllabusTopic(resolvedChapterId, rec.topic);
    if (topRes) {
      resolvedTopicId = topRes.topic.id;
      if (topRes.topic.status === 'inactive') {
        warnings.push(`Q${rec.number}: Topic "${topRes.topic.name}" is inactive.`);
        isHidden = true;
      }
    } else {
      if (options?.allowUntagged) {
        warnings.push(
          `Q${rec.number}: Topic "${rec.topic}" not recognized under chapter. Left unassigned.`
        );
      } else {
        errors.push(
          `Q${rec.number}: Topic "${rec.topic}" does not exist in the controlled syllabus. Topics cannot be created silently during import.`
        );
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    resolvedSubjectId: sylSub.id,
    resolvedChapterId,
    resolvedTopicId,
    isHidden,
  };
}

export interface ControlledImportSummary {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validates and imports questions using the Controlled Syllabus engine.
 * Never creates silent chapters or topics.
 */
export function importControlledQuestions(
  records: PilotQuestionRecord[],
  options?: ValidationOptions
): ControlledImportSummary {
  const errors: string[] = [];
  const warnings: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    const res = validateImportRecord(rec, options);
    if (res.warnings.length > 0) {
      warnings.push(...res.warnings);
    }

    if (!res.valid) {
      errors.push(...res.errors);
      skipped++;
      continue;
    }

    // Provision legacy shadow rows if needed for backwards compatibility
    const legacySubject = findOrCreateSubject(rec.subject);
    const legacyChapter = findOrCreateChapter(legacySubject.id, rec.chapter);
    const legacyTopic = findOrCreateTopic(legacyChapter.id, rec.topic);
    const paper = findOrCreatePaper(rec.paper, rec.source, rec.answer_key_source);

    const now = new Date().toISOString();
    const existing = getAllQuestions().find(
      q => (rec.id && q.id === rec.id) || (q.paper_id === paper.id && q.number === rec.number)
    );

    if (existing) {
      updateQuestion(existing.id, {
        primary_chapter_id: res.resolvedChapterId ?? null,
        primary_topic_id: res.resolvedTopicId ?? null,
        is_active: !res.isHidden,
        question_text: rec.question_text,
        type: rec.type,
        section: rec.section,
        options: rec.options ?? null,
        figure_required: rec.figure_required,
        figure_status: rec.figure_status,
        difficulty: rec.difficulty,
        rating_source: rec.rating_source,
        weightage_tag: rec.weightage_tag ?? null,
        answer_status: rec.answer_status,
        updated_at: now,
      });

      const existingQa = getAllQuestionAnswers().find(qa => qa.question_id === existing.id);
      if (existingQa) {
        updateRow<QuestionAnswer>('question_answers', existingQa.id, {
          correct_answer: rec.correct_answer,
          answer_text: rec.answer_text ?? null,
          answer_status: rec.answer_status,
        });
      }

      updated++;
      insertAuditLog({
        id: uuid(),
        user_id: 'monitor',
        action: 'question_updated_controlled_syllabus',
        entity_type: 'question',
        entity_id: existing.id,
        details: { number: rec.number, paper_id: paper.id },
        created_at: now,
      });
    } else {
      const questionId = rec.id || uuid();
      const newQuestion: Question = {
        id: questionId,
        number: rec.number,
        paper_id: paper.id,
        subject_id: legacySubject.id,
        chapter_id: legacyChapter.id,
        topic_id: legacyTopic.id,
        subtopic: rec.subtopic ?? null,
        primary_chapter_id: res.resolvedChapterId ?? null,
        primary_topic_id: res.resolvedTopicId ?? null,
        type: rec.type,
        section: rec.section,
        question_text: rec.question_text,
        options: rec.options ?? null,
        figure_required: rec.figure_required,
        figure_status: rec.figure_status,
        difficulty: rec.difficulty,
        rating_source: rec.rating_source,
        weightage_tag: rec.weightage_tag ?? null,
        answer_status: rec.answer_status,
        is_active: !res.isHidden,
        created_at: now,
        updated_at: now,
      };
      insertQuestion(newQuestion);

      const qa: QuestionAnswer = {
        id: uuid(),
        question_id: questionId,
        correct_answer: rec.correct_answer,
        answer_text: rec.answer_text ?? null,
        answer_status: rec.answer_status,
      };
      insertQuestionAnswer(qa);

      const sol: Solution = {
        id: uuid(),
        question_id: questionId,
        steps: rec.solution_steps,
        shortcut: rec.shortcut ?? null,
        shortcut_type: rec.shortcut_type ?? null,
        shortcut_note: rec.shortcut_note ?? null,
        verification_status: rec.verification_status,
        matches_key: rec.matches_key ?? null,
        checked_by: rec.checked_by ?? null,
        human_reviewed: rec.human_reviewed,
        reviewed_at: now,
        created_at: now,
        updated_at: now,
      };
      insertRow<Solution>('solutions', sol);

      imported++;
      insertAuditLog({
        id: uuid(),
        user_id: 'monitor',
        action: 'question_imported_controlled_syllabus',
        entity_type: 'question',
        entity_id: questionId,
        details: { number: rec.number, paper_id: paper.id },
        created_at: now,
      });
    }
  }

  return {
    total: records.length,
    imported,
    updated,
    skipped,
    errors,
    warnings,
  };
}
