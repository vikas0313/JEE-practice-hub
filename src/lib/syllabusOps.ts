// ============================================================
// JEE Practice Hub — Controlled Syllabus Operations (Merge, Move, Confirm, Delete Guard)
// Handles tree mutations, question repointing, alias creation, and audit logging.
// ============================================================

import { v4 as uuid } from 'uuid';
import {
  getSyllabusChapter,
  getSyllabusChapters,
  updateSyllabusChapter,
  deleteSyllabusChapter,
  getSyllabusTopic,
  getSyllabusTopics,
  updateSyllabusTopic,
  deleteSyllabusTopic,
  getSyllabusSubtopics,
  updateSyllabusSubtopic,
  deleteSyllabusSubtopic,
  insertSyllabusAlias,
  getSyllabusAliases,
  getAllQuestions,
  updateQuestion,
  insertAuditLog,
} from './db';
import type { SyllabusChapter, SyllabusTopic } from './types';

export interface DeleteCheckResult {
  canDelete: boolean;
  referencingQuestionsCount: number;
  reason?: string;
}

/**
 * Checks whether a chapter can be deleted safely or must be protected.
 * If questions reference this chapter, hard deletion is blocked.
 */
export function checkChapterDeletion(chapterId: string): DeleteCheckResult {
  const questions = getAllQuestions();
  const refs = questions.filter(
    q => q.primary_chapter_id === chapterId || q.secondary_chapter_id === chapterId
  );
  if (refs.length > 0) {
    return {
      canDelete: false,
      referencingQuestionsCount: refs.length,
      reason: `Cannot delete chapter: referenced by ${refs.length} questions. You may deactivate it instead.`,
    };
  }
  return { canDelete: true, referencingQuestionsCount: 0 };
}

/**
 * Checks whether a topic can be deleted safely or must be protected.
 */
export function checkTopicDeletion(topicId: string): DeleteCheckResult {
  const questions = getAllQuestions();
  const refs = questions.filter(
    q => q.primary_topic_id === topicId || q.secondary_topic_id === topicId
  );
  if (refs.length > 0) {
    return {
      canDelete: false,
      referencingQuestionsCount: refs.length,
      reason: `Cannot delete topic: referenced by ${refs.length} questions. You may deactivate it instead.`,
    };
  }
  return { canDelete: true, referencingQuestionsCount: 0 };
}

/**
 * Moves a topic to a different chapter.
 * Also updates questions pointing to this topic so their primary_chapter_id reflects the new chapter.
 */
export function moveTopic(topicId: string, targetChapterId: string, monitorId: string = 'monitor') {
  const topic = getSyllabusTopic(topicId);
  if (!topic) throw new Error('Topic not found');
  const targetChapter = getSyllabusChapter(targetChapterId);
  if (!targetChapter) throw new Error('Target chapter not found');

  const oldChapterId = topic.chapter_id;
  updateSyllabusTopic(topicId, { chapter_id: targetChapterId });

  // Update questions pointing to this topic
  const questions = getAllQuestions().filter(q => q.primary_topic_id === topicId);
  for (const q of questions) {
    updateQuestion(q.id, { primary_chapter_id: targetChapterId });
  }

  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'syllabus_topic_moved',
    entity_type: 'syllabus_topic',
    entity_id: topicId,
    details: {
      topic_id: topicId,
      old_chapter_id: oldChapterId,
      new_chapter_id: targetChapterId,
      questions_repointed: questions.length,
    },
    created_at: new Date().toISOString(),
  });

  return { ok: true, repointedQuestions: questions.length };
}

/**
 * Merges sourceChapter into targetChapter:
 * - Repoints all topics under sourceChapter to targetChapter.
 * - Repoints all questions where primary/secondary chapter is sourceChapter.
 * - Creates an alias for the sourceChapter name -> targetChapter.
 * - Deactivates/deletes sourceChapter.
 * - Emits audit log.
 */
export function mergeChapters(
  sourceChapterId: string,
  targetChapterId: string,
  monitorId: string = 'monitor'
) {
  if (sourceChapterId === targetChapterId) {
    throw new Error('Cannot merge a chapter into itself');
  }

  const source = getSyllabusChapter(sourceChapterId);
  const target = getSyllabusChapter(targetChapterId);
  if (!source || !target) throw new Error('Source or Target chapter not found');

  // 1. Move all topics
  const topics = getSyllabusTopics(sourceChapterId);
  for (const t of topics) {
    updateSyllabusTopic(t.id, { chapter_id: targetChapterId });
  }

  // 2. Repoint all questions
  const questions = getAllQuestions();
  let repointedCount = 0;
  for (const q of questions) {
    let changed = false;
    const patch: any = {};
    if (q.primary_chapter_id === sourceChapterId) {
      patch.primary_chapter_id = targetChapterId;
      changed = true;
    }
    if (q.secondary_chapter_id === sourceChapterId) {
      patch.secondary_chapter_id = targetChapterId;
      changed = true;
    }
    if (changed) {
      updateQuestion(q.id, patch);
      repointedCount++;
    }
  }

  // 3. Register alias for source chapter name pointing to target
  insertSyllabusAlias({
    id: uuid(),
    alias: source.name,
    target_type: 'chapter',
    target_id: targetChapterId,
    subject_id: target.subject_id,
    created_by: monitorId,
    created_at: new Date().toISOString(),
  });

  // 4. Remove or deactivate source
  deleteSyllabusChapter(sourceChapterId);

  // 5. Audit
  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'syllabus_chapter_merged',
    entity_type: 'syllabus_chapter',
    entity_id: targetChapterId,
    details: {
      source_id: sourceChapterId,
      source_name: source.name,
      target_id: targetChapterId,
      target_name: target.name,
      topics_moved: topics.length,
      questions_repointed: repointedCount,
    },
    created_at: new Date().toISOString(),
  });

  return { ok: true, topicsMoved: topics.length, questionsRepointed: repointedCount };
}

/**
 * Merges sourceTopic into targetTopic:
 * - Repoints all subtopics under sourceTopic to targetTopic.
 * - Repoints all questions where primary/secondary topic is sourceTopic.
 * - Creates an alias for the sourceTopic name -> targetTopic.
 * - Deletes sourceTopic.
 * - Emits audit log.
 */
export function mergeTopics(
  sourceTopicId: string,
  targetTopicId: string,
  subjectId: string,
  monitorId: string = 'monitor'
) {
  if (sourceTopicId === targetTopicId) {
    throw new Error('Cannot merge a topic into itself');
  }

  const source = getSyllabusTopic(sourceTopicId);
  const target = getSyllabusTopic(targetTopicId);
  if (!source || !target) throw new Error('Source or Target topic not found');

  // 1. Move subtopics
  const subtopics = getSyllabusSubtopics(sourceTopicId);
  for (const st of subtopics) {
    updateSyllabusSubtopic(st.id, { topic_id: targetTopicId });
  }

  // 2. Repoint questions
  const questions = getAllQuestions();
  let repointedCount = 0;
  for (const q of questions) {
    let changed = false;
    const patch: any = {};
    if (q.primary_topic_id === sourceTopicId) {
      patch.primary_topic_id = targetTopicId;
      changed = true;
    }
    if (q.secondary_topic_id === sourceTopicId) {
      patch.secondary_topic_id = targetTopicId;
      changed = true;
    }
    if (changed) {
      updateQuestion(q.id, patch);
      repointedCount++;
    }
  }

  // 3. Register alias
  insertSyllabusAlias({
    id: uuid(),
    alias: source.name,
    target_type: 'topic',
    target_id: targetTopicId,
    subject_id: subjectId,
    created_by: monitorId,
    created_at: new Date().toISOString(),
  });

  // 4. Delete source topic
  deleteSyllabusTopic(sourceTopicId);

  // 5. Audit
  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'syllabus_topic_merged',
    entity_type: 'syllabus_topic',
    entity_id: targetTopicId,
    details: {
      source_id: sourceTopicId,
      source_name: source.name,
      target_id: targetTopicId,
      target_name: target.name,
      subtopics_moved: subtopics.length,
      questions_repointed: repointedCount,
    },
    created_at: new Date().toISOString(),
  });

  return { ok: true, subtopicsMoved: subtopics.length, questionsRepointed: repointedCount };
}

/**
 * Confirms a chapter against the official JEE Main syllabus.
 * Sets status='active', syllabus_status='confirmed', records confirmed_by, confirmed_at, and optional note.
 */
export function confirmChapterSyllabus(
  chapterId: string,
  monitorId: string = 'monitor',
  sourceNote?: string
) {
  const chapter = getSyllabusChapter(chapterId);
  if (!chapter) throw new Error('Chapter not found');

  const now = new Date().toISOString();
  const updated = updateSyllabusChapter(chapterId, {
    status: 'active',
    syllabus_status: 'confirmed',
    confirmed_by: monitorId,
    confirmed_at: now,
    source_note: sourceNote || chapter.source_note || 'Confirmed against official syllabus',
  });

  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'syllabus_chapter_confirmed',
    entity_type: 'syllabus_chapter',
    entity_id: chapterId,
    details: {
      chapter_id: chapterId,
      chapter_name: chapter.name,
      source_note: sourceNote,
      confirmed_at: now,
    },
    created_at: now,
  });

  return updated;
}

