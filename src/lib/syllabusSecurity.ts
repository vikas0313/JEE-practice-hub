// ============================================================
// JEE Practice Hub — Controlled Syllabus Security & Student Visibility
// Enforces database RLS policies and restricted views in application layer.
// ============================================================

import {
  getSyllabusSubjects,
  getSyllabusGroups,
  getSyllabusChapters,
  getSyllabusTopics,
  getSyllabusSubtopics,
  getSyllabusAliases,
  getAllQuestions,
} from './db';
import type { SyllabusAlias } from './types';

export interface StudentVisibleSyllabusItem {
  chapter_id: string;
  external_id?: string | null;
  subject_id: string;
  subject_name: string;
  group_id: string;
  group_name: string;
  chapter_name: string;
  chapter_sort_order: number;
  topics: Array<{
    topic_id: string;
    topic_name: string;
    sort_order: number;
    subtopics: Array<{
      subtopic_id: string;
      subtopic_name: string;
      sort_order: number;
    }>;
  }>;
}

/**
 * Emulates the SQL view `v_student_visible_syllabus` and RLS policy:
 * - Only active chapters with syllabus_status in ('confirmed', 'listed_in_guide').
 * - Only active topics and active subtopics.
 * - Strips sensitive metadata: source_note, confirmed_by, confirmed_at.
 */
export function getStudentVisibleSyllabus(subjectId?: string): StudentVisibleSyllabusItem[] {
  const subjects = getSyllabusSubjects();
  const groups = getSyllabusGroups();
  const allChapters = getSyllabusChapters();
  const allTopics = getSyllabusTopics();
  const allSubtopics = getSyllabusSubtopics();

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  // RLS filter for student
  const studentChapters = allChapters.filter(c => {
    if (subjectId && c.subject_id !== subjectId) return false;
    if (c.status !== 'active') return false;
    return c.syllabus_status === 'confirmed' || c.syllabus_status === 'listed_in_guide';
  });

  return studentChapters.map(c => {
    const topics = allTopics
      .filter(t => t.chapter_id === c.id && t.status === 'active')
      .map(t => {
        const subtopics = allSubtopics
          .filter(st => st.topic_id === t.id && st.status === 'active')
          .map(st => ({
            subtopic_id: st.id,
            subtopic_name: st.name,
            sort_order: st.sort_order,
          }));

        return {
          topic_id: t.id,
          topic_name: t.name,
          sort_order: t.sort_order,
          subtopics,
        };
      });

    return {
      chapter_id: c.id,
      external_id: c.external_id,
      subject_id: c.subject_id,
      subject_name: subjectMap.get(c.subject_id) ?? 'Unknown',
      group_id: c.group_id,
      group_name: groupMap.get(c.group_id) ?? 'Unknown',
      chapter_name: c.name,
      chapter_sort_order: c.sort_order,
      topics,
    };
  });
}

/**
 * RLS check for syllabus aliases:
 * Students are strictly denied access to aliases.
 */
export function getSyllabusAliasesSecure(role: string, subjectId?: string): SyllabusAlias[] {
  if (role !== 'monitor') {
    return []; // Deny
  }
  return getSyllabusAliases(subjectId);
}

/**
 * RLS mutation guard:
 * Only monitor can create, update, or delete syllabus elements.
 */
export function canMutateSyllabus(role: string): boolean {
  return role === 'monitor';
}

/**
 * Emulates the SQL view `v_taggable_complete_questions`
 */
export interface TaggableQuestionRecord {
  question_id: string;
  primary_chapter_id: string | null;
  primary_topic_id: string | null;
  taggable_complete: boolean;
}

export function getTaggableCompleteQuestions(): TaggableQuestionRecord[] {
  const questions = getAllQuestions();
  return questions.map(q => ({
    question_id: q.id,
    primary_chapter_id: q.primary_chapter_id ?? null,
    primary_topic_id: q.primary_topic_id ?? null,
    taggable_complete: Boolean(q.primary_chapter_id && q.primary_topic_id),
  }));
}

