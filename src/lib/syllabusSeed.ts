// ============================================================
// JEE Practice Hub — Controlled Syllabus Seed & Migration Script
// Loads 92 canonical chapters from Master Index, provisions
// Subject > Group > Chapter hierarchy, and migrates existing questions.
// ============================================================

import { v4 as uuid } from 'uuid';
import syllabusMasterData from '../../data/syllabus_chapters.json';
import importedTopicsData from '../../data/imported_syllabus_topics.json';
import {
  getSyllabusSubjects,
  insertSyllabusSubject,
  getSyllabusGroups,
  insertSyllabusGroup,
  getSyllabusChapters,
  insertSyllabusChapter,
  updateSyllabusChapter,
  getSyllabusTopics,
  insertSyllabusTopic,
  getSyllabusAliases,
  getAllQuestions,
  updateQuestion,
  getSubjects,
  getChapters,
  getTopics,
} from './db';
import type {
  SyllabusSubject,
  SyllabusGroup,
  SyllabusChapter,
  SyllabusTopic,
  SyllabusStatus,
  ControlledSyllabusItemStatus,
} from './types';

export function normalizeSyllabusName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\s\-\/]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface SeedResult {
  subjectsCreated: number;
  groupsCreated: number;
  chaptersCreated: number;
  chaptersUpdated: number;
  topicsCreated: number;
}

export function seedSyllabusHierarchy(): SeedResult {
  let subjectsCreated = 0;
  let groupsCreated = 0;
  let chaptersCreated = 0;
  let chaptersUpdated = 0;
  let topicsCreated = 0;

  // 1. Ensure 3 primary subjects
  const subjectConfigs = [
    { name: 'Physics', slug: 'physics', sort_order: 1 },
    { name: 'Chemistry', slug: 'chemistry', sort_order: 2 },
    { name: 'Mathematics', slug: 'mathematics', sort_order: 3 },
  ];

  const existingSubjects = getSyllabusSubjects();
  const subjectMap = new Map<string, SyllabusSubject>();

  for (const cfg of subjectConfigs) {
    let sub = existingSubjects.find(
      s => normalizeSyllabusName(s.name) === normalizeSyllabusName(cfg.name)
    );
    if (!sub) {
      sub = insertSyllabusSubject({
        id: uuid(),
        name: cfg.name,
        slug: cfg.slug,
        sort_order: cfg.sort_order,
        created_at: new Date().toISOString(),
      });
      subjectsCreated++;
    }
    subjectMap.set(cfg.name, sub);
  }

  // 2. Process groups and chapters from master data
  const existingGroups = getSyllabusGroups();
  const groupMap = new Map<string, SyllabusGroup>(); // key: `${subject_id}:${normalizedGroupName}`
  for (const g of existingGroups) {
    groupMap.set(`${g.subject_id}:${normalizeSyllabusName(g.name)}`, g);
  }

  const existingChapters = getSyllabusChapters();
  const chapterMap = new Map<string, SyllabusChapter>(); // key: external_id or `${subject_id}:${normalizedName}`
  for (const c of existingChapters) {
    if (c.external_id) chapterMap.set(c.external_id, c);
    chapterMap.set(`${c.subject_id}:${normalizeSyllabusName(c.name)}`, c);
  }

  let groupSortCounter = new Map<string, number>();

  for (const chData of syllabusMasterData.chapters) {
    const sub = subjectMap.get(chData.subject);
    if (!sub) continue;

    // Group lookup / creation
    const groupKey = `${sub.id}:${normalizeSyllabusName(chData.group)}`;
    let group = groupMap.get(groupKey);
    if (!group) {
      const sort = (groupSortCounter.get(sub.id) ?? 0) + 1;
      groupSortCounter.set(sub.id, sort);

      group = insertSyllabusGroup({
        id: uuid(),
        subject_id: sub.id,
        name: chData.group,
        slug: generateSlug(chData.group),
        sort_order: sort,
        created_at: new Date().toISOString(),
      });
      groupMap.set(groupKey, group);
      groupsCreated++;
    }

    // Determine initial status according to rules:
    // verify_current_syllabus -> status: 'inactive', syllabus_status: 'verify_current_syllabus'
    // listed_in_guide -> status: 'active', syllabus_status: 'listed_in_guide'
    const isVerify = chData.syllabus_status === 'verify_current_syllabus';
    const status: ControlledSyllabusItemStatus = isVerify ? 'inactive' : 'active';
    const syllabusStatus: SyllabusStatus = isVerify ? 'verify_current_syllabus' : 'listed_in_guide';

    // Parse sort order from ID (e.g. 'PHY-012' -> 12)
    const numMatch = chData.id.match(/\d+/);
    const sortOrder = numMatch ? parseInt(numMatch[0], 10) : 1;

    const chapterKey = `${sub.id}:${normalizeSyllabusName(chData.chapter)}`;
    let chapter = chapterMap.get(chData.id) ?? chapterMap.get(chapterKey);

    if (!chapter) {
      chapter = insertSyllabusChapter({
        id: uuid(),
        external_id: chData.id,
        subject_id: sub.id,
        group_id: group.id,
        name: chData.chapter,
        slug: generateSlug(chData.chapter),
        sort_order: sortOrder,
        status,
        syllabus_status: syllabusStatus,
        source_note: 'JEE_PYQ_Chapterwise_Master_Index_2002-2026.pdf',
        confirmed_by: null,
        confirmed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      chapterMap.set(chData.id, chapter);
      chapterMap.set(chapterKey, chapter);
      chaptersCreated++;
    } else {
      // Idempotent refresh if needed
      updateSyllabusChapter(chapter.id, {
        external_id: chData.id,
        group_id: group.id,
        source_note: 'JEE_PYQ_Chapterwise_Master_Index_2002-2026.pdf',
      });
      chaptersUpdated++;
    }

    // Process topics if present (empty in seed file)
    if (chData.topics && chData.topics.length > 0) {
      const existingTopics = getSyllabusTopics(chapter.id);
      for (let i = 0; i < chData.topics.length; i++) {
        const tName = chData.topics[i];
        if (!existingTopics.some(t => normalizeSyllabusName(t.name) === normalizeSyllabusName(tName))) {
          insertSyllabusTopic({
            id: uuid(),
            chapter_id: chapter.id,
            name: tName,
            slug: generateSlug(tName),
            sort_order: i + 1,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          topicsCreated++;
        }
      }
    }
  }

  return {
    subjectsCreated,
    groupsCreated,
    chaptersCreated,
    chaptersUpdated,
    topicsCreated,
  };
}

/**
 * Seeds topics from jee_mocks_db dataset into the controlled syllabus.
 * "if syllabus topic is missing add the new syllabus topic"
 */
export function seedImportedSyllabusTopics(): { topicsCreated: number } {
  const existingChapters = getSyllabusChapters();
  const chapterMap = new Map<string, SyllabusChapter>();
  for (const c of existingChapters) {
    if (c.external_id) chapterMap.set(c.external_id, c);
    chapterMap.set(c.id, c);
  }

  const existingTopics = getSyllabusTopics();
  const topicMap = new Map<string, SyllabusTopic>();
  for (const t of existingTopics) {
    topicMap.set(`${t.chapter_id}:${normalizeSyllabusName(t.name)}`, t);
    topicMap.set(t.id, t);
  }

  let topicsCreated = 0;
  for (const tData of importedTopicsData) {
    const ch = chapterMap.get(tData.chapter_external_id);
    if (!ch) continue;

    const topicKey = `${ch.id}:${normalizeSyllabusName(tData.name)}`;
    if (!topicMap.has(topicKey) && !topicMap.has(tData.id)) {
      const newTopic: SyllabusTopic = {
        id: tData.id,
        chapter_id: ch.id,
        name: tData.name,
        slug: tData.slug,
        status: 'active',
        sort_order: tData.sort_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      insertSyllabusTopic(newTopic);
      topicMap.set(topicKey, newTopic);
      topicMap.set(tData.id, newTopic);
      topicsCreated++;
    }
  }

  return { topicsCreated };
}

export interface UnmatchedTagRecord {
  question_id: string;
  paper_id?: string;
  number?: number;
  subject_name: string;
  raw_chapter: string;
  raw_topic?: string;
  reason: 'chapter_not_found' | 'topic_not_found' | 'subject_not_found';
}

export interface MigrationSummary {
  totalQuestions: number;
  migratedCount: number;
  unmatchedCount: number;
  unmatched: UnmatchedTagRecord[];
}

export function migrateExistingQuestionTags(): MigrationSummary {
  const questions = getAllQuestions();
  const syllabusSubjects = getSyllabusSubjects();
  const syllabusChapters = getSyllabusChapters();
  const syllabusTopics = getTable<SyllabusTopic>('syllabus_topics');
  const syllabusAliases = getSyllabusAliases();
  const legacySubjects = getSubjects();
  const legacyChapters = getChapters();
  const legacyTopics = getTopics();

  const unmatched: UnmatchedTagRecord[] = [];
  let migratedCount = 0;

  for (const q of questions) {
    // If already has a primary_chapter_id, check if valid
    if (q.primary_chapter_id) {
      migratedCount++;
      continue;
    }

    // Resolve subject
    const legacySub = legacySubjects.find(s => s.id === q.subject_id);
    const subName = legacySub ? legacySub.name : q.subject_id;
    const sylSub = syllabusSubjects.find(
      s => normalizeSyllabusName(s.name) === normalizeSyllabusName(subName)
    );

    // Resolve legacy chapter name
    const legacyCh = legacyChapters.find(c => c.id === q.chapter_id);
    const rawChapterName = legacyCh ? legacyCh.name : q.chapter_id;

    // Resolve legacy topic name
    const legacyTop = legacyTopics.find(t => t.id === q.topic_id);
    const rawTopicName = legacyTop ? legacyTop.name : q.topic_id;

    if (!sylSub) {
      unmatched.push({
        question_id: q.id,
        paper_id: q.paper_id,
        number: q.number,
        subject_name: subName,
        raw_chapter: rawChapterName || '',
        raw_topic: rawTopicName || '',
        reason: 'subject_not_found',
      });
      continue;
    }

    // Match Chapter: 1) exact normalized match, 2) alias match
    const normRawChapter = normalizeSyllabusName(rawChapterName);
    const candidateChapters = syllabusChapters.filter(c => c.subject_id === sylSub.id);

    let matchedChapter = candidateChapters.find(
      c => normalizeSyllabusName(c.name) === normRawChapter || c.external_id === rawChapterName
    );

    if (!matchedChapter) {
      // Check aliases
      const alias = syllabusAliases.find(
        a => a.subject_id === sylSub.id &&
             a.target_type === 'chapter' &&
             normalizeSyllabusName(a.alias) === normRawChapter
      );
      if (alias) {
        matchedChapter = candidateChapters.find(c => c.id === alias.target_id);
      }
    }

    if (!matchedChapter) {
      unmatched.push({
        question_id: q.id,
        paper_id: q.paper_id,
        number: q.number,
        subject_name: sylSub.name,
        raw_chapter: rawChapterName,
        raw_topic: rawTopicName,
        reason: 'chapter_not_found',
      });
      continue;
    }

    // Check Topic if available
    let matchedTopicId: string | null = null;
    if (rawTopicName) {
      const normRawTopic = normalizeSyllabusName(rawTopicName);
      const candidateTopics = syllabusTopics.filter(t => t.chapter_id === matchedChapter!.id);
      const matchedTopic = candidateTopics.find(
        t => normalizeSyllabusName(t.name) === normRawTopic
      );
      if (matchedTopic) {
        matchedTopicId = matchedTopic.id;
      }
    }

    // Update Question
    updateQuestion(q.id, {
      primary_chapter_id: matchedChapter.id,
      primary_topic_id: matchedTopicId,
    });
    migratedCount++;
  }

  return {
    totalQuestions: questions.length,
    migratedCount,
    unmatchedCount: unmatched.length,
    unmatched,
  };
}

// Low-level helper to avoid circular dependency
function getTable<T>(name: string): T[] {
  try {
    const raw = localStorage.getItem(`jph_${name}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function generateTopicImportTemplateCsv(): string {
  return [
    '# JEE Practice Hub — Controlled Syllabus Topic Import Template',
    '# Instructions: Fill in subject, exact chapter name or ID, topic name, and optional subtopic name.',
    '# Subject must be: Physics, Chemistry, or Mathematics.',
    '# Chapter must match an active chapter name or external_id (e.g. PHY-004 or Motion in a straight line).',
    'subject,chapter,topic,subtopic',
    'Physics,PHY-004,Kinematics Graphs,Displacement-time graphs',
    'Physics,PHY-004,Relative Motion in 1D,River swimmer problem',
    'Chemistry,CHE-040,Integrated Rate Law,First order reaction kinetics',
    'Mathematics,MAT-082,Definite Integrals Properties,King property integration',
  ].join('\n');
}
