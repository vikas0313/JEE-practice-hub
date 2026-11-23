// ============================================================
// Phase 4: Data Management (Export All & Delete All Data)
// ============================================================
// SRD Sections 7 and 10 & Phase 4 Scope Item 4:
// - Export-all-data and delete-all-data are MONITOR-ONLY.
// - Every invocation is logged in audit_log.
// - Deleting student data must completely wipe student attempts,
//   responses, visits, practiced questions, mistake notebook,
//   and student flags without destroying the content bank.

import { v4 as uuid } from 'uuid';
import {
  getMonitorProfile,
  getStudentProfile,
  getTable,
  insertAuditLog,
  getAuditLogs,
} from './db';
import type {
  Question,
  Paper,
  Attempt,
  Response,
  Visit,
  PracticedQuestion,
  RevisionItem,
  Bookmark,
  Target,
  PercentileMap,
  ChapterWeightage,
  AuditLog,
  Profile,
} from './types';

export interface FullDataExport {
  exported_at: string;
  version: string;
  counts: Record<string, number>;
  data: {
    profiles: Profile[];
    papers: Paper[];
    questions: Question[];
    attempts: Attempt[];
    responses: Response[];
    visits: Visit[];
    practiced_questions: PracticedQuestion[];
    revision_items: RevisionItem[];
    bookmarks: Bookmark[];
    targets: Target[];
    percentile_maps: PercentileMap[];
    chapter_weightages: ChapterWeightage[];
    audit_logs: AuditLog[];
  };
}

export interface DeletionResult {
  deleted_at: string;
  counts_deleted: {
    attempts: number;
    responses: number;
    visits: number;
    practiced_questions: number;
    revision_items: number;
    bookmarks: number;
  };
  success: boolean;
}

function verifyMonitorAccess(userId: string): void {
  const monitor = getMonitorProfile();
  if (!monitor || monitor.id !== userId) {
    throw new Error('Unauthorized: only the monitor can perform full data export or deletion');
  }
}

/**
 * Export all system data in structured format (Monitor only)
 */
export function exportAllData(requestingUserId: string): FullDataExport {
  verifyMonitorAccess(requestingUserId);

  const data = {
    profiles: getTable<Profile>('profiles'),
    papers: getTable<Paper>('papers'),
    questions: getTable<Question>('questions'),
    attempts: getTable<Attempt>('attempts'),
    responses: getTable<Response>('responses'),
    visits: getTable<Visit>('visits'),
    practiced_questions: getTable<PracticedQuestion>('practiced_questions'),
    revision_items: getTable<RevisionItem>('revision_items'),
    bookmarks: getTable<Bookmark>('bookmarks'),
    targets: getTable<Target>('targets'),
    percentile_maps: getTable<PercentileMap>('percentile_maps'),
    chapter_weightages: getTable<ChapterWeightage>('chapter_weightages'),
    audit_logs: getAuditLogs(),
  };

  const counts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(data)) {
    counts[key] = rows.length;
  }

  const exportObj: FullDataExport = {
    exported_at: new Date().toISOString(),
    version: '1.4',
    counts,
    data,
  };

  insertAuditLog({
    id: uuid(),
    user_id: requestingUserId,
    action: 'export_all_data',
    entity_type: 'system',
    entity_id: null,
    details: { counts },
    created_at: exportObj.exported_at,
  });

  return exportObj;
}

/**
 * Delete all student records while preserving question content & configuration (Monitor only)
 */
export function deleteAllStudentData(requestingUserId: string): DeletionResult {
  verifyMonitorAccess(requestingUserId);

  const student = getStudentProfile();
  const studentId = student?.id;

  const attempts = getTable<Attempt>('attempts');
  const responses = getTable<Response>('responses');
  const visits = getTable<Visit>('visits');
  const practiced = getTable<PracticedQuestion>('practiced_questions');
  const revisions = getTable<RevisionItem>('revision_items');
  const bookmarks = getTable<Bookmark>('bookmarks');

  const counts_deleted = {
    attempts: attempts.length,
    responses: responses.length,
    visits: visits.length,
    practiced_questions: practiced.length,
    revision_items: revisions.length,
    bookmarks: bookmarks.length,
  };

  // Clear student tables in localStorage / storage
  localStorage.setItem('jph_attempts', JSON.stringify([]));
  localStorage.setItem('jph_responses', JSON.stringify([]));
  localStorage.setItem('jph_visits', JSON.stringify([]));
  localStorage.setItem('jph_practiced_questions', JSON.stringify([]));
  localStorage.setItem('jph_revision_items', JSON.stringify([]));
  localStorage.setItem('jph_bookmarks', JSON.stringify([]));
  localStorage.setItem('jph_shortcut_retries', JSON.stringify([]));
  localStorage.setItem('jph_student_flags', JSON.stringify([]));

  const deleted_at = new Date().toISOString();

  insertAuditLog({
    id: uuid(),
    user_id: requestingUserId,
    action: 'delete_all_student_data',
    entity_type: 'student',
    entity_id: studentId || null,
    details: { counts_deleted },
    created_at: deleted_at,
  });

  return {
    deleted_at,
    counts_deleted,
    success: true,
  };
}
