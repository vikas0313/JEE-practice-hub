
import { v4 as uuid } from 'uuid';
import type {
  Role, Profile, AccountStatus, Settings, StudentSettings, Paper, PatternProfile, Subject, Chapter, Topic,
  Question, QuestionAnswer, QuestionTranslation, Solution, FigureAsset,
  Attempt, Response, PracticedQuestion, Bookmark,
  Visit, PauseEvent, SolutionView, FlagReport, AuditLog,
  PilotQuestionRecord, Difficulty, QuestionType,
  Exam, ExamQuestion, RevisionItem, ExamTelemetryEvent, MonitorNotice,
  ExamSubmitReason, PaletteStatus, MasteryStats,
  Target, TargetType, CutoffUnit, PercentileMap, PercentileMapRow,
  ChapterWeightage, EstimateSnapshot, StudentEstimate, EstimateDisplayMode,
  CoarseBand, Alert, AlertSeverity, AlertStatus, AlertSettings,
  Assignment, AssignmentStatus, ShortcutVerdict, ShortcutRetry, EmailLog,
  PaperStatus, ResourceLink, ResourceType,
  RealExamOutcome, CalibrationLogEntry, MaintenanceRecord,
  DestructiveAction, StudentResultExportRow,
  UserPreferences, PrefetchedQuestionText,
  SyncIdempotencyKey, ClientEventSequence, DeadLetterJob,
  UserSession, CspReport, MfaRecoveryCode,
  SpacedRepetitionCard,
  CalibrationSnapshot,
  ChapterNote,
  ExamAdvancedAnalytics,
  SavedReportView,
  StudyPlan,
  QuestionSearchIndex,
  Subtopic,
  ConceptPrerequisite,
  SyllabusSubject,
  SyllabusGroup,
  SyllabusChapter,
  SyllabusTopic,
  SyllabusSubtopic,
  SyllabusAlias,
} from './types';
import { isQuestionVisible } from './types';
import { hitRateLimit } from './rateLimiter';
import pilotData from '../../data/pilot_jee_main_2026_apr02_morning.json';
import demoData from '../../data/demo_seed_questions.json';
import syllabusMasterData from '../../data/syllabus_chapters.json';
import importedTopicsData from '../../data/imported_syllabus_topics.json';
import * as defaultImportedMod from './importedQuestions';

// Imported mocks provider for full 7,321 question bank
interface ImportedMocksProvider {
  getImportedQuestions: () => Question[];
  getImportedQuestionAnswers: () => QuestionAnswer[];
  getImportedSolutions: () => Solution[];
  getImportedQuestion: (id: string) => Question | null;
  getImportedAnswer: (id: string) => QuestionAnswer | null;
  getImportedSolution: (id: string) => Solution | null;
  clearImportedCache: () => void;
}

let _importedMocksModule: ImportedMocksProvider | null = defaultImportedMod;

export async function ensureImportedMocksLoaded(): Promise<boolean> {
  if (!_importedMocksModule) {
    try {
      _importedMocksModule = await import('./importedQuestions');
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export function setImportedMocksProvider(mod: ImportedMocksProvider | null): void {
  _importedMocksModule = mod;
}

// In-memory index for O(1) question lookups (Cause 2)
let _questionIdMap: Map<string, Question | null> | null = null;
export function clearQuestionIndex(): void {
  _questionIdMap = null;
}

// ---- Low-level storage ----

let lastRawString: Record<string, string> = {};
let lastParsedData: Record<string, any[]> = {};

export function getTable<T>(name: string): T[] {
  try {
    const raw = localStorage.getItem(`jph_${name}`);
    if (!raw) {
      delete lastRawString[name];
      delete lastParsedData[name];
      return [];
    }
    if (raw === lastRawString[name] && lastParsedData[name]) {
      return lastParsedData[name] as T[];
    }
    const data = JSON.parse(raw);
    lastRawString[name] = raw;
    lastParsedData[name] = data;
    return data as T[];
  } catch {
    return [];
  }
}

function setTable<T>(name: string, data: T[]): void {
  try {
    const serialized = JSON.stringify(data);
    lastRawString[name] = serialized;
    lastParsedData[name] = data;
    localStorage.setItem(`jph_${name}`, serialized);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('storage'));
      if (name === 'profiles' || name === 'responses' || name === 'visits' || name === 'attempts') {
        window.dispatchEvent(new Event('active-student-changed'));
      }
    }
  } catch {
    // Graceful fallback
  }
}

import { syncPush } from './supabaseSync';

export function insertRow<T extends { id: string }>(table: string, row: T): T {
  const rows = getTable<T>(table);
  rows.push(row);
  setTable(table, rows);
  syncPush(table, row);
  return row;
}

export function updateRow<T extends { id: string }>(table: string, id: string, patch: Partial<T>): T | null {
  const rows = getTable<T>(table);
  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  setTable(table, rows);
  syncPush(table, rows[idx]);
  return rows[idx];
}

function deleteRow<T extends { id: string }>(table: string, id: string): boolean {
  const rows = getTable<T>(table);
  const filtered = rows.filter(r => r.id !== id);
  if (filtered.length === rows.length) return false;
  setTable(table, filtered);
  return true;
}

// ---- Profiles ----

export function getProfiles(): Profile[] {
  // Self-healing migration for legacy 'jph_table_profiles'
  try {
    const legacy = localStorage.getItem('jph_table_profiles');
    if (legacy) {
      const legacyList = JSON.parse(legacy);
      if (Array.isArray(legacyList) && legacyList.length > 0) {
        const currentRows = getTable<Profile>('profiles');
        let added = false;
        for (const item of legacyList) {
          if (item && item.id && !currentRows.some(c => c.id === item.id || (c.email && item.email && c.email.toLowerCase() === item.email.toLowerCase()))) {
            currentRows.push(item);
            added = true;
          }
        }
        if (added) {
          setTable('profiles', currentRows);
        }
        localStorage.removeItem('jph_table_profiles');
      }
    }
  } catch {}

  const rows = getTable<Profile>('profiles');
  let changed = false;
  const migrated = rows.map(p => {
    if (!p.status) {
      changed = true;
      return {
        ...p,
        status: 'approved' as AccountStatus,
        first_name: p.first_name || (p.role === 'student' ? 'Phase1' : 'Guardian'),
        last_name: p.last_name || (p.role === 'student' ? 'Student' : 'Monitor'),
        age: p.age ?? (p.role === 'student' ? 18 : undefined),
        college_name: p.college_name || (p.role === 'student' ? 'Phase 1 Legacy Institution' : undefined),
        incomplete_profile: p.role === 'student' ? true : false,
      };
    }
    return p;
  });
  if (changed) {
    setTable('profiles', migrated);
  }
  return migrated;
}

export function getProfile(id: string): Profile | null {
  return getProfiles().find(p => p.id === id) ?? null;
}

export function getProfileByEmail(email: string): Profile | null {
  return getProfiles().find(p => p.email === email) ?? null;
}

export function updateProfile(id: string, patch: Partial<Profile>, callerRole?: Role): Profile | null {
  const existing = getProfiles().find(p => p.id === id);
  if (!existing) return null;

  // Strict server-side authorization check: Non-monitors cannot alter privileged columns
  if (callerRole !== 'monitor') {
    if (patch.role !== undefined && patch.role !== existing.role) {
      throw new Error('Role elevation is strictly forbidden');
    }
    if (patch.status !== undefined && patch.status !== existing.status) {
      throw new Error('Status modification is strictly forbidden');
    }
    if (patch.decided_by !== undefined && patch.decided_by !== existing.decided_by) {
      throw new Error('Approval decision metadata is monitor-only');
    }
    if (patch.decided_at !== undefined && patch.decided_at !== existing.decided_at) {
      throw new Error('Approval decision metadata is monitor-only');
    }
    if (patch.email_verified_at !== undefined && patch.email_verified_at !== existing.email_verified_at) {
      throw new Error('Registration timestamp tampering is strictly forbidden');
    }
  }

  return updateRow<Profile>('profiles', id, { ...patch, updated_at: new Date().toISOString() });
}

export function getStudentProfile(studentId?: string): Profile | null {
  const students = getProfiles().filter(p => p.role === 'student');
  if (studentId) {
    return students.find(p => p.id === studentId) ?? null;
  }
  const activeId = getActiveSelectedStudentId();
  if (activeId) {
    const active = students.find(p => p.id === activeId);
    if (active) return active;
  }

  // If no explicit student selected, prioritize student with most recent activity or newest registration
  const activeStudents = students.filter(p => p.status === 'active' || p.status === 'approved');
  if (activeStudents.length === 0) return students[0] || null;

  // Check if any active student has responses or visits
  const allResponses = getTable<{ student_id: string; submitted_at?: string; created_at?: string }>('responses');
  const allVisits = getTable<{ student_id: string; ended_at?: string; started_at?: string }>('visits');

  let bestStudent = activeStudents[activeStudents.length - 1]; // Default to newest registered
  let latestActivityTime = 0;

  for (const s of activeStudents) {
    for (const r of allResponses) {
      if (r.student_id === s.id) {
        const t = new Date(r.submitted_at || r.created_at || 0).getTime();
        if (t > latestActivityTime) {
          latestActivityTime = t;
          bestStudent = s;
        }
      }
    }
    for (const v of allVisits) {
      if (v.student_id === s.id) {
        const t = new Date(v.ended_at || v.started_at || 0).getTime();
        if (t > latestActivityTime) {
          latestActivityTime = t;
          bestStudent = s;
        }
      }
    }
  }

  return bestStudent;
}

export function getAllStudents(): Profile[] {
  return getProfiles().filter(p => p.role === 'student');
}

export function getActiveStudents(): Profile[] {
  return getProfiles().filter(p => p.role === 'student' && (p.status === 'active' || p.status === 'approved'));
}

export function getApprovedStudents(): Profile[] {
  return getActiveStudents();
}

export function getPendingStudents(): Profile[] {
  return getProfiles().filter(p => p.role === 'student' && p.status === 'pending_approval');
}

export function getUnverifiedStudents(): Profile[] {
  return getProfiles().filter(p => p.role === 'student' && p.status === 'pending_email');
}

export function getActiveSelectedStudentId(): string | null {
  try {
    return localStorage.getItem('jph_selected_student_id');
  } catch {
    return null;
  }
}

export function setActiveSelectedStudentId(id: string): void {
  try {
    localStorage.setItem('jph_selected_student_id', id);
  } catch { }
}

export function getMonitorProfile(): Profile | null {
  return getProfiles().find(p => p.role === 'monitor') ?? null;
}

// ---- Per-Student Settings ----

export function getStudentSettings(studentId: string): StudentSettings | null {
  return getTable<StudentSettings>('student_settings').find(s => s.student_id === studentId) ?? null;
}

export function updateStudentSettings(studentId: string, patch: Partial<StudentSettings>): StudentSettings {
  const rows = getTable<StudentSettings>('student_settings');
  const idx = rows.findIndex(s => s.student_id === studentId || (s as any).id === studentId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...patch, updated_at: now };
    setTable('student_settings', rows);
    return rows[idx];
  }
  const created: StudentSettings = {
    id: studentId,
    student_id: studentId,
    ...patch,
    updated_at: now,
  } as any;
  rows.push(created);
  setTable('student_settings', rows);
  return created;
}

export function getEffectiveSettingsForStudent(studentId?: string): Settings {
  const global = getSettings();
  if (!studentId) return global;
  const override = getStudentSettings(studentId);
  if (!override) return global;

  return {
    ...global,
    ideal_time_basic: override.ideal_time_basic ?? global.ideal_time_basic,
    ideal_time_medium: override.ideal_time_medium ?? global.ideal_time_medium,
    ideal_time_advanced: override.ideal_time_advanced ?? global.ideal_time_advanced,
    idle_timeout: override.idle_timeout ?? global.idle_timeout,
  };
}

// ---- Student Lifecycle & Approval Functions ----

export function approveStudent(studentId: string, monitorId?: string, note?: string): { ok: boolean; success: boolean; profile?: Profile | null; error?: string } {
  const p = getProfile(studentId);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };
  const updated = updateProfile(studentId, {
    status: 'approved',
    decided_by: monitorId || null,
    decided_at: new Date().toISOString(),
    decision_note: note || null,
  }, 'monitor');

  if (!getStudentSettings(studentId)) {
    updateStudentSettings(studentId, {});
  }

  if (monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_approved',
      entity_type: 'profile',
      entity_id: studentId,
      details: { note: note || null },
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true, success: true, profile: updated || undefined };
}

export function rejectStudent(studentId: string, monitorId?: string, note?: string): { ok: boolean; success: boolean; profile?: Profile | null; error?: string } {
  const p = getProfile(studentId);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };
  const updated = updateProfile(studentId, {
    status: 'rejected',
    decided_by: monitorId || null,
    decided_at: new Date().toISOString(),
    decision_note: note || null,
  }, 'monitor');

  if (monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_rejected',
      entity_type: 'profile',
      entity_id: studentId,
      details: { note: note || null },
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true, success: true, profile: updated || undefined };
}

export function suspendStudent(studentId: string, monitorId?: string, note?: string): { ok: boolean; success: boolean; profile?: Profile | null; error?: string } {
  const p = getProfile(studentId);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };
  const updated = updateProfile(studentId, {
    status: 'suspended',
    decision_note: note || null,
  }, 'monitor');

  if (monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_suspended',
      entity_type: 'profile',
      entity_id: studentId,
      details: { note: note || null },
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true, success: true, profile: updated || undefined };
}

export function reinstateStudent(studentId: string, monitorId?: string): { ok: boolean; success: boolean; profile?: Profile | null; error?: string } {
  const p = getProfile(studentId);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };
  const updated = updateProfile(studentId, {
    status: 'approved',
  }, 'monitor');

  if (monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_reinstated',
      entity_type: 'profile',
      entity_id: studentId,
      details: { status: 'approved' },
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true, success: true, profile: updated || undefined };
}

export function deleteStudentAccount(studentId: string, monitorId?: string): { ok: boolean; success: boolean; error?: string } {
  const p = getProfile(studentId);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };

  const tables = [
    'responses', 'attempts', 'visits', 'pause_events', 'solution_views',
    'practiced_questions', 'bookmarks', 'student_settings', 'revision_items'
  ];
  for (const t of tables) {
    const rows = getTable<any>(t).filter(r => r.student_id !== studentId);
    setTable(t, rows);
  }
  deleteRow('profiles', studentId);

  if (monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_deleted',
      entity_type: 'profile',
      entity_id: studentId,
      details: { deleted_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true, success: true };
}

export function sendStudentPasswordReset(idOrEmail: string, monitorId?: string): { ok: boolean; success: boolean; message: string; error?: string } {
  const normalized = idOrEmail.trim().toLowerCase();
  const rl = hitRateLimit('pwd_reset:' + normalized, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    const msg = `Password reset rate limit exceeded. Please wait ${rl.retryAfterSeconds} seconds before requesting again.`;
    return {
      ok: false,
      success: false,
      message: msg,
      error: msg,
    };
  }

  const p = getProfile(idOrEmail) || getProfileByEmail(normalized);
  if (p && p.role === 'student' && monitorId) {
    insertAuditLog({
      id: uuid(),
      user_id: monitorId,
      action: 'student_password_reset_sent',
      entity_type: 'profile',
      entity_id: p.id,
      details: { email: p.email, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
  }

  // Uniform neutral response whether or not account exists per Amendment 1 item 4.c
  return {
    ok: true,
    success: true,
    message: 'If an account exists for this email, password reset instructions have been sent.',
  };
}

export function updateStudentEmail(studentId: string, newEmail: string, actorId: string): { ok: boolean; success: boolean; profile?: Profile; error?: string } {
  const actor = getProfile(actorId);
  const student = getProfile(studentId);
  if (!student || student.role !== 'student') {
    return { ok: false, success: false, error: 'Student not found.' };
  }
  if (!actor || (actor.role !== 'monitor' && actor.id !== studentId)) {
    return { ok: false, success: false, error: 'Unauthorized to change student email.' };
  }

  const normalized = newEmail.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, success: false, error: 'Invalid email address format.' };
  }

  const existing = getProfileByEmail(normalized);
  if (existing && existing.id !== studentId) {
    return { ok: false, success: false, error: 'An account with this email address already exists.' };
  }

  const oldEmail = student.email;
  const now = new Date().toISOString();
  const updated = updateProfile(studentId, {
    email: normalized,
    email_verified: false,
    updated_at: now,
  });

  insertAuditLog({
    id: uuid(),
    user_id: actorId,
    action: 'student_email_updated',
    entity_type: 'profile',
    entity_id: studentId,
    details: { old_email: oldEmail, new_email: normalized, actor_id: actorId },
    created_at: now,
  });

  return { ok: true, success: true, profile: updated || undefined };
}

export function registerStudentAccount(data: {
  first_name: string;
  last_name: string;
  age: number;
  college_name: string;
  email: string;
  password?: string;
  consent_tracking: boolean;
  consent_guardian?: boolean;
  role?: any;
  status?: any;
}): { ok: boolean; success: boolean; profile?: Profile; error?: string } {
  const settings = getSettings();
  if (settings.registration_enabled === false || settings.registrations_open === false) {
    return { ok: false, success: false, error: 'Student self-registration is currently paused.' };
  }

  const burstRl = hitRateLimit('registration:burst', 10, 10 * 60 * 1000);
  if (!burstRl.allowed) {
    return { ok: false, success: false, error: 'Registration rate limit reached. Please wait a few minutes before trying again.' };
  }

  // Daily cap on new accounts (default 50, configurable) per Amendment 1 item 5
  const now = new Date().toISOString();
  const todayDateStr = now.slice(0, 10);
  const studentsToday = getAllStudents().filter(s => s.created_at && s.created_at.slice(0, 10) === todayDateStr);
  const dailyCap = settings.daily_registration_cap ?? 50;
  if (studentsToday.length >= dailyCap) {
    return {
      ok: false,
      success: false,
      error: `Daily registration limit reached (${dailyCap} accounts). Please try again tomorrow.`,
    };
  }

  // Case-insensitive unique email check with neutral error message per Amendment 1 item 4.b
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = getProfileByEmail(normalizedEmail);
  if (existing) {
    return { ok: false, success: false, error: 'Registration failed. An account with this email address cannot be registered.' };
  }

  const studentId = uuid();
  const monitor = getMonitorProfile();

  // Lifecycle status: active by default, or pending_approval if require_approval is true per Amendment 1 items 2 & 3
  const initialStatus: AccountStatus = settings.require_approval ? 'pending_approval' : 'active';

  const newProfile: Profile = {
    id: studentId,
    role: 'student', // Server-enforced, client-supplied role strictly ignored
    status: initialStatus, // Server-enforced, client-supplied status strictly ignored
    name: `${data.first_name} ${data.last_name}`.trim(),
    first_name: data.first_name,
    last_name: data.last_name,
    age: data.age,
    college_name: data.college_name,
    email: normalizedEmail,
    email_verified: false, // Unverified email stored as false per Amendment 1 item 4.a
    password: data.password || '$pbkdf2-sha256$i=100000$62c7ebaa18fed95a53478775acc0aa28$0a47573d0a03d28c0f35dba8c5a3b717023d29dd8bb73fb105c5d7e17fbaeded',
    linked_account_id: monitor?.id || null,
    requested_at: now,
    email_verified_at: null,
    consent_tracking_at: data.consent_tracking ? now : null,
    consent_guardian_at: data.consent_guardian ? now : null,
    time_tracking_acknowledged: false, // Triggers first-login tracking notice
    stopwatch_visible: true,
    incomplete_profile: false,
    created_at: now,
    updated_at: now,
  };

  insertRow<Profile>('profiles', newProfile);

  // In-app notice for monitor per Amendment 1 input (c)
  if (settings.registration_in_app_notice !== false) {
    insertRow('alerts', {
      id: uuid(),
      user_id: monitor?.id || 'monitor-1',
      severity: 'info',
      title: 'New Student Registered',
      message: `Student ${newProfile.name} (${newProfile.email}) has registered with instant access.`,
      status: 'open',
      source: 'registration',
      created_at: now,
    });
  }

  insertAuditLog({
    id: uuid(),
    user_id: studentId,
    action: 'student_registered',
    entity_type: 'profile',
    entity_id: studentId,
    details: { email: newProfile.email, status: initialStatus, requested_at: now },
    created_at: now,
  });

  return { ok: true, success: true, profile: newProfile };
}

export function verifyStudentEmail(idOrEmail: string): { ok: boolean; success: boolean; profile?: Profile | null; error?: string } {
  const p = getProfile(idOrEmail) || getProfileByEmail(idOrEmail);
  if (!p || p.role !== 'student') return { ok: false, success: false, error: 'Student not found.' };
  const now = new Date().toISOString();
  const updated = updateProfile(p.id, {
    status: 'pending_approval',
    email_verified_at: now,
  }, 'monitor');

  insertAuditLog({
    id: uuid(),
    user_id: p.id,
    action: 'email_verified',
    entity_type: 'profile',
    entity_id: p.id,
    details: { verified_at: now },
    created_at: now,
  });

  return { ok: true, success: true, profile: updated || undefined };
}

// ---- Settings ----

const isTestEnv =
  (typeof process !== 'undefined' && Boolean((process as any).env?.VITEST)) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test');

export function getSettings(): Settings {
  const all = getTable<Settings>('settings');
  const defaultImportedMocks = !isTestEnv;
  if (all.length === 0) {
    const defaults: Settings = {
      id: uuid(),
      ideal_time_basic: 60,
      ideal_time_medium: 120,
      ideal_time_advanced: 180,
      idle_timeout: 300,
      registrations_open: true,
      registration_enabled: true,
      require_approval: false,
      daily_registration_cap: 50,
      registration_in_app_notice: true,
      max_pending_registrations: 200,
      exam_conditions_adjustment_enabled: false,
      allow_physical_keypad_a11y: false,
      include_jee_advanced_in_practice: false,
      archive_mode: false,
      stale_percentile_map_threshold_years: 2,
      auto_expiry_log_days: 14,
      auto_expiry_backup_days: 30,
      flag_e10_ux_completeness: false,
      flag_e9_performance_and_visual_polish: false,
      flag_e13_enhanced_testing: false,
      flag_e12_integrity_resilience: false,
      flag_e11_account_security: false,
      flag_e1_adaptive_repetition: false,
      flag_e6_calibration_analytics: false,
      flag_e3_revision_cards: false,
      flag_e5_advanced_exam_analytics: false,
      flag_e8_custom_reporting: false,
      flag_e7_exam_auto_composer: false,
      flag_e4_question_search_embeddings: false,
      flag_e2_concept_map: false,
      flag_g3_practice_scratchpad: false,
      flag_imported_mocks_enabled: defaultImportedMocks,
      updated_at: new Date().toISOString(),
    };
    insertRow('settings', defaults);
    return defaults;
  }
  const s = all[0];
  return {
    ...s,
    registrations_open: s.registrations_open ?? true,
    registration_enabled: s.registration_enabled ?? (s.registrations_open ?? true),
    require_approval: s.require_approval ?? false,
    daily_registration_cap: s.daily_registration_cap ?? 50,
    registration_in_app_notice: s.registration_in_app_notice ?? true,
    max_pending_registrations: s.max_pending_registrations ?? 200,
    exam_conditions_adjustment_enabled: s.exam_conditions_adjustment_enabled ?? false,
    allow_physical_keypad_a11y: s.allow_physical_keypad_a11y ?? false,
    include_jee_advanced_in_practice: s.include_jee_advanced_in_practice ?? false,
    archive_mode: s.archive_mode ?? false,
    stale_percentile_map_threshold_years: s.stale_percentile_map_threshold_years ?? 2,
    auto_expiry_log_days: s.auto_expiry_log_days ?? 14,
    auto_expiry_backup_days: s.auto_expiry_backup_days ?? 30,
    flag_e10_ux_completeness: s.flag_e10_ux_completeness ?? false,
    flag_e9_performance_and_visual_polish: s.flag_e9_performance_and_visual_polish ?? false,
    flag_e13_enhanced_testing: s.flag_e13_enhanced_testing ?? false,
    flag_e12_integrity_resilience: s.flag_e12_integrity_resilience ?? false,
    flag_e11_account_security: s.flag_e11_account_security ?? false,
    flag_e1_adaptive_repetition: s.flag_e1_adaptive_repetition ?? false,
    flag_e6_calibration_analytics: s.flag_e6_calibration_analytics ?? false,
    flag_e3_revision_cards: s.flag_e3_revision_cards ?? false,
    flag_e5_advanced_exam_analytics: s.flag_e5_advanced_exam_analytics ?? false,
    flag_e8_custom_reporting: s.flag_e8_custom_reporting ?? false,
    flag_e7_exam_auto_composer: s.flag_e7_exam_auto_composer ?? false,
    flag_e4_question_search_embeddings: s.flag_e4_question_search_embeddings ?? false,
    flag_e2_concept_map: s.flag_e2_concept_map ?? false,
    flag_g3_practice_scratchpad: s.flag_g3_practice_scratchpad ?? false,
    flag_imported_mocks_enabled: s.flag_imported_mocks_enabled ?? defaultImportedMocks,
  };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = getSettings();
  return updateRow<Settings>('settings', s.id, { ...patch, updated_at: new Date().toISOString() })!;
}

// ---- Taxonomy ----

export function getSubjects(): Subject[] {
  const local = getTable<Subject>('subjects');
  const syl = getTable<SyllabusSubject>('syllabus_subjects');
  if (syl.length === 0) return local;
  const ids = new Set(local.map(s => s.id));
  const merged = [...local];
  for (const s of syl) {
    if (!ids.has(s.id)) {
      merged.push({ id: s.id, name: s.name });
      ids.add(s.id);
    }
  }
  return merged;
}

export function getChapters(subjectIdOrName?: string): Chapter[] {
  const local = getTable<Chapter>('chapters');
  const syl = getTable<SyllabusChapter>('syllabus_chapters');
  const ids = new Set(local.map(c => c.id));
  const merged = [...local];
  for (const c of syl) {
    if (!ids.has(c.id)) {
      merged.push({ id: c.id, subject_id: c.subject_id, name: c.name });
      ids.add(c.id);
    }
  }
  if (!subjectIdOrName) return merged;
  const subj = getSubjects().find(s => s.id === subjectIdOrName || s.name === subjectIdOrName);
  const sId = subj ? subj.id : subjectIdOrName;
  return merged.filter(c => c.subject_id === sId);
}

export function getTopics(): Topic[] {
  const local = getTable<Topic>('topics');
  const syl = getTable<SyllabusTopic>('syllabus_topics');
  if (syl.length === 0) return local;
  const ids = new Set(local.map(t => t.id));
  const merged = [...local];
  for (const t of syl) {
    if (!ids.has(t.id)) {
      merged.push({ id: t.id, chapter_id: t.chapter_id, name: t.name });
      ids.add(t.id);
    }
  }
  return merged;
}

function isValidName(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && trimmed !== '.' && trimmed !== '-' && trimmed !== 'undefined' && trimmed !== 'null';
}

export function getQuestionSubject(q: Question): string {
  const directSubj = (q as any).subject;
  if (isValidName(directSubj)) return directSubj.trim();
  const sId = q.subject_id;
  if (!sId || !isValidName(sId)) return 'Physics';
  const sylSub = getTable<SyllabusSubject>('syllabus_subjects').find(
    s => s.id === sId || s.name.toLowerCase() === sId.toLowerCase()
  );
  if (sylSub && isValidName(sylSub.name)) return sylSub.name;
  const subj = getSubjects().find(
    s => s.id === sId || s.name.toLowerCase() === sId.toLowerCase()
  );
  if (subj && isValidName(subj.name)) return subj.name;
  return sId.length < 30 && isValidName(sId) ? sId : 'Physics';
}

export function getQuestionChapter(q: Question): string {
  const directChap = (q as any).chapter;
  if (isValidName(directChap)) return directChap.trim();
  const cId = q.primary_chapter_id || q.chapter_id;
  if (!cId || !isValidName(cId)) return 'General Mechanics';
  const sylChap = getTable<SyllabusChapter>('syllabus_chapters').find(
    c => c.id === cId || c.external_id === cId || c.name.toLowerCase() === cId.toLowerCase()
  );
  if (sylChap && isValidName(sylChap.name)) return sylChap.name;
  const ch = getChapters().find(
    c => c.id === cId || (c as any).external_id === cId || c.name.toLowerCase() === cId.toLowerCase()
  );
  if (ch && isValidName(ch.name)) return ch.name;
  const masterCh = (syllabusMasterData as any)?.chapters?.find(
    (c: any) => c.id === cId || c.chapter?.toLowerCase() === cId.toLowerCase()
  );
  if (masterCh && isValidName(masterCh.chapter)) return masterCh.chapter;
  return 'General Chapter';
}

export function getQuestionTopic(q: Question): string {
  const directTopic = (q as any).topic;
  if (isValidName(directTopic)) return directTopic.trim();
  const directSubtopic = (q as any).subtopic;
  if (isValidName(directSubtopic)) return directSubtopic.trim();
  const tId = q.primary_topic_id || q.topic_id;
  if (!tId || !isValidName(tId)) {
    const ch = getQuestionChapter(q);
    return ch !== 'General Chapter' && ch !== 'General Mechanics' ? ch : 'Core Practice';
  }
  const sylTop = getTable<SyllabusTopic>('syllabus_topics').find(
    t => t.id === tId || t.slug === tId || t.name.toLowerCase() === tId.toLowerCase()
  );
  if (sylTop && isValidName(sylTop.name)) return sylTop.name;
  const top = getTopics().find(
    t => t.id === tId || (t as any).slug === tId || t.name.toLowerCase() === tId.toLowerCase()
  );
  if (top && isValidName(top.name)) return top.name;
  const importedTop = (importedTopicsData as any[])?.find(
    (t: any) => t.id === tId || t.slug === tId || t.name?.toLowerCase() === tId.toLowerCase()
  );
  if (importedTop && isValidName(importedTop.name)) return importedTop.name;
  const ch = getQuestionChapter(q);
  return ch !== 'General Chapter' && ch !== 'General Mechanics' ? ch : 'Core Practice';
}

export function getChaptersBySubject(subjectId: string): Chapter[] {
  return getChapters().filter(c => c.subject_id === subjectId);
}

export function getTopicsByChapter(chapterId: string): Topic[] {
  return getTopics().filter(t => t.chapter_id === chapterId);
}

export function findOrCreateSubject(name: string): Subject {
  const existing = getSubjects().find(s => s.name === name);
  if (existing) return existing;
  const s: Subject = { id: uuid(), name };
  return insertRow('subjects', s);
}

export function findOrCreateChapter(subjectId: string, name: string): Chapter {
  const existing = getChapters().find(c => c.subject_id === subjectId && c.name === name);
  if (existing) return existing;
  const c: Chapter = { id: uuid(), subject_id: subjectId, name };
  return insertRow('chapters', c);
}

export function insertChapter(c: Chapter): Chapter {
  return insertRow('chapters', c);
}

export function findOrCreateTopic(chapterId: string, name: string): Topic {
  const existing = getTopics().find(t => t.chapter_id === chapterId && t.name === name);
  if (existing) return existing;
  const t: Topic = { id: uuid(), chapter_id: chapterId, name };
  return insertRow('topics', t);
}

// ---- Papers ----

export function getPapers(): Paper[] { return getTable<Paper>('papers'); }
export function getPaper(id: string): Paper | null { return getPapers().find(p => p.id === id) ?? null; }

export function verifyPaperProfile(
  paperId: string,
  monitorId: string,
  profileId: string,
  informationBulletinRef: string
): Paper {
  const paper = getPaper(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);
  const profile = getPatternProfile(profileId);
  if (!profile) throw new Error(`Pattern profile ${profileId} not found`);

  const updated = updateRow<Paper>('papers', paperId, {
    pattern_profile_id: profileId,
    profile_verified_at: new Date().toISOString(),
    profile_verified_by: monitorId,
    information_bulletin_ref: informationBulletinRef,
  });

  if (!updated) throw new Error('Failed to update paper');

  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'verify_paper_profile',
    entity_type: 'paper',
    entity_id: paperId,
    details: {
      profileId,
      profileName: profile.name,
      informationBulletinRef,
    },
    created_at: new Date().toISOString(),
  });

  return updated;
}

export function transitionPaperStatus(
  paperId: string,
  newStatus: PaperStatus,
  monitorId: string,
  note?: string
): Paper {
  const paper = getPaper(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);

  // Hard Gate: Cannot publish without verified pattern profile
  if (newStatus === 'published') {
    if (!paper.profile_verified_at || !paper.pattern_profile_id) {
      throw new Error(
        `Cannot publish paper ${paper.exam} ${paper.year} ${paper.shift}: Pattern profile is unverified. Verify profile against official Information Bulletin first.`
      );
    }
  }

  const prevStatus = paper.status || 'registered';
  const updated = updateRow<Paper>('papers', paperId, {
    status: newStatus,
  });

  if (!updated) throw new Error('Failed to update paper status');

  insertAuditLog({
    id: uuid(),
    user_id: monitorId,
    action: 'paper_status_transition',
    entity_type: 'paper',
    entity_id: paperId,
    details: {
      from: prevStatus,
      to: newStatus,
      note: note || null,
    },
    created_at: new Date().toISOString(),
  });

  return updated;
}

export function findOrCreatePaper(rec: PilotQuestionRecord['paper'], source: PilotQuestionRecord['source'], aksource: PilotQuestionRecord['answer_key_source']): Paper {
  const papers = getPapers();
  const existing = papers.find(p =>
    p.exam === rec.exam && p.year === rec.year &&
    p.session === rec.session && p.date === rec.date && p.shift === rec.shift
  );
  if (existing) return existing;
  const p: Paper = {
    id: uuid(),
    exam: rec.exam,
    year: rec.year,
    session: rec.session,
    date: rec.date,
    shift: rec.shift,
    source,
    source_url: null,
    answer_key_source: aksource,
    pattern_profile_id: null,
    created_at: new Date().toISOString(),
  };
  return insertRow('papers', p);
}

export function insertPaper(p: Paper): Paper {
  return insertRow('papers', p);
}

// ---- Pattern Profiles (Editor supported) ----

export function getPatternProfiles(): PatternProfile[] { return getTable<PatternProfile>('pattern_profiles'); }
export function getPatternProfile(id: string): PatternProfile | null {
  return getPatternProfiles().find(pp => pp.id === id) ?? null;
}
export function insertPatternProfile(pp: PatternProfile): PatternProfile { return insertRow('pattern_profiles', pp); }
export function updatePatternProfile(id: string, patch: Partial<PatternProfile>): PatternProfile | null {
  return updateRow<PatternProfile>('pattern_profiles', id, patch);
}
export function deletePatternProfile(id: string): boolean {
  return deleteRow<PatternProfile>('pattern_profiles', id);
}

// ---- Questions ----

export function getAllQuestions(): Question[] {
  const local = getTable<Question>('questions');
  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return local;
  const imported = _importedMocksModule.getImportedQuestions();
  if (local.length === 0) return imported;

  const localMap = new Map(local.map(q => [q.id, q]));
  const merged = [...local];
  for (const q of imported) {
    if (!localMap.has(q.id)) {
      merged.push(q);
    }
  }
  return merged;
}

/** Student sees only visible questions */
export function getVisibleQuestions(studentId?: string): Question[] {
  if (studentId) {
    const p = getProfile(studentId);
    if (p && p.role === 'student' && p.status && p.status !== 'approved' && p.status !== 'active') {
      return [];
    }
  }
  return getAllQuestions().filter(isQuestionVisible);
}

export function getQuestion(id: string): Question | null {
  if (!_questionIdMap) {
    const all = getAllQuestions();
    _questionIdMap = new Map<string, Question | null>(all.map(q => [q.id, q]));
  }
  if (_questionIdMap.has(id)) {
    return _questionIdMap.get(id) || null;
  }

  const local = getTable<Question>('questions');
  const found = local.find(q => q.id === id);
  if (found) {
    _questionIdMap.set(id, found);
    return found;
  }

  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) {
    _questionIdMap.set(id, null);
    return null;
  }
  const imp = _importedMocksModule.getImportedQuestion(id);
  _questionIdMap.set(id, imp);
  return imp;
}

export function insertQuestion(q: Question): Question {
  _questionIdMap = null;
  return insertRow('questions', q);
}
export function updateQuestion(id: string, patch: Partial<Question>): Question | null {
  _questionIdMap = null;
  return updateRow<Question>('questions', id, { ...patch, updated_at: new Date().toISOString() });
}

/** Get questions for a practice set: filter by topic, difficulty, visibility */
export function getQuestionsForPractice(
  topicId: string,
  difficulty: Difficulty | 'Mixed',
  excludeIds: string[] = []
): Question[] {
  const settings = getSettings();
  const papers = getPapers();
  const paperMap = new Map(papers.map(p => [p.id, p]));

  return getVisibleQuestions().filter(q => {
    const matchesTopic = q.primary_topic_id === topicId || q.topic_id === topicId;
    const matchesChapter = q.primary_chapter_id === topicId || q.chapter_id === topicId;
    if (!matchesTopic && !matchesChapter) return false;

    if (difficulty !== 'Mixed' && q.difficulty !== difficulty) return false;
    if (excludeIds.includes(q.id)) return false;

    // Phase 6 M2: JEE Advanced questions isolated unless monitor explicitly enables
    const p = paperMap.get(q.paper_id);
    const isAdv = (q as any).source === 'jee_advanced' || p?.source === 'jee_advanced';
    if (isAdv && !settings.include_jee_advanced_in_practice) return false;

    return true;
  });
}

// ---- Question Answers & Solutions (CRITICAL PHASE 2 ACCESS CONTROL) ----

export function getAllQuestionAnswers(): QuestionAnswer[] {
  const local = getTable<QuestionAnswer>('question_answers');
  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return local;
  const imported = _importedMocksModule.getImportedQuestionAnswers();
  if (local.length === 0) return imported;

  const localMap = new Map(local.map(qa => [qa.question_id, qa]));
  const merged = [...local];
  for (const qa of imported) {
    if (!localMap.has(qa.question_id)) {
      merged.push(qa);
    }
  }
  return merged;
}

/**
 * Student: Only get answer if submitted in Practice or completed Exam
 * AND student does NOT currently have an open Exam that contains this question!
 */
export function getQuestionAnswer(questionId: string, studentId: string): QuestionAnswer | null {
  const profile = getProfile(studentId);
  if (profile && profile.role === 'student' && profile.status && profile.status !== 'approved' && profile.status !== 'active') {
    return null;
  }

  // CRITICAL CHECK: Open exam containing this question blocks release
  const openExam = getTable<Attempt>('attempts').find(a =>
    a.student_id === studentId && a.mode === 'exam' && a.ended_at === null
  );
  if (openExam && openExam.exam_id) {
    const examQuestions = getTable<ExamQuestion>('exam_questions').filter(eq => eq.exam_id === openExam.exam_id);
    if (examQuestions.some(eq => eq.question_id === questionId)) {
      return null; // WITHHELD!
    }
  }

  const responses = getTable<Response>('responses');
  const hasSubmitted = responses.some(r => {
    if (r.question_id !== questionId || r.student_id !== studentId || r.submitted_at === null) return false;
    const attempt = getTable<Attempt>('attempts').find(a => a.id === r.attempt_id);
    // In practice mode, submitted question answer is immediately available
    if (attempt?.mode === 'practice') return true;
    // Must be a finished attempt
    return attempt ? attempt.ended_at !== null : true;
  });

  if (!hasSubmitted) return null;

  const local = getTable<QuestionAnswer>('question_answers');
  const found = local.find(qa => qa.question_id === questionId);
  if (found) return found;

  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return null;
  return _importedMocksModule.getImportedAnswer(questionId);
}

/** Monitor: get any answer */
export function getQuestionAnswerMonitor(questionId: string): QuestionAnswer | null {
  const local = getTable<QuestionAnswer>('question_answers');
  const found = local.find(qa => qa.question_id === questionId);
  if (found) return found;

  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return null;
  return _importedMocksModule.getImportedAnswer(questionId);
}

export function insertQuestionAnswer(qa: QuestionAnswer): QuestionAnswer { return insertRow('question_answers', qa); }
export function updateQuestionAnswer(id: string, patch: Partial<QuestionAnswer>): QuestionAnswer | null {
  return updateRow<QuestionAnswer>('question_answers', id, patch);
}

// ---- Question Translations (Phase 6 M4: Bilingual NTA Support) ----

export function getAllQuestionTranslations(): QuestionTranslation[] {
  return getTable<QuestionTranslation>('question_translations');
}

export function getQuestionTranslations(questionId?: string): QuestionTranslation[] {
  const all = getAllQuestionTranslations();
  if (questionId) return all.filter(t => t.question_id === questionId);
  return all;
}

export function getQuestionTranslation(questionId: string, language: 'english' | 'hindi'): QuestionTranslation | null {
  return getAllQuestionTranslations().find(t => t.question_id === questionId && t.language === language) ?? null;
}

export function upsertQuestionTranslation(translation: Omit<QuestionTranslation, 'id' | 'created_at'> & { id?: string }): QuestionTranslation {
  const existing = getQuestionTranslation(translation.question_id, translation.language);
  if (existing) {
    return updateRow<QuestionTranslation>('question_translations', existing.id, {
      question_text: translation.question_text,
      options: translation.options,
    })!;
  }
  const row: QuestionTranslation = {
    id: translation.id || uuid(),
    question_id: translation.question_id,
    language: translation.language,
    question_text: translation.question_text,
    options: translation.options,
    created_at: new Date().toISOString(),
  };
  return insertRow('question_translations', row);
}

export function getQuestionTextInLanguage(
  question: Question,
  language: 'english' | 'hindi' = 'english'
): { text: string; options: string[] | null; isTranslated: boolean } {
  if (language === 'hindi') {
    const translation = getQuestionTranslation(question.id, 'hindi');
    if (translation && translation.question_text.trim() !== '') {
      return {
        text: translation.question_text,
        options: translation.options || question.options,
        isTranslated: true,
      };
    }
  }
  return {
    text: question.question_text,
    options: question.options,
    isTranslated: false,
  };
}

export function getAllSolutions(): Solution[] {
  const local = getTable<Solution>('solutions');
  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return local;
  const imported = _importedMocksModule.getImportedSolutions();
  if (local.length === 0) return imported;

  const localMap = new Map(local.map(s => [s.question_id, s]));
  const merged = [...local];
  for (const s of imported) {
    if (!localMap.has(s.question_id)) {
      merged.push(s);
    }
  }
  return merged;
}

/**
 * Student: Only get solution if submitted in Practice or completed Exam
 * AND student does NOT currently have an open Exam containing this question!
 */
export function getSolution(questionId: string, studentId: string): Solution | null {
  const profile = getProfile(studentId);
  if (profile && profile.role === 'student' && profile.status && profile.status !== 'approved' && profile.status !== 'active') {
    return null;
  }

  // CRITICAL CHECK: Open exam containing this question blocks release
  const openExam = getTable<Attempt>('attempts').find(a =>
    a.student_id === studentId && a.mode === 'exam' && a.ended_at === null
  );
  if (openExam && openExam.exam_id) {
    const examQuestions = getTable<ExamQuestion>('exam_questions').filter(eq => eq.exam_id === openExam.exam_id);
    if (examQuestions.some(eq => eq.question_id === questionId)) {
      return null; // WITHHELD!
    }
  }

  const responses = getTable<Response>('responses');
  const hasSubmitted = responses.some(r => {
    if (r.question_id !== questionId || r.student_id !== studentId || r.submitted_at === null) return false;
    const attempt = getTable<Attempt>('attempts').find(a => a.id === r.attempt_id);
    // In practice mode, submitted question solution is immediately available
    if (attempt?.mode === 'practice') return true;
    return attempt ? attempt.ended_at !== null : true;
  });

  if (!hasSubmitted) return null;

  const local = getTable<Solution>('solutions');
  const found = local.find(s => s.question_id === questionId);
  if (found) return found;

  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return null;
  return _importedMocksModule.getImportedSolution(questionId);
}

/** Monitor: get any solution */
export function getSolutionMonitor(questionId: string): Solution | null {
  const local = getTable<Solution>('solutions');
  const found = local.find(s => s.question_id === questionId);
  if (found) return found;

  const settings = getSettings();
  if (!settings.flag_imported_mocks_enabled || !_importedMocksModule) return null;
  return _importedMocksModule.getImportedSolution(questionId);
}

export function insertSolution(s: Solution): Solution { return insertRow('solutions', s); }
export function updateSolution(id: string, patch: Partial<Solution>): Solution | null {
  return updateRow<Solution>('solutions', id, { ...patch, updated_at: new Date().toISOString() });
}

// ---- Attempts ----

export function getAttempts(): Attempt[] { return getTable<Attempt>('attempts'); }
export function getAttemptsByStudent(studentId: string): Attempt[] {
  return getAttempts().filter(a => a.student_id === studentId);
}
export function assertNotArchiveMode(): void {
  if (isArchiveModeActive()) {
    throw new Error('ARCHIVE_MODE_ACTIVE: The application is in read-only archive mode. Student mutations are disabled.');
  }
}

export function getAttempt(id: string): Attempt | null {
  return getAttempts().find(a => a.id === id) ?? null;
}
export function insertAttempt(a: Attempt): Attempt {
  assertNotArchiveMode();
  return insertRow('attempts', a);
}
export function updateAttempt(id: string, patch: Partial<Attempt>): Attempt | null {
  assertNotArchiveMode();
  return updateRow<Attempt>('attempts', id, patch);
}

// ---- Responses ----

export function getResponses(): Response[] { return getTable<Response>('responses'); }
export function getResponsesByAttempt(attemptId: string): Response[] {
  return getResponses().filter(r => r.attempt_id === attemptId);
}
export function getResponsesByStudent(studentId: string): Response[] {
  return getResponses().filter(r => r.student_id === studentId);
}
export function getResponse(id: string): Response | null {
  return getResponses().find(r => r.id === id) ?? null;
}
export function insertResponse(r: Response): Response {
  assertNotArchiveMode();
  return insertRow('responses', r);
}
export function updateResponse(id: string, patch: Partial<Response>): Response | null {
  assertNotArchiveMode();
  return updateRow<Response>('responses', id, { ...patch, updated_at: new Date().toISOString() });
}

// ---- Practiced Questions ----

export function getPracticedQuestions(studentId?: string): PracticedQuestion[] {
  const all = getTable<PracticedQuestion>('practiced_questions');
  if (studentId) return all.filter(pq => pq.student_id === studentId);
  return all;
}
export function getPracticedQuestionsByStudent(studentId: string): PracticedQuestion[] {
  return getPracticedQuestions().filter(pq => pq.student_id === studentId);
}
export function insertPracticedQuestion(pq: PracticedQuestion): PracticedQuestion {
  assertNotArchiveMode();
  return insertRow<PracticedQuestion>('practiced_questions', pq);
}

export function getPracticedQuestionsForExam(studentId: string, subjectId?: string, chapterId?: string): Question[] {
  const pqs = getPracticedQuestionsByStudent(studentId);
  const pqIds = new Set(pqs.map(p => p.question_id));
  const questions = getAllQuestions().filter(q => pqIds.has(q.id));
  return questions.filter(q => {
    if (subjectId && q.subject_id !== subjectId) return false;
    if (chapterId && q.chapter_id !== chapterId) return false;
    return true;
  });
}

/**
 * Phase 6 M1: Returns eligible questions for Exam construction, including fresh questions when enabled.
 * Excludes dropped, disputed keys, and unreviewed batches.
 */
export function getEligibleQuestionsForExam(
  studentId: string,
  allowFresh = false,
  subjectId?: string,
  chapterId?: string,
  includeAdvanced = false
): Array<Question & { is_fresh: boolean }> {
  const pqs = getPracticedQuestionsByStudent(studentId);
  const pqIds = new Set(pqs.map(p => p.question_id));
  const papers = getPapers();
  const paperMap = new Map(papers.map(p => [p.id, p]));

  const questions = getAllQuestions().filter(q => {
    if (!q.is_active || q.answer_status === 'Dropped' || q.needs_key_review) return false;
    if (subjectId && q.subject_id !== subjectId) return false;
    if (chapterId && q.chapter_id !== chapterId) return false;
    if (!allowFresh && !pqIds.has(q.id)) return false;

    // Filter out JEE Advanced unless explicitly included
    const p = paperMap.get(q.paper_id);
    const isAdv = (q as any).source === 'jee_advanced' || p?.source === 'jee_advanced';
    if (isAdv && !includeAdvanced) return false;

    return true;
  });

  return questions.map(q => ({
    ...q,
    is_fresh: !pqIds.has(q.id),
  }));
}

/**
 * Phase 6 M1: Fresh question flags management (Monitor only)
 * RLS strictly hides rows from student queries.
 */
export function getExamQuestionFreshFlags(examId: string, callerRole = 'monitor'): Array<{ id: string; exam_id: string; question_id: string; is_fresh: boolean; created_at: string }> {
  if (callerRole === 'student') return [];
  return getTable<{ id: string; exam_id: string; question_id: string; is_fresh: boolean; created_at: string }>('exam_question_fresh_flags').filter(f => f.exam_id === examId);
}

export function setExamQuestionFreshFlags(examId: string, freshQuestionIds: string[]): void {
  const existing = getTable<{ id: string; exam_id: string; question_id: string; is_fresh: boolean; created_at: string }>('exam_question_fresh_flags').filter(f => f.exam_id !== examId);
  const newFlags = freshQuestionIds.map(qid => ({
    id: uuid(),
    exam_id: examId,
    question_id: qid,
    is_fresh: true,
    created_at: new Date().toISOString(),
  }));
  setTable('exam_question_fresh_flags', [...existing, ...newFlags]);
}

/**
 * First-Answer Rule (extended in Phase 6 Module M1):
 * - If the student has never answered this question before (in practice or exam),
 *   this answer becomes their official first_answer, with first_answer_source ('practice' or 'exam').
 * - If the student has already answered this question, first_answer and first_answer_source
 *   remain completely invariant. Only practice_attempts and last_result are updated.
 */
export function recordPracticedQuestion(
  studentId: string,
  questionId: string,
  answer: string,
  isCorrect: boolean,
  isExam = false
): PracticedQuestion {
  const existing = getPracticedQuestions().find(pq => pq.student_id === studentId && pq.question_id === questionId);
  if (existing) {
    return updateRow<PracticedQuestion>('practiced_questions', existing.id, {
      practice_attempts: existing.practice_attempts + 1,
      last_result: isCorrect,
      updated_at: new Date().toISOString(),
    })!;
  }
  const pq: PracticedQuestion = {
    id: uuid(),
    student_id: studentId,
    question_id: questionId,
    first_practiced_at: new Date().toISOString(),
    first_answer: answer,
    first_answer_source: isExam ? 'exam' : 'practice',
    practice_attempts: 1,
    last_result: isCorrect,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return insertRow('practiced_questions', pq);
}

// ---- Bookmarks ----

export function getBookmarks(studentId: string): Bookmark[] {
  return getTable<Bookmark>('bookmarks').filter(b => b.student_id === studentId);
}
export function isBookmarked(studentId: string, questionId: string): boolean {
  return getBookmarks(studentId).some(b => b.question_id === questionId);
}
export function toggleBookmark(studentId: string, questionId: string): boolean {
  assertNotArchiveMode();
  const existing = getTable<Bookmark>('bookmarks').find(b => b.student_id === studentId && b.question_id === questionId);
  if (existing) {
    deleteRow<Bookmark>('bookmarks', existing.id);
    return false;
  }
  insertRow<Bookmark>('bookmarks', {
    id: uuid(),
    student_id: studentId,
    question_id: questionId,
    note: null,
    created_at: new Date().toISOString(),
  });
  return true;
}

// ---- Resource Links (Phase 6 M5: Monitor-Curated Links) ----

export function validateResourceUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function getResourceLinks(): ResourceLink[] {
  return getTable<ResourceLink>('resource_links').sort((a, b) => a.display_order - b.display_order);
}

export function getResourceLink(id: string): ResourceLink | null {
  return getResourceLinks().find(l => l.id === id) ?? null;
}

export function insertResourceLink(link: ResourceLink): ResourceLink {
  const val = validateResourceUrl(link.url);
  if (!val.valid) throw new Error(val.error);
  return insertRow('resource_links', link);
}

export function updateResourceLink(id: string, patch: Partial<ResourceLink>): ResourceLink | null {
  if (patch.url) {
    const val = validateResourceUrl(patch.url);
    if (!val.valid) throw new Error(val.error);
  }
  return updateRow<ResourceLink>('resource_links', id, { ...patch, updated_at: new Date().toISOString() });
}

export function deleteResourceLink(id: string): boolean {
  return deleteRow<ResourceLink>('resource_links', id);
}

/**
 * Retrieves resource links for a question.
 * CRITICAL EXAM SHIELD: If studentId has an active open Exam attempt containing this question,
 * resource links are STRICTLY WITHHELD (returns []).
 */
export function getResourceLinksForQuestion(questionId: string, studentId?: string): ResourceLink[] {
  if (studentId) {
    const openExam = getTable<Attempt>('attempts').find(
      a => a.student_id === studentId && a.mode === 'exam' && a.ended_at === null
    );
    if (openExam && openExam.exam_id) {
      const examQuestions = getTable<ExamQuestion>('exam_questions').filter(
        eq => eq.exam_id === openExam.exam_id
      );
      if (examQuestions.some(eq => eq.question_id === questionId)) {
        return []; // Strictly withheld during active exam!
      }
    }
  }

  const q = getQuestion(questionId);
  return getResourceLinks().filter(l => {
    if (l.question_id === questionId) return true;
    if (q && q.topic_id && l.topic_id === q.topic_id) return true;
    if (q && q.chapter_id && l.chapter_id === q.chapter_id) return true;
    return false;
  });
}

export function getResourceLinksForTopic(topicId: string): ResourceLink[] {
  return getResourceLinks().filter(l => l.topic_id === topicId);
}

export function getResourceLinksForChapter(chapterId: string): ResourceLink[] {
  return getResourceLinks().filter(l => l.chapter_id === chapterId);
}

// ---- Visits (monitor-only reads, student inserts) ----

export function insertVisit(v: Visit): Visit {
  assertNotArchiveMode();
  return insertRow('visits', v);
}
export function updateVisit(id: string, patch: Partial<Visit>): Visit | null {
  assertNotArchiveMode();
  return updateRow<Visit>('visits', id, patch);
}
export function getAllVisits(): Visit[] { return getTable<Visit>('visits'); }
export function getVisitsByResponse(responseId: string): Visit[] {
  return getAllVisits().filter(v => v.response_id === responseId);
}
export function getVisitsByStudent(studentId: string): Visit[] {
  return getAllVisits().filter(v => v.student_id === studentId);
}

// ---- Pause Events ----

export function insertPauseEvent(pe: PauseEvent): PauseEvent { return insertRow('pause_events', pe); }
export function updatePauseEvent(id: string, patch: Partial<PauseEvent>): PauseEvent | null {
  return updateRow<PauseEvent>('pause_events', id, patch);
}
export function getAllPauseEvents(): PauseEvent[] { return getTable<PauseEvent>('pause_events'); }

// ---- Solution Views ----

export function insertSolutionView(sv: SolutionView): SolutionView { return insertRow('solution_views', sv); }
export function getAllSolutionViews(): SolutionView[] { return getTable<SolutionView>('solution_views'); }

// ---- Flag Reports ----

export function insertFlagReport(fr: FlagReport): FlagReport { return insertRow('flag_reports', fr); }
export function getFlagReports(): FlagReport[] { return getTable<FlagReport>('flag_reports'); }
export function updateFlagReport(id: string, patch: Partial<FlagReport>): FlagReport | null {
  return updateRow<FlagReport>('flag_reports', id, { ...patch, updated_at: new Date().toISOString() });
}

// ---- Audit Log ----

export function insertAuditLog(log: AuditLog): AuditLog { return insertRow('audit_log', log); }
export function getAuditLogs(): AuditLog[] { return getTable<AuditLog>('audit_log'); }

// ---- Figure Assets ----

export function getFigureAssets(): FigureAsset[] { return getTable<FigureAsset>('figure_assets'); }
export function insertFigureAsset(fa: FigureAsset): FigureAsset { return insertRow('figure_assets', fa); }

// ============================================================
// PHASE 2: EXAMS & TEST BUILDER
// ============================================================

export function getExams(): Exam[] { return getTable<Exam>('exams'); }
export function getExam(id: string): Exam | null { return getExams().find(e => e.id === id) ?? null; }

export function getPublishedExams(studentId?: string): Exam[] {
  return getExams().filter(e => {
    if (e.status !== 'published' || e.is_template) return false;
    if (studentId && e.student_id && e.student_id !== studentId) return false;
    return true;
  });
}

export function insertExam(exam: Exam): Exam { return insertRow('exams', exam); }

export function updateExam(id: string, patch: Partial<Exam>): Exam | null {
  const existing = getExam(id);
  if (!existing) return null;
  // Enforce published immutability: published exams cannot be edited!
  if (existing.status === 'published') {
    if (patch.name !== undefined || patch.duration_minutes !== undefined || patch.pattern_profile_id !== undefined || patch.grace_period_seconds !== undefined) {
      throw new Error('Published exams cannot be modified. Create a copy to make changes.');
    }
  }
  return updateRow<Exam>('exams', id, { ...patch, updated_at: new Date().toISOString() });
}

export function copyExam(id: string, newName?: string): Exam {
  const src = getExam(id);
  if (!src) throw new Error('Source exam not found');
  const newExamId = uuid();
  const copy: Exam = {
    ...src,
    id: newExamId,
    name: newName || `${src.name} (Copy)`,
    status: 'draft',
    is_template: false,
    copy_of_id: src.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  insertExam(copy);

  // Copy exam questions
  const srcQuestions = getExamQuestions(src.id);
  srcQuestions.forEach(sq => {
    insertExamQuestion({
      id: uuid(),
      exam_id: newExamId,
      question_id: sq.question_id,
      subject_id: sq.subject_id,
      chapter_id: sq.chapter_id,
      section: sq.section,
      order_index: sq.order_index,
      created_at: new Date().toISOString(),
    });
  });

  return copy;
}

export function getExamQuestions(examId: string): ExamQuestion[] {
  return getTable<ExamQuestion>('exam_questions')
    .filter(eq => eq.exam_id === examId)
    .sort((a, b) => a.order_index - b.order_index);
}

/**
 * Student access to Exam questions:
 * Student can read questions ONLY after an attempt has been created for them!
 */
export function getExamQuestionsForStudent(examId: string, studentId: string): Question[] {
  const attempt = getTable<Attempt>('attempts').find(a => a.exam_id === examId && a.student_id === studentId);
  if (!attempt) {
    throw new Error('Access denied: You must start an attempt before viewing Exam questions.');
  }
  const eqList = getExamQuestions(examId);
  const qMap = new Map(getAllQuestions().map(q => [q.id, q]));
  return eqList.map(eq => qMap.get(eq.question_id)!).filter(Boolean);
}

export function insertExamQuestion(eq: ExamQuestion): ExamQuestion { return insertRow('exam_questions', eq); }

export function setExamQuestions(examId: string, questionsList: Array<{ questionId: string; subjectId: string; chapterId: string; section: 'A' | 'B' }>): void {
  const existing = getTable<ExamQuestion>('exam_questions');
  const filtered = existing.filter(eq => eq.exam_id !== examId);
  const newItems: ExamQuestion[] = questionsList.map((q, idx) => ({
    id: uuid(),
    exam_id: examId,
    question_id: q.questionId,
    subject_id: q.subjectId,
    chapter_id: q.chapterId,
    section: q.section,
    order_index: idx + 1,
    created_at: new Date().toISOString(),
  }));
  setTable('exam_questions', [...filtered, ...newItems]);
  updateRow<Exam>('exams', examId, {
    total_questions: newItems.length,
    max_marks: newItems.length * 4,
    updated_at: new Date().toISOString(),
  });
}

// ============================================================
// PHASE 2: SERVER FUNCTIONS & SCORING LOGIC
// ============================================================

/**
 * Start an Exam attempt (Enforces 1 attempt rule and reload rule)
 */
export function startExamAttempt(examId: string, studentId: string): { attempt: Attempt; questions: Question[] } {
  const exam = getExam(examId);
  if (!exam) throw new Error('Exam not found');
  if (exam.status !== 'published') throw new Error('Exam is not published');
  if (exam.student_id && exam.student_id !== studentId) {
    throw new Error('Forbidden: Exam is not assigned to this student');
  }

  // Check one-attempt rule
  const existingAttempts = getTable<Attempt>('attempts').filter(a => a.exam_id === examId && a.student_id === studentId);
  if (existingAttempts.length > 0) {
    throw new Error('One attempt per Exam limit reached. You cannot retake this Exam.');
  }

  // Phase 5 Concurrency guard: check if another exam is active for this student
  const activeExam = getTable<Attempt>('attempts').find(a => a.student_id === studentId && a.mode === 'exam' && a.ended_at === null);
  if (activeExam) {
    throw new Error('Another exam is currently active. You cannot start multiple exams simultaneously.');
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);

  const attemptId = uuid();
  const attempt: Attempt = {
    id: attemptId,
    student_id: studentId,
    mode: 'exam',
    exam_id: examId,
    exam_duration_minutes: exam.duration_minutes,
    deadline_at: deadline.toISOString(),
    started_at: now.toISOString(),
    ended_at: null,
    score: null,
    total_marks: exam.max_marks,
    submit_reason: null,
    tab_switches_count: 0,
    created_at: now.toISOString(),
  };
  insertAttempt(attempt);

  // Initialize response rows with palette_status = 'not_visited'
  const eqList = getExamQuestions(examId);
  const qMap = new Map(getAllQuestions().map(q => [q.id, q]));
  const questions: Question[] = [];

  eqList.forEach((eq, idx) => {
    const q = qMap.get(eq.question_id);
    if (q) {
      questions.push(q);
      insertResponse({
        id: uuid(),
        attempt_id: attemptId,
        question_id: q.id,
        student_id: studentId,
        answer: null,
        is_correct: null,
        marks: null,
        submitted_at: null,
        level: q.difficulty,
        palette_status: idx === 0 ? 'not_answered' : 'not_visited', // First question starts as not_answered
        confidence: null,
        error_reason: null,
        visit_order: idx + 1,
        answer_changes_count: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }
  });

  return { attempt, questions };
}

/**
 * Save an Exam response during testing
 */
export function saveExamResponse(
  attemptId: string,
  questionId: string,
  studentId: string,
  answer: string | null,
  paletteStatus: PaletteStatus,
  language?: 'english' | 'hindi'
): Response {
  assertNotArchiveMode();
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error('Attempt not found');
  if (attempt.student_id !== studentId) {
    throw new Error('Forbidden: Attempt does not belong to this student');
  }
  if (attempt.ended_at !== null) throw new Error('Exam already completed');

  // Verify within deadline
  if (attempt.deadline_at && new Date() > new Date(attempt.deadline_at)) {
    submitExamAttempt(attemptId, studentId, 'time_up');
    throw new Error('Exam time is up');
  }

  const existingResp = getResponsesByAttempt(attemptId).find(r => r.question_id === questionId);
  if (!existingResp) throw new Error('Response record not found');

  const answerChanged = existingResp.answer !== answer;
  const changesCount = (existingResp.answer_changes_count || 0) + (answerChanged ? 1 : 0);

  const updated = updateResponse(existingResp.id, {
    answer,
    palette_status: paletteStatus,
    answer_changes_count: changesCount,
    ...(language ? { language } : {}),
  })!;

  return updated;
}

/**
 * Submit an Exam attempt (Server-side score calculation, releases solutions)
 */
export function submitExamAttempt(
  attemptId: string,
  studentId: string,
  reason: ExamSubmitReason,
  clientStamp?: string
): Attempt {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error('Attempt not found');
  if (studentId !== attempt.student_id && studentId !== 'system_watchdog') {
    const caller = getProfile(studentId);
    if (!caller || caller.role !== 'monitor') {
      throw new Error('Forbidden: Attempt does not belong to this student');
    }
  }
  if (attempt.ended_at !== null) return attempt; // already ended

  const now = new Date().toISOString();
  updateAttempt(attemptId, {
    ended_at: clientStamp || now,
    submit_reason: reason,
  });

  // Calculate score server-side
  const scoreResult = scoreExamAttempt(attemptId);

  // If auto-submitted (not normal student submit), create monitor notice
  if (reason !== 'submitted') {
    insertRow<MonitorNotice>('monitor_notices', {
      id: uuid(),
      exam_id: attempt.exam_id || null,
      attempt_id: attemptId,
      student_id: studentId,
      message: `Exam attempt was auto-submitted due to: ${reason.replace(/_/g, ' ')}.`,
      reason,
      read: false,
      created_at: now,
    });
  }

  // Record practised questions for exam questions (updates last_result, but NEVER first_answer)
  const responses = getResponsesByAttempt(attemptId);
  responses.forEach(r => {
    if (r.answer !== null) {
      recordPracticedQuestion(studentId, r.question_id, r.answer, r.is_correct ?? false, true);
    }
  });

  // Schedule wrong answers into Mistake Notebook
  responses.forEach(r => {
    if (r.submitted_at !== null && r.is_correct === false) {
      recordMistake(studentId, r.question_id, 'wrong_answer');
    }
  });

  return getAttempt(attemptId)!;
}

/**
 * Server Scoring Engine:
 * Supports pattern profiles, MCQ +4/-1, NVQ +4/0, Bonus (+4), Dropped (no penalty),
 * and NVQ attempt caps (e.g. answer any 5 of 10 in question number order).
 */
export function scoreExamAttempt(attemptId: string): { totalScore: number; maxScore: number } {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error('Attempt not found');

  const exam = attempt.exam_id ? getExam(attempt.exam_id) : null;
  const pp = exam?.pattern_profile_id ? getPatternProfile(exam.pattern_profile_id) : getPatternProfiles()[0];

  const marksCorrectMcq = exam?.marks_correct_mcq ?? pp?.marks_correct_mcq ?? 4;
  const marksWrongMcq = exam?.marks_wrong_mcq ?? pp?.marks_wrong_mcq ?? -1;
  const marksCorrectNvq = exam?.marks_correct_nvq ?? pp?.marks_correct_nvq ?? 4;
  const marksWrongNvq = exam?.marks_wrong_nvq ?? pp?.marks_wrong_nvq ?? 0;
  const marksUnattempted = exam?.marks_unattempted ?? pp?.marks_unattempted ?? 0;

  const responses = getResponsesByAttempt(attemptId);
  const qMap = new Map(getAllQuestions().map(q => [q.id, q]));
  const aMap = new Map(getAllQuestionAnswers().map(a => [a.question_id, a]));

  const examQuestions = exam ? getExamQuestions(exam.id) : [];
  const orderMap = new Map(examQuestions.map(eq => [eq.question_id, eq.order_index]));
  const sortedResponses = [...responses].sort((a, b) => {
    const oA = orderMap.get(a.question_id) ?? 0;
    const oB = orderMap.get(b.question_id) ?? 0;
    return oA - oB;
  });

  const nvqCap = pp?.nvq_attempt_limit_per_subject !== undefined
    ? pp.nvq_attempt_limit_per_subject
    : (pp?.nvq_attempt_rule === 'any_5_of_10' ? 5 : null);

  // Track NVQ attempt count per subject (to enforce e.g. 5 of 10 limit)
  const nvqCountPerSubject: Record<string, number> = {};

  let totalScore = 0;

  sortedResponses.forEach(r => {
    const q = qMap.get(r.question_id);
    const qa = aMap.get(r.question_id);
    if (!q || !qa) return;

    let isCorrect = false;
    let marks = marksUnattempted;

    // Handle Dropped: excluded or full marks
    if (qa.answer_status === 'Dropped') {
      isCorrect = true;
      marks = 0; // Dropped question ignored in scoring
    } else if (qa.answer_status === 'Bonus') {
      isCorrect = true;
      marks = q.type === 'MCQ' ? marksCorrectMcq : marksCorrectNvq;
    } else if (r.answer === null || r.answer.trim() === '') {
      // Unattempted
      isCorrect = false;
      marks = marksUnattempted;
    } else if (q.type === 'NVQ') {
      if (nvqCap !== null) {
        const count = nvqCountPerSubject[q.subject_id] || 0;
        if (count < nvqCap) {
          nvqCountPerSubject[q.subject_id] = count + 1;
          const correctVal = parseFloat(qa.correct_answer);
          const givenVal = parseFloat(r.answer.trim());
          isCorrect = !isNaN(correctVal) && !isNaN(givenVal) && Math.abs(correctVal - givenVal) < 0.01;
          marks = isCorrect ? marksCorrectNvq : marksWrongNvq;
        } else {
          // Exceeded attempt cap; do not count extra numerical answers (0 marks)
          marks = 0;
          isCorrect = false;
        }
      } else {
        const correctVal = parseFloat(qa.correct_answer);
        const givenVal = parseFloat(r.answer.trim());
        isCorrect = !isNaN(correctVal) && !isNaN(givenVal) && Math.abs(correctVal - givenVal) < 0.01;
        marks = isCorrect ? marksCorrectNvq : marksWrongNvq;
      }
    } else {
      // MCQ
      isCorrect = r.answer.trim().toUpperCase() === qa.correct_answer.trim().toUpperCase();
      marks = isCorrect ? marksCorrectMcq : marksWrongMcq;
    }

    totalScore += marks;
    updateResponse(r.id, {
      is_correct: isCorrect,
      marks,
      submitted_at: r.submitted_at || new Date().toISOString(),
    });
  });

  const nonDroppedCount = responses.filter(r => aMap.get(r.question_id)?.answer_status !== 'Dropped').length;
  const maxScore = nonDroppedCount * marksCorrectMcq;
  updateAttempt(attemptId, { score: totalScore, total_marks: maxScore });

  return { totalScore, maxScore };
}

/**
 * Server Watchdog:
 * Submits open exam attempts whose deadline + 60s has passed as 'no_signal'.
 */
export function examWatchdogCleanup(): { closedCount: number } {
  const attempts = getTable<Attempt>('attempts').filter(a =>
    a.mode === 'exam' &&
    a.ended_at === null &&
    a.deadline_at &&
    new Date() > new Date(new Date(a.deadline_at).getTime() + 60000)
  );

  attempts.forEach(a => {
    submitExamAttempt(a.id, a.student_id, 'no_signal');
  });

  return { closedCount: attempts.length };
}

/**
 * Sync late answers received after connection restored
 */
export function syncLateAnswers(
  attemptId: string,
  studentId: string,
  lateItems: Array<{ questionId: string; answer: string; timestamp: string }>
): { acceptedCount: number; rescored: boolean } {
  const attempt = getAttempt(attemptId);
  if (!attempt || !attempt.deadline_at) return { acceptedCount: 0, rescored: false };
  if (attempt.student_id !== studentId) {
    throw new Error('Forbidden: Attempt does not belong to this student');
  }

  // Only accept if within 24 hours of deadline
  const deadlineMs = new Date(attempt.deadline_at).getTime();
  const maxLateWindow = deadlineMs + 24 * 3600 * 1000;
  if (Date.now() > maxLateWindow) return { acceptedCount: 0, rescored: false };

  let acceptedCount = 0;
  const responses = getResponsesByAttempt(attemptId);

  lateItems.forEach(item => {
    const itemStampMs = new Date(item.timestamp).getTime();
    // Accept only if stamped within [start, deadline]
    if (itemStampMs <= deadlineMs) {
      const resp = responses.find(r => r.question_id === item.questionId);
      if (resp && (!resp.answer || resp.answer !== item.answer)) {
        updateResponse(resp.id, {
          answer: item.answer,
          palette_status: 'answered',
          submitted_at: item.timestamp,
        });
        acceptedCount++;
      }
    }
  });

  if (acceptedCount > 0) {
    scoreExamAttempt(attemptId);
    insertAuditLog({
      id: uuid(),
      user_id: studentId,
      action: 'sync_late_answers',
      entity_type: 'attempt',
      entity_id: attemptId,
      details: { acceptedCount, syncedAt: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
  }

  return { acceptedCount, rescored: acceptedCount > 0 };
}

// ============================================================
// PHASE 2: DIFFICULTY LEVELS & MASTERY LADDER
// ============================================================

export function calculateMasteryStats(studentId: string, topicId?: string): MasteryStats {
  const responses = getResponsesByStudent(studentId);
  const qMap = new Map(getAllQuestions().map(q => [q.id, q]));

  const filtered = responses.filter(r => {
    if (!r.submitted_at) return false;
    const q = qMap.get(r.question_id);
    if (!q) return false;
    if (topicId && q.topic_id !== topicId) return false;
    return true;
  });

  const getStats = (level: Difficulty) => {
    const list = filtered.filter(r => r.level === level);
    const recent = list.slice(-10);
    if (recent.length === 0) return { total: 0, correct: 0, accuracy: null };
    const correct = recent.filter(r => r.is_correct === true).length;
    const accuracy = Math.round((correct / recent.length) * 100);
    return { total: recent.length, correct, accuracy };
  };

  const basic = getStats('Basic');
  const medium = getStats('Medium');
  const advanced = getStats('Advanced');

  let stepAchieved: 0 | 1 | 2 | 3 = 0;
  if (basic.total >= 3 && basic.accuracy !== null && basic.accuracy >= 80) stepAchieved = 1;
  if (stepAchieved === 1 && medium.total >= 3 && medium.accuracy !== null && medium.accuracy >= 80) stepAchieved = 2;
  if (stepAchieved === 2 && advanced.total >= 3 && advanced.accuracy !== null && advanced.accuracy >= 80) stepAchieved = 3;

  let recommendedDifficulty: 'Basic' | 'Medium' | 'Advanced' = 'Basic';
  let advisoryMessage: string | null = null;

  if (medium.accuracy !== null && medium.accuracy < 50 && medium.total >= 3) {
    recommendedDifficulty = 'Basic';
    advisoryMessage = `Recent Medium accuracy is ${medium.accuracy}%. Try Basic questions to solidify fundamentals.`;
  } else if (advanced.accuracy !== null && advanced.accuracy < 50 && advanced.total >= 3) {
    recommendedDifficulty = 'Medium';
    advisoryMessage = `Recent Advanced accuracy is ${advanced.accuracy}%. Reinforce concepts with Medium questions first.`;
  } else if (stepAchieved >= 2 && (advanced.accuracy === null || advanced.accuracy >= 50)) {
    recommendedDifficulty = 'Advanced';
    if (medium.accuracy !== null && medium.accuracy >= 80) {
      advisoryMessage = `Medium mastered (${medium.accuracy}%). Ready to tackle Advanced questions!`;
    }
  } else if (stepAchieved >= 1 && (medium.accuracy === null || medium.accuracy >= 50)) {
    recommendedDifficulty = 'Medium';
    if (basic.accuracy !== null && basic.accuracy >= 80) {
      advisoryMessage = `Basic mastered (${basic.accuracy}%). Step up to Medium questions!`;
    }
  }

  return {
    basic,
    medium,
    advanced,
    stepAchieved,
    recommendedDifficulty,
    advisoryMessage,
  };
}

// ============================================================
// PHASE 2: MISTAKE NOTEBOOK (SPACED REPETITION)
// ============================================================

export function getRevisionItems(studentId: string): RevisionItem[] {
  return getTable<RevisionItem>('revision_items').filter(r => r.student_id === studentId);
}

export function recordMistake(studentId: string, questionId: string, reason: 'wrong_answer' | 'slow_correct'): RevisionItem {
  const existing = getRevisionItems(studentId).find(r => r.question_id === questionId);
  const now = new Date();

  if (existing) {
    // If not cleared, promote stage or reset
    const nextStage = existing.cleared ? 1 : Math.min(existing.stage + 1, 3) as 1 | 2 | 3;
    const days = nextStage === 1 ? 3 : nextStage === 2 ? 7 : 21;
    const dueAt = new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();

    return updateRow<RevisionItem>('revision_items', existing.id, {
      stage: nextStage,
      due_at: dueAt,
      cleared: false,
      added_reason: reason,
      last_attempt_at: now.toISOString(),
      updated_at: now.toISOString(),
    })!;
  }

  // Initial stage 1: 3 days
  const dueAt = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();
  const item: RevisionItem = {
    id: uuid(),
    student_id: studentId,
    question_id: questionId,
    stage: 1,
    due_at: dueAt,
    cleared: false,
    added_reason: reason,
    last_attempt_at: now.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  return insertRow('revision_items', item);
}

export function clearRevisionItem(studentId: string, questionId: string): boolean {
  const existing = getRevisionItems(studentId).find(r => r.question_id === questionId);
  if (!existing) return false;
  updateRow<RevisionItem>('revision_items', existing.id, {
    cleared: true,
    updated_at: new Date().toISOString(),
  });
  return true;
}

// ============================================================
// PHASE 2: TELEMETRY & NOTICES
// ============================================================

export function recordExamTelemetry(
  attemptId: string,
  studentId: string,
  eventType: ExamTelemetryEvent['event_type'],
  details: Record<string, unknown> | null = null
): ExamTelemetryEvent {
  const event: ExamTelemetryEvent = {
    id: uuid(),
    attempt_id: attemptId,
    student_id: studentId,
    event_type: eventType,
    details,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  return insertRow('exam_telemetry_events', event);
}

export function getExamTelemetry(attemptId: string): ExamTelemetryEvent[] {
  return getTable<ExamTelemetryEvent>('exam_telemetry_events').filter(e => e.attempt_id === attemptId);
}

export function getMonitorNotices(): MonitorNotice[] {
  return getTable<MonitorNotice>('monitor_notices').sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function insertMonitorNotice(data: {
  attempt_id: string | null;
  student_id: string | null;
  message: string;
  reason: string;
  exam_id?: string | null;
}): MonitorNotice {
  return insertRow<MonitorNotice>('monitor_notices', {
    id: uuid(),
    exam_id: data.exam_id ?? null,
    attempt_id: data.attempt_id,
    student_id: data.student_id,
    message: data.message,
    reason: data.reason,
    read: false,
    created_at: new Date().toISOString(),
  });
}

export function markNoticeRead(id: string): void {
  updateRow<MonitorNotice>('monitor_notices', id, { read: true });
}

// ============================================================
// Import: convert pilot JSON to normalized tables with Validation & Idempotency
// ============================================================

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  changes: Array<{
    question_number: number;
    diff: Record<string, { old: any; new: any }>;
  }>;
}

export function validateQuestionRecord(rec: PilotQuestionRecord): string[] {
  const errs: string[] = [];
  if (!rec.number || typeof rec.number !== 'number' || rec.number <= 0) {
    errs.push(`Invalid or missing question number`);
  }
  if (!rec.correct_answer || typeof rec.correct_answer !== 'string' || rec.correct_answer.trim() === '') {
    errs.push(`Q${rec.number}: missing correct_answer`);
  }
  if (!rec.subject || !rec.chapter || !rec.topic) {
    errs.push(`Q${rec.number}: missing tags (subject/chapter/topic)`);
  }
  if (!rec.source) {
    errs.push(`Q${rec.number}: missing source`);
  }
  if (!rec.question_text || typeof rec.question_text !== 'string' || rec.question_text.trim() === '') {
    errs.push(`Q${rec.number}: empty question_text`);
  }
  if (rec.type === 'MCQ') {
    if (!rec.options || !Array.isArray(rec.options) || rec.options.length !== 4) {
      errs.push(`Q${rec.number}: MCQ must have exactly 4 options`);
    }
  } else if (rec.type === 'NVQ' || (rec.type as string) === 'Numerical') {
    if (rec.options && rec.options.length > 0) {
      errs.push(`Q${rec.number}: Numerical questions should not have options`);
    }
  }
  if (rec.figure_required) {
    if (!rec.figure_status || !['needed', 'attached', 'redrawn', 'none'].includes(rec.figure_status)) {
      errs.push(`Q${rec.number}: invalid figure_status '${rec.figure_status}' for figure_required question`);
    }
  }
  // LaTeX balance check
  const textToCheck = `${rec.question_text || ''} ${(rec.options || []).join(' ')} ${rec.solution_steps || ''}`;
  const singleDollarCount = (textToCheck.match(/(?<!\\)\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    errs.push(`Q${rec.number}: Unbalanced LaTeX dollar delimiters ($)`);
  }
  return errs;
}

export function importPilotQuestions(records: PilotQuestionRecord[]): ImportResult {
  const errors: string[] = [];
  const changes: Array<{ question_number: number; diff: Record<string, { old: any; new: any }> }> = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    // Phase 6 M2: JEE Advanced question type support guard
    // Single-correct MCQ and NVQ are supported. Multi-correct, matrix, matching are skipped and audited.
    const isJeeAdv = rec.source === 'jee_advanced' || rec.paper?.exam?.toLowerCase().includes('advanced');
    if (isJeeAdv && !['MCQ', 'NVQ'].includes(rec.type)) {
      const skipMsg = `Unsupported question type '${rec.type}' for JEE Advanced question #${rec.number}. Skipped during bulk ingestion.`;
      errors.push(skipMsg);
      logAudit('jee_advanced_type_skipped', { number: rec.number, type: rec.type, reason: 'unsupported_type' }, 'import');
      skipped++;
      continue;
    }

    const valErrors = validateQuestionRecord(rec);
    if (valErrors.length > 0) {
      errors.push(...valErrors);
      continue;
    }

    const subject = findOrCreateSubject(rec.subject);
    const chapter = findOrCreateChapter(subject.id, rec.chapter);
    const topic = findOrCreateTopic(chapter.id, rec.topic);
    const paper = findOrCreatePaper(rec.paper, rec.source, rec.answer_key_source);

    const now = new Date().toISOString();
    const existing = getAllQuestions().find(q => q.paper_id === paper.id && q.number === rec.number);

    if (existing) {
      // Check for diffs
      const diff: Record<string, { old: any; new: any }> = {};
      if (existing.question_text !== rec.question_text) diff.question_text = { old: existing.question_text, new: rec.question_text };
      if (existing.type !== rec.type) diff.type = { old: existing.type, new: rec.type };
      if (existing.section !== rec.section) diff.section = { old: existing.section, new: rec.section };
      if (JSON.stringify(existing.options) !== JSON.stringify(rec.options ?? null)) diff.options = { old: existing.options, new: rec.options ?? null };
      if (existing.figure_required !== rec.figure_required) diff.figure_required = { old: existing.figure_required, new: rec.figure_required };
      if (existing.figure_status !== rec.figure_status) diff.figure_status = { old: existing.figure_status, new: rec.figure_status };
      if (existing.difficulty !== rec.difficulty) diff.difficulty = { old: existing.difficulty, new: rec.difficulty };
      if (existing.answer_status !== rec.answer_status) diff.answer_status = { old: existing.answer_status, new: rec.answer_status };

      const existingQa = getAllQuestionAnswers().find(qa => qa.question_id === existing.id);
      if (existingQa && existingQa.correct_answer !== rec.correct_answer) {
        diff.correct_answer = { old: existingQa.correct_answer, new: rec.correct_answer };
      }

      const existingSol = getTable<Solution>('solutions').find(s => s.question_id === existing.id);
      if (existingSol && existingSol.steps !== rec.solution_steps) {
        diff.solution_steps = { old: existingSol.steps, new: rec.solution_steps };
      }

      if (Object.keys(diff).length > 0) {
        // Update existing question
        updateQuestion(existing.id, {
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

        if (existingQa) {
          updateRow<QuestionAnswer>('question_answers', existingQa.id, {
            correct_answer: rec.correct_answer,
            answer_text: rec.answer_text ?? null,
            answer_status: rec.answer_status,
          });
        }

        if (existingSol) {
          updateRow<Solution>('solutions', existingSol.id, {
            steps: rec.solution_steps,
            shortcut: rec.shortcut ?? null,
            shortcut_type: rec.shortcut_type ?? null,
            shortcut_note: rec.shortcut_note ?? null,
            verification_status: rec.verification_status,
            matches_key: rec.matches_key ?? null,
            checked_by: rec.checked_by ?? null,
            human_reviewed: rec.human_reviewed,
            updated_at: now,
          });
        }

        logAudit('question_updated', { paper_id: paper.id, number: rec.number, diff }, 'question', existing.id);
        changes.push({ question_number: rec.number, diff });
        updated++;
      } else {
        skipped++;
      }

      // Upsert translations if provided
      if (rec.translations && Array.isArray(rec.translations)) {
        rec.translations.forEach(t => {
          if (t.language && t.question_text) {
            upsertQuestionTranslation({
              question_id: existing.id,
              language: t.language,
              question_text: t.question_text,
              options: t.options || null,
            });
          }
        });
      }
    } else {
      // New question insertion
      const questionId = uuid();
      const question: Question = {
        id: questionId,
        number: rec.number,
        paper_id: paper.id,
        subject_id: subject.id,
        chapter_id: chapter.id,
        topic_id: topic.id,
        subtopic: rec.subtopic ?? null,
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
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      insertQuestion(question);

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
        reviewed_at: null,
        created_at: now,
        updated_at: now,
      };
      insertSolution(sol);

      // Upsert translations if provided
      if (rec.translations && Array.isArray(rec.translations)) {
        rec.translations.forEach(t => {
          if (t.language && t.question_text) {
            upsertQuestionTranslation({
              question_id: questionId,
              language: t.language,
              question_text: t.question_text,
              options: t.options || null,
            });
          }
        });
      }

      imported++;
    }
  }

  return { imported, updated, skipped, errors, changes };
}

// ============================================================
// Phase 3: Targets, Percentile Maps, Weightages, Estimates,
// Alerts, Assignments, and Shortcut Retries
// ============================================================

function logAudit(action: string, details: Record<string, any>, entityType: string = 'phase3', entityId?: string): void {
  try {
    const student = getStudentProfile();
    insertAuditLog({
      id: uuid(),
      user_id: student ? student.id : 'system',
      action,
      entity_type: entityType,
      entity_id: entityId || uuid(),
      details,
      created_at: new Date().toISOString(),
    });
  } catch { }
}

// ---- Targets ----

export function getTargets(studentId?: string): Target[] {
  const targets = getTable<Target>('targets');
  if (studentId) {
    return targets.filter(t => t.student_id === studentId);
  }
  return targets;
}

export function getTarget(id: string): Target | null {
  return getTargets().find(t => t.id === id) ?? null;
}

export function createTarget(data: Omit<Target, 'id' | 'created_at' | 'updated_at'>): Target {
  const row: Target = {
    ...data,
    id: uuid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  insertRow<Target>('targets', row);
  logAudit('target_created', { targetId: row.id, name: row.name, target_type: row.target_type });
  return row;
}

export function updateTarget(id: string, patch: Partial<Target>): Target | null {
  const updated = updateRow<Target>('targets', id, { ...patch, updated_at: new Date().toISOString() });
  if (updated) {
    logAudit('target_updated', { targetId: id, patch });
  }
  return updated;
}

export function deleteTarget(id: string): boolean {
  const ok = deleteRow<Target>('targets', id);
  if (ok) {
    logAudit('target_deleted', { targetId: id });
  }
  return ok;
}

// ---- Percentile Maps & Interpolation ----

export function getPercentileMaps(): PercentileMap[] {
  return getTable<PercentileMap>('percentile_maps');
}

export function getPercentileMap(id: string): PercentileMap | null {
  return getPercentileMaps().find(m => m.id === id) ?? null;
}

export function getPercentileMapRows(mapId: string): PercentileMapRow[] {
  const allRows = getTable<PercentileMapRow>('percentile_map_rows');
  return allRows.filter(r => r.map_id === mapId).sort((a, b) => b.marks - a.marks);
}

export function createPercentileMap(
  mapData: Omit<PercentileMap, 'id' | 'created_at'>,
  rows: Array<{ marks: number; percentile: number }>
): PercentileMap {
  const mapRow: PercentileMap = {
    ...mapData,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  insertRow<PercentileMap>('percentile_maps', mapRow);

  const existingRows = getTable<PercentileMapRow>('percentile_map_rows');
  const newRows: PercentileMapRow[] = rows.map(r => ({
    id: uuid(),
    map_id: mapRow.id,
    marks: r.marks,
    percentile: r.percentile,
  }));
  setTable<PercentileMapRow>('percentile_map_rows', [...existingRows, ...newRows]);
  logAudit('percentile_map_created', { mapId: mapRow.id, name: mapRow.name, rowCount: rows.length });
  return mapRow;
}

export function deletePercentileMap(id: string): boolean {
  const ok = deleteRow<PercentileMap>('percentile_maps', id);
  if (ok) {
    const remaining = getTable<PercentileMapRow>('percentile_map_rows').filter(r => r.map_id !== id);
    setTable<PercentileMapRow>('percentile_map_rows', remaining);
    logAudit('percentile_map_deleted', { mapId: id });
  }
  return ok;
}

/**
 * Linearly interpolates percentile for a given score from a shift's marks-to-percentile map.
 */
export function interpolatePercentile(mapId: string, marks: number): number | null {
  const rows = getPercentileMapRows(mapId);
  if (rows.length === 0) return null;

  // Clamping at boundaries
  const maxRow = rows.reduce((prev, curr) => (curr.marks > prev.marks ? curr : prev), rows[0]);
  const minRow = rows.reduce((prev, curr) => (curr.marks < prev.marks ? curr : prev), rows[0]);

  if (marks >= maxRow.marks) return maxRow.percentile;
  if (marks <= minRow.marks) return minRow.percentile;

  // Sort ascending for interpolation
  const sorted = [...rows].sort((a, b) => a.marks - b.marks);
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (marks >= p1.marks && marks <= p2.marks) {
      if (p2.marks === p1.marks) return p1.percentile;
      const t = (marks - p1.marks) / (p2.marks - p1.marks);
      return Number((p1.percentile + t * (p2.percentile - p1.percentile)).toFixed(4));
    }
  }

  return minRow.percentile;
}

// ---- Chapter Weightages ----

export function getChapterWeightages(profileId?: string): ChapterWeightage[] {
  const all = getTable<ChapterWeightage>('chapter_weightages');
  if (profileId) {
    return all.filter(w => w.pattern_profile_id === profileId);
  }
  return all;
}

export function setChapterWeightage(cw: Omit<ChapterWeightage, 'id' | 'updated_at'>): ChapterWeightage {
  const all = getTable<ChapterWeightage>('chapter_weightages');
  const existingIndex = all.findIndex(
    w => w.pattern_profile_id === cw.pattern_profile_id && w.subject === cw.subject && w.chapter === cw.chapter
  );

  const updatedRow: ChapterWeightage = {
    ...cw,
    id: existingIndex !== -1 ? all[existingIndex].id : uuid(),
    updated_at: new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    all[existingIndex] = updatedRow;
  } else {
    all.push(updatedRow);
  }
  setTable<ChapterWeightage>('chapter_weightages', all);
  logAudit('chapter_weightage_updated', { profileId: cw.pattern_profile_id, chapter: cw.chapter, expected: cw.expected_questions });
  return updatedRow;
}

export function deriveDefaultWeightages(profileId: string): ChapterWeightage[] {
  const questions = getAllQuestions();
  const pp = getPatternProfiles().find(p => p.id === profileId) ?? getPatternProfiles()[0];
  const targetPerSubject = pp ? pp.questions_per_subject : 25;

  const subjects = ['Physics', 'Chemistry', 'Mathematics'];
  const derived: ChapterWeightage[] = [];

  subjects.forEach(subj => {
    const subjQuestions = questions.filter(q => {
      const sName = (q as any).subject || getSubjects().find(s => s.id === q.subject_id)?.name;
      return sName === subj;
    });
    const chapterCounts = new Map<string, number>();

    subjQuestions.forEach(q => {
      const cName = (q as any).chapter || getChapters().find(c => c.id === q.chapter_id)?.name || 'General';
      chapterCounts.set(cName, (chapterCounts.get(cName) ?? 0) + 1);
    });

    const totalInSubj = subjQuestions.length;
    const chapters = getChapters(subj);

    if (totalInSubj === 0 || chapters.length === 0) {
      // Uniform fallback
      const count = chapters.length || 1;
      const perChapter = Number((targetPerSubject / count).toFixed(2));
      chapters.forEach(c => {
        derived.push({
          id: uuid(),
          pattern_profile_id: profileId,
          subject: subj,
          chapter: c.name,
          expected_questions: perChapter,
          is_manual_override: false,
          updated_at: new Date().toISOString(),
        });
      });
    } else {
      chapters.forEach(c => {
        const rawCount = chapterCounts.get(c.name) ?? 0;
        const normalized = Number(((rawCount / totalInSubj) * targetPerSubject).toFixed(2));
        derived.push({
          id: uuid(),
          pattern_profile_id: profileId,
          subject: subj,
          chapter: c.name,
          expected_questions: normalized > 0 ? normalized : 0.5,
          is_manual_override: false,
          updated_at: new Date().toISOString(),
        });
      });
    }
  });

  // Save to table
  const existing = getTable<ChapterWeightage>('chapter_weightages').filter(w => w.pattern_profile_id !== profileId);
  setTable<ChapterWeightage>('chapter_weightages', [...existing, ...derived]);
  return derived;
}

// ---- Estimates: Snapshots (Monitor) & Student Projections ----

export function getEstimateSnapshots(studentId?: string): EstimateSnapshot[] {
  const all = getTable<EstimateSnapshot>('estimate_snapshots');
  if (studentId) return all.filter(s => s.student_id === studentId);
  return all;
}

export function getLatestEstimateSnapshot(studentId: string, targetId: string): EstimateSnapshot | null {
  const snapshots = getEstimateSnapshots(studentId)
    .filter(s => s.target_id === targetId)
    .sort((a, b) => new Date(b.as_of).getTime() - new Date(a.as_of).getTime());
  return snapshots[0] ?? null;
}

export function saveEstimateSnapshot(snapshot: Omit<EstimateSnapshot, 'id' | 'created_at'>): EstimateSnapshot {
  const row: EstimateSnapshot = {
    ...snapshot,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  insertRow<EstimateSnapshot>('estimate_snapshots', row);
  return row;
}

export function getStudentEstimates(studentId?: string): StudentEstimate[] {
  const all = getTable<StudentEstimate>('student_estimates');
  if (studentId) return all.filter(e => e.student_id === studentId);
  return all;
}

export function getStudentEstimate(studentId: string, targetId: string): StudentEstimate | null {
  return getStudentEstimates(studentId).find(e => e.target_id === targetId) ?? null;
}

export function saveStudentEstimate(estimate: Omit<StudentEstimate, 'id' | 'updated_at'>): StudentEstimate {
  const all = getTable<StudentEstimate>('student_estimates');
  const existingIdx = all.findIndex(e => e.student_id === estimate.student_id && e.target_id === estimate.target_id);

  const row: StudentEstimate = {
    ...estimate,
    id: existingIdx !== -1 ? all[existingIdx].id : uuid(),
    updated_at: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    all[existingIdx] = row;
  } else {
    all.push(row);
  }
  setTable<StudentEstimate>('student_estimates', all);
  return row;
}

// ---- Alerts & Settings ----

export function getAlerts(studentId?: string): Alert[] {
  const alerts = getTable<Alert>('alerts');
  if (studentId) {
    return alerts.filter(a => a.student_id === studentId);
  }
  return alerts;
}

export function getActiveAlerts(studentId?: string): Alert[] {
  return getAlerts().filter(a => a.status === 'active' && (!studentId || a.student_id === studentId));
}

export function createAlert(data: Omit<Alert, 'id' | 'created_at'>, asOfDate?: Date): Alert | null {
  const all = getAlerts();
  const now = asOfDate || new Date();
  // Check deduplication key and cooldown
  const existing = all.find(a => a.dedupe_key === data.dedupe_key && a.student_id === data.student_id);
  if (existing) {
    if (existing.cooldown_until && now < new Date(existing.cooldown_until)) {
      return null; // Suppressed by active cooldown
    }
    // Update existing alert to active
    return updateRow<Alert>('alerts', existing.id, {
      ...data,
      status: 'active',
      cooldown_until: data.cooldown_until,
      resolved_at: null,
    });
  }

  const row: Alert = {
    ...data,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  insertRow<Alert>('alerts', row);
  return row;
}

export function acknowledgeAlert(id: string): Alert | null {
  return updateRow<Alert>('alerts', id, { status: 'acknowledged' });
}

export function resolveAlert(id: string): Alert | null {
  return updateRow<Alert>('alerts', id, { status: 'resolved', resolved_at: new Date().toISOString() });
}

export function getAlertSettings(): AlertSettings {
  const list = getTable<AlertSettings>('alert_settings');
  if (list.length > 0) return list[0];
  const defaultSettings: AlertSettings = {
    id: uuid(),
    inactivity_days: 3,
    accuracy_drop_threshold: 0.15,
    email_alerts_enabled: false,
    monitor_email: 'monitor@jeepractice.local',
    updated_at: new Date().toISOString(),
  };
  insertRow<AlertSettings>('alert_settings', defaultSettings);
  return defaultSettings;
}

export function updateAlertSettings(patch: Partial<AlertSettings>): AlertSettings {
  const current = getAlertSettings();
  const updated = updateRow<AlertSettings>('alert_settings', current.id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
  return updated ?? current;
}

// ---- Assignments ----

export function getAssignments(studentId?: string): Assignment[] {
  const all = getTable<Assignment>('assignments');
  if (studentId) return all.filter(a => a.student_id === studentId);
  return all;
}

export function createAssignment(data: Omit<Assignment, 'id' | 'created_at' | 'status'>): Assignment {
  const row: Assignment = {
    ...data,
    id: uuid(),
    status: 'active',
    created_at: new Date().toISOString(),
  };
  insertRow<Assignment>('assignments', row);
  logAudit('assignment_created', { assignmentId: row.id, title: row.title, target_count: row.target_count });
  return row;
}

export function updateAssignment(id: string, patch: Partial<Assignment>): Assignment | null {
  const updated = updateRow<Assignment>('assignments', id, patch);
  if (updated) {
    logAudit('assignment_updated', { assignmentId: id, patch });
  }
  return updated;
}

export function deleteAssignment(id: string): boolean {
  const ok = deleteRow<Assignment>('assignments', id);
  if (ok) {
    logAudit('assignment_deleted', { assignmentId: id });
  }
  return ok;
}

/**
 * Counts distinct questions in assignment scope submitted in Practice ON or AFTER assignment created_at.
 */
export function getAssignmentProgress(assignmentId: string): { completedCount: number; targetCount: number; isCompleted: boolean } {
  const a = getAssignments().find(item => item.id === assignmentId);
  if (!a) return { completedCount: 0, targetCount: 0, isCompleted: false };

  const practiced = getPracticedQuestions(a.student_id);
  const questions = getAllQuestions();
  const assignmentCreatedAt = new Date(a.created_at).getTime();

  // Find qualifying distinct questions
  const qualifyingQIds = new Set<string>();
  practiced.forEach(pq => {
    if (!pq.first_practiced_at) return;
    const practicedTime = new Date(pq.first_practiced_at).getTime();
    if (practicedTime < assignmentCreatedAt) return;

    const q = questions.find(qItem => qItem.id === pq.question_id);
    if (!q) return;

    const sName = (q as any).subject || getSubjects().find(s => s.id === q.subject_id)?.name;
    const cName = (q as any).chapter || getChapters().find(c => c.id === q.chapter_id)?.name;
    const tName = (q as any).topic || getTopics().find(t => t.id === q.topic_id)?.name;

    if (a.subject && sName !== a.subject) return;
    if (a.chapter && cName !== a.chapter) return;
    if (a.topic && tName !== a.topic) return;
    if (a.level && a.level !== 'Mixed' && q.difficulty !== a.level) return;

    qualifyingQIds.add(q.id);
  });

  const completedCount = qualifyingQIds.size;
  const isCompleted = completedCount >= a.target_count;
  return { completedCount, targetCount: a.target_count, isCompleted };
}

// ---- Shortcut Retries (SRD 4.3 FR-3.10) ----

export function getShortcutRetries(studentId?: string): ShortcutRetry[] {
  const all = getTable<ShortcutRetry>('shortcut_retries');
  if (studentId) return all.filter(r => r.student_id === studentId);
  return all;
}

/**
 * Evaluates shortcut retry. Baseline_active_seconds and retry_active_seconds
 * are saved for monitor reporting but are NEVER returned to student callers.
 */
export function recordShortcutRetry(
  studentId: string,
  questionId: string,
  submittedAnswer: string,
  isCorrect: boolean,
  retryActiveSeconds: number
): { id: string; verdict: ShortcutVerdict; is_correct: boolean } {
  // Look up baseline active seconds from the student's *first* practice visit for this question
  const responses = getTable<Response>('responses').filter(r => r.student_id === studentId && r.question_id === questionId);
  const respIds = new Set(responses.map(r => r.id));
  const visits = getAllVisits().filter(v => v.student_id === studentId && (respIds.has(v.response_id) || (v as any).question_id === questionId));
  const firstPracticeVisit = visits.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())[0];
  const baselineSeconds = firstPracticeVisit ? firstPracticeVisit.active_seconds : 120; // fallback to 2m if unrecorded

  const verdict: ShortcutVerdict = retryActiveSeconds < baselineSeconds ? 'faster' : 'slower';

  const row: ShortcutRetry = {
    id: uuid(),
    student_id: studentId,
    question_id: questionId,
    baseline_active_seconds: baselineSeconds,
    retry_active_seconds: retryActiveSeconds,
    verdict,
    submitted_answer: submittedAnswer,
    is_correct: isCorrect,
    created_at: new Date().toISOString(),
  };

  insertRow<ShortcutRetry>('shortcut_retries', row);
  logAudit('shortcut_retry_recorded', { questionId, verdict, isCorrect });

  // Invariance rule: DOES NOT mutate first_answer, practiced_questions, accuracy, ladder, etc.
  return {
    id: row.id,
    verdict: row.verdict,
    is_correct: row.is_correct,
  };
}

// ---- Email Logs ----

export function getEmailLogs(): EmailLog[] {
  return getTable<EmailLog>('email_logs');
}

export function logEmail(
  recipient: string,
  subject: string,
  emailType: string,
  idempotencyKey: string,
  status: 'sent' | 'failed'
): EmailLog {
  const row: EmailLog = {
    id: uuid(),
    recipient,
    subject,
    email_type: emailType,
    idempotency_key: idempotencyKey,
    status,
    sent_at: new Date().toISOString(),
  };
  insertRow<EmailLog>('email_logs', row);
  return row;
}

// ============================================================
// Seed: create default accounts, settings & pattern profiles
// ============================================================

export function seedIfEmpty(): void {
  const profiles = getProfiles();
  if (profiles.length > 0) return;

  const monitorId = uuid();
  const studentId = uuid();

  const monitor: Profile = {
    id: monitorId,
    role: 'monitor',
    status: 'active',
    name: 'Monitor',
    first_name: 'Guardian',
    last_name: 'Monitor',
    email: 'monitor@jeepractice.local',
    password: '$pbkdf2-sha256$i=100000$91b5eff61245426207a3572ecb9da1f2$df03d26cdf4b1f96e650d5c8778f65b239293fc0f63a0c61ecabc41bd0c13977',
    linked_account_id: studentId,
    time_tracking_acknowledged: true,
    stopwatch_visible: true,
    email_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const student: Profile = {
    id: studentId,
    role: 'student',
    status: 'active',
    name: 'Student',
    first_name: 'Phase1',
    last_name: 'Student',
    age: 18,
    college_name: 'Phase 1 Legacy Institution',
    incomplete_profile: true,
    email: 'student@jeepractice.local',
    password: '$pbkdf2-sha256$i=100000$62c7ebaa18fed95a53478775acc0aa28$0a47573d0a03d28c0f35dba8c5a3b717023d29dd8bb73fb105c5d7e17fbaeded',
    linked_account_id: monitorId,
    time_tracking_acknowledged: false,
    stopwatch_visible: true,
    email_verified: false,
    consent_tracking_at: new Date().toISOString(),
    decided_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  insertRow<Profile>('profiles', monitor);
  insertRow<Profile>('profiles', student);

  getSettings();

  const pp: PatternProfile = {
    id: 'e0000000-0000-0000-0000-000000000001',
    name: 'JEE Main 2026',
    questions_per_subject: 25,
    mcq_per_subject: 20,
    nvq_per_subject: 5,
    duration_minutes: 180,
    marks_correct_mcq: 4,
    marks_wrong_mcq: -1,
    marks_correct_nvq: 4,
    marks_wrong_nvq: 0,
    marks_unattempted: 0,
    nvq_attempt_rule: 'any_5_of_10',
    language_options: ['English'],
    created_at: new Date().toISOString(),
  };
  insertRow<PatternProfile>('pattern_profiles', pp);

  if (getAllQuestions().length === 0) {
    importPilotQuestions(pilotData as unknown as PilotQuestionRecord[]);
  }

  // Phase 3 seed: Alert settings, Demo Percentile Map, Default Target, and Chapter Weightages
  getAlertSettings();

  const demoMaps = getPercentileMaps();
  let demoMapId: string | null = null;
  if (demoMaps.length === 0) {
    const demoMap = createPercentileMap(
      {
        name: 'JEE Main 2026 Shift 1 Benchmark Map',
        year: 2026,
        shift: 'Jan 28 Morning',
        source: 'Official Benchmark',
        is_approximation: false,
      },
      [
        { marks: 300, percentile: 100.0 },
        { marks: 275, percentile: 99.92 },
        { marks: 240, percentile: 99.55 },
        { marks: 215, percentile: 99.02 },
        { marks: 185, percentile: 97.45 },
        { marks: 160, percentile: 95.10 },
        { marks: 130, percentile: 90.25 },
        { marks: 100, percentile: 80.50 },
        { marks: 70, percentile: 65.20 },
        { marks: 40, percentile: 45.10 },
        { marks: 0, percentile: 0.0 },
      ]
    );
    demoMapId = demoMap.id;
  } else {
    demoMapId = demoMaps[0].id;
  }

  const existingTargets = getTargets();
  if (existingTargets.length === 0) {
    createTarget({
      student_id: studentId,
      name: '99th Percentile Target',
      target_type: 'percentile',
      target_value: 99.0,
      candidate_count: null,
      cutoff_unit: null,
      exam_date: '2026-04-02',
      reference_map_id: demoMapId,
    });
  }

  if (getChapterWeightages(pp.id).length === 0) {
    deriveDefaultWeightages(pp.id);
  }
}

export function seedDemoQuestions(): void {
  const existing = getAllQuestions();
  if (!existing.some(q => q.rating_source === 'demo')) {
    importPilotQuestions(demoData as unknown as PilotQuestionRecord[]);
  }
}

// ============================================================
// Practice mode scoring helper (Phase 1)
// ============================================================

export function scoreResponse(
  questionId: string,
  studentAnswer: string | null,
  questionType: QuestionType
): { is_correct: boolean; marks: number } {
  const qa = getAllQuestionAnswers().find(a => a.question_id === questionId);
  if (!qa) return { is_correct: false, marks: 0 };

  if (qa.answer_status === 'Dropped') return { is_correct: false, marks: 0 };
  if (qa.answer_status === 'Bonus') return { is_correct: true, marks: 4 };
  if (!studentAnswer) return { is_correct: false, marks: 0 };

  const pp = getPatternProfiles()[0];

  if (questionType === 'NVQ') {
    const correct = parseFloat(qa.correct_answer);
    const given = parseFloat(studentAnswer);
    const isCorrect = !isNaN(correct) && !isNaN(given) && Math.abs(correct - given) < 0.01;
    return {
      is_correct: isCorrect,
      marks: isCorrect ? pp.marks_correct_nvq : pp.marks_wrong_nvq,
    };
  }

  const isCorrect = studentAnswer.toUpperCase() === qa.correct_answer.toUpperCase();
  return {
    is_correct: isCorrect,
    marks: isCorrect ? pp.marks_correct_mcq : pp.marks_wrong_mcq,
  };
}

// ============================================================
// PHASE 7: REAL OUTCOMES, CALIBRATION LOG & STALE MAP DETECTION
// ============================================================

export interface RolloverOptions {
  studentId: string;
  newExamDate: string;
  sessionSuffix?: string;
  targetMapId?: string;
}

export interface FocusAreaSuggestion {
  chapter_id: string;
  chapter_name: string;
  subject_id: string;
  accuracy_pct: number;
  attempts_count: number;
  reason: string;
}

export interface RolloverResult {
  success: boolean;
  copied_targets: Target[];
  suggested_focus_areas: FocusAreaSuggestion[];
  prior_targets_count: number;
}

export function rolloverNextSession(options: RolloverOptions): RolloverResult {
  const currentTargets = getTargets().filter(t => t.student_id === options.studentId);
  const suffix = options.sessionSuffix || 'Session 2';
  const copiedTargets: Target[] = [];

  // 1. Copy targets with new exam date (without deleting prior records)
  currentTargets.forEach(t => {
    let newName = t.name;
    if (newName.includes('Session 1')) {
      newName = newName.replace(/Session 1/g, suffix);
    } else if (!newName.includes(suffix)) {
      newName = `${newName} (${suffix})`;
    }

    const newTarget = createTarget({
      student_id: options.studentId,
      name: newName,
      target_type: t.target_type,
      target_value: t.target_value,
      candidate_count: t.candidate_count,
      cutoff_unit: t.cutoff_unit,
      exam_date: options.newExamDate,
      reference_map_id: options.targetMapId || t.reference_map_id,
    });
    copiedTargets.push(newTarget);
  });

  // 2. Compute Weakest Chapters from student history for suggested focus areas
  const practiced = getPracticedQuestions(options.studentId);
  const questions = getAllQuestions();
  const chapters = getChapters();
  const chapterMap = new Map(chapters.map(c => [c.id, c]));

  const chapterStats = new Map<string, { total: number; correct: number }>();
  practiced.forEach(pq => {
    const q = questions.find(item => item.id === pq.question_id);
    if (!q || !q.chapter_id) return;
    const cur = chapterStats.get(q.chapter_id) || { total: 0, correct: 0 };
    cur.total++;
    if (pq.last_result) cur.correct++;
    chapterStats.set(q.chapter_id, cur);
  });

  const focusAreas: FocusAreaSuggestion[] = [];
  for (const [chId, stats] of chapterStats.entries()) {
    if (stats.total >= 3) {
      const acc = Math.round((stats.correct / stats.total) * 100);
      if (acc < 65) {
        const ch = chapterMap.get(chId);
        focusAreas.push({
          chapter_id: chId,
          chapter_name: ch?.name || chId,
          subject_id: ch?.subject_id || 'Unknown',
          accuracy_pct: acc,
          attempts_count: stats.total,
          reason: `Accuracy is ${acc}% across ${stats.total} practiced questions in Session 1 history. High-priority focus area for Session 2.`,
        });
      }
    }
  }

  // Sort by lowest accuracy first
  focusAreas.sort((a, b) => a.accuracy_pct - b.accuracy_pct);

  // If few weak chapters found, add unvisited high weightage chapters
  if (focusAreas.length < 3) {
    const practicedChapterIds = new Set(chapterStats.keys());
    chapters.forEach(c => {
      if (!practicedChapterIds.has(c.id) && focusAreas.length < 5) {
        focusAreas.push({
          chapter_id: c.id,
          chapter_name: c.name,
          subject_id: c.subject_id,
          accuracy_pct: 0,
          attempts_count: 0,
          reason: `Unpracticed chapter in Session 1. Recommended for initial syllabus completion in Session 2.`,
        });
      }
    });
  }

  return {
    success: true,
    copied_targets: copiedTargets,
    suggested_focus_areas: focusAreas,
    prior_targets_count: currentTargets.length,
  };
}

export function getRealOutcomes(studentId?: string): RealExamOutcome[] {
  const all = getTable<RealExamOutcome>('real_exam_outcomes');
  return studentId ? all.filter(o => o.student_id === studentId) : all;
}

export function getCalibrationLogs(studentId?: string): CalibrationLogEntry[] {
  const all = getTable<CalibrationLogEntry>('calibration_log');
  return studentId ? all.filter(c => c.student_id === studentId) : all;
}

export function recordRealOutcome(
  data: Omit<RealExamOutcome, 'id' | 'created_at' | 'updated_at'>
): { outcome: RealExamOutcome; calibration: CalibrationLogEntry | null } {
  const now = new Date().toISOString();
  const outcome: RealExamOutcome = {
    ...data,
    id: uuid(),
    created_at: now,
    updated_at: now,
  };
  insertRow('real_exam_outcomes', outcome);

  // Compare against latest projection snapshot or active target
  const targets = getTargets().filter(t => t.student_id === data.student_id);
  const primaryTarget = targets[0];
  let predictedScore = 0;
  let predictedPercentile = 0;
  let predictedRank: number | null = null;
  let snapshotId: string | null = null;

  if (primaryTarget) {
    const snapshot = getLatestEstimateSnapshot(data.student_id, primaryTarget.id);
    if (snapshot) {
      predictedPercentile = snapshot.p50_percentile ?? (snapshot as any).predicted_percentile ?? 99.0;
      predictedScore = (snapshot as any).predicted_score ?? Math.round(predictedPercentile * 2.2);
      predictedRank = (snapshot as any).predicted_rank ?? null;
      snapshotId = snapshot.id;
    } else {
      predictedScore = primaryTarget.target_value;
      predictedPercentile = primaryTarget.target_type === 'percentile' ? primaryTarget.target_value : 99.0;
    }
  }

  const scoreDiff = Math.round((data.actual_score - predictedScore) * 10) / 10;
  const percentileDiff = Math.round((data.actual_percentile - predictedPercentile) * 100) / 100;
  const rankDiff = (data.actual_rank != null && predictedRank != null)
    ? data.actual_rank - predictedRank
    : null;

  const calibration: CalibrationLogEntry = {
    id: uuid(),
    student_id: data.student_id,
    real_outcome_id: outcome.id,
    target_id: primaryTarget?.id ?? null,
    projection_snapshot_id: snapshotId,
    predicted_score: predictedScore,
    predicted_percentile: predictedPercentile,
    predicted_rank: predictedRank,
    actual_score: data.actual_score,
    actual_percentile: data.actual_percentile,
    actual_rank: data.actual_rank ?? null,
    score_diff: scoreDiff,
    percentile_diff: percentileDiff,
    rank_diff: rankDiff,
    calibration_notes: 'N=1 calibration is anecdotal, not statistical. No automatic model tuning performed.',
    created_at: now,
  };

  insertRow('calibration_log', calibration);

  return { outcome, calibration };
}

export interface StalePercentileMapWarning {
  map_id: string;
  map_name: string;
  map_year: number;
  exam_year: number;
  years_diff: number;
  is_stale: boolean;
  warning_message: string | null;
}

export function checkStalePercentileMaps(
  examDateStr: string,
  thresholdYears?: number
): StalePercentileMapWarning[] {
  const threshold = thresholdYears ?? (getSettings().stale_percentile_map_threshold_years ?? 2);
  const examYear = new Date(examDateStr).getFullYear();
  const maps = getPercentileMaps();

  return maps.map(m => {
    // Extract year from map name or metadata (e.g. "JEE Main 2024 Shift-wise", "2024")
    const match = m.name.match(/\b(20\d\d)\b/);
    const mapYear = match ? parseInt(match[1], 10) : (m as any).year ?? 2024;
    const diff = examYear - mapYear;
    const isStale = diff > threshold;

    let warningMessage: string | null = null;
    if (isStale) {
      warningMessage = `Using ${mapYear} percentile map for a ${examYear} target exam; score-to-percentile translation may shift due to cohort size changes. Download latest official NTA distribution when available.`;
    }

    return {
      map_id: m.id,
      map_name: m.name,
      map_year: mapYear,
      exam_year: examYear,
      years_diff: diff,
      is_stale: isStale,
      warning_message: warningMessage,
    };
  });
}

export function isArchiveModeActive(): boolean {
  return getSettings().archive_mode === true;
}

export function setArchiveMode(active: boolean): void {
  const current = getSettings();
  updateRow<Settings>('settings', current.id, {
    ...current,
    archive_mode: active,
    updated_at: new Date().toISOString(),
  });
}

export function getMaintenanceRecords(): MaintenanceRecord[] {
  return getTable<MaintenanceRecord>('maintenance_records');
}

export function recordMaintenance(
  record: Omit<MaintenanceRecord, 'id' | 'created_at'>
): MaintenanceRecord {
  const row: MaintenanceRecord = {
    ...record,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  return insertRow('maintenance_records', row);
}

// ============================================================
// Enhancement Module E10: UX Completeness & Safety
// ============================================================

export function markOnboardingCompleted(userId: string): Profile {
  const updated = updateProfile(userId, { onboarding_completed_at: new Date().toISOString() });
  if (!updated) throw new Error('User profile not found');
  return updated;
}

export function hasCompletedOnboarding(userId: string): boolean {
  const profile = getProfile(userId);
  return Boolean(profile?.onboarding_completed_at);
}

export function recordDestructiveAction(
  monitorId: string,
  actionType: DestructiveAction['action_type'],
  targetId: string,
  description: string,
  payloadBefore: Record<string, any>,
  payloadAfter: Record<string, any> | null = null,
  durationSeconds: number = 30
): DestructiveAction {
  const monitor = getProfile(monitorId);
  if (!monitor || monitor.role !== 'monitor') {
    throw new Error('Unauthorized: Only monitors can record destructive actions');
  }

  const action: DestructiveAction = {
    id: uuid(),
    monitor_id: monitorId,
    action_type: actionType,
    target_id: targetId,
    description,
    payload_before: payloadBefore,
    payload_after: payloadAfter,
    is_undone: false,
    expires_at: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };

  insertRow('destructive_actions', action);
  return action;
}

export function getPendingUndoableAction(
  monitorId: string,
  actionId: string
): DestructiveAction | null {
  const actions = getTable<DestructiveAction>('destructive_actions');
  const action = actions.find(
    (a) => a.id === actionId && a.monitor_id === monitorId && !a.is_undone
  );
  if (!action) return null;

  if (new Date(action.expires_at).getTime() < Date.now()) {
    return null; // Expired
  }
  return action;
}

export function executeUndoAction(
  callerId: string,
  actionId: string
): { success: boolean; error?: string; restoredTargetId?: string } {
  const caller = getProfile(callerId);
  if (!caller || caller.role !== 'monitor') {
    throw new Error('Unauthorized: Students cannot execute undo actions');
  }

  const actions = getTable<DestructiveAction>('destructive_actions');
  const action = actions.find((a) => a.id === actionId);
  if (!action) {
    return { success: false, error: 'Destructive action not found' };
  }

  if (action.monitor_id !== callerId) {
    throw new Error('Unauthorized: Cannot undo actions belonging to another monitor');
  }

  if (action.is_undone) {
    return { success: false, error: 'Action has already been undone' };
  }

  if (new Date(action.expires_at).getTime() < Date.now()) {
    return { success: false, error: 'Undo window has expired' };
  }

  // Restore the entity based on action_type
  if (action.action_type === 'delete_exam') {
    insertRow('exams', action.payload_before as Exam);
  } else if (action.action_type === 'rollback_paper') {
    updateRow('papers', action.target_id, action.payload_before);
  }

  // Mark action undone
  updateRow<DestructiveAction>('destructive_actions', action.id, { is_undone: true });

  return { success: true, restoredTargetId: action.target_id };
}

export function generateStudentResultsExport(
  studentId: string,
  examAttemptId?: string
): StudentResultExportRow[] {
  const student = getProfile(studentId);
  if (!student || student.role !== 'student') {
    throw new Error('Unauthorized: Invalid student profile');
  }

  const allQ = getAllQuestions();
  const allSubj = getSubjects();
  const allChap = getChapters();
  const responses = getTable<any>('responses').filter((r) => r.student_id === studentId);
  const targetResponses = examAttemptId
    ? responses.filter((r) => r.attempt_id === examAttemptId)
    : responses;

  const rows: StudentResultExportRow[] = [];

  for (const resp of targetResponses) {
    const q = allQ.find((item) => item.id === resp.question_id);
    if (!q) continue;

    const subj = allSubj.find((s) => s.id === q.subject_id);
    const chap = allChap.find((c) => c.id === q.chapter_id);

    // Question answers and solutions only release after submission
    const isSubmitted = Boolean(resp.submitted_at || resp.ended_at);
    const ans = isSubmitted ? getQuestionAnswer(q.id, studentId) : null;
    const sol = isSubmitted ? getSolution(q.id, studentId) : null;

    rows.push({
      question_id: q.id,
      subject: subj?.name || 'Unknown',
      chapter: chap?.name || 'Unknown',
      question_type: q.type,
      student_answer: resp.selected_option || resp.numerical_value || null,
      correct_answer: ans?.correct_answer || null,
      is_correct: resp.is_correct ?? false,
      marks_awarded: resp.marks_awarded ?? 0,
      solution_text: sol?.steps || null,
      shortcut_text: sol?.shortcut || null,
      error_tag: resp.error_tag || null,
      confidence_tag: resp.confidence_tag || null,
    });
  }

  return rows;
}

// ============================================================
// Enhancement Module E9: Performance, Prefetching & Visual Polish
// ============================================================

export function getUserPreferences(userId: string): UserPreferences {
  const profile = getProfile(userId);
  return profile?.preferences || {
    theme: 'light',
    fontSize: 'normal',
    highContrast: false,
    reducedMotion: false,
  };
}

export function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): UserPreferences {
  const current = getUserPreferences(userId);
  const updatedPrefs: UserPreferences = { ...current, ...prefs };
  updateProfile(userId, { preferences: updatedPrefs });
  return updatedPrefs;
}

export function prefetchNextQuestionText(
  currentQuestionId: string,
  questionOrder: string[],
  _studentId: string
): PrefetchedQuestionText | null {
  const currentIndex = questionOrder.indexOf(currentQuestionId);
  if (currentIndex === -1 || currentIndex >= questionOrder.length - 1) {
    return null; // No next question
  }

  const nextQId = questionOrder[currentIndex + 1];
  const allQ = getAllQuestions();
  const nextQ = allQ.find((q) => q.id === nextQId);
  if (!nextQ) return null;

  return {
    question_id: nextQ.id,
    type: nextQ.type,
    question_text: nextQ.question_text,
    section: nextQ.section,
    options: nextQ.options ? [...nextQ.options] : null,
    figure_required: nextQ.figure_required,
    // CRITICAL SECURITY INVARIANT: Answers and solutions are strictly withheld
    correct_answer: null,
    solution_text: null,
  };
}

// ---- Enhancement E12: Sync Idempotency & Resilience ----

export function getIdempotencyKey(key: string): SyncIdempotencyKey | null {
  const all = getTable<SyncIdempotencyKey>('sync_idempotency_keys');
  return all.find((k) => k.key === key) ?? null;
}

export function saveIdempotencyKey(record: SyncIdempotencyKey): SyncIdempotencyKey {
  const all = getTable<SyncIdempotencyKey>('sync_idempotency_keys');
  const idx = all.findIndex((k) => k.key === record.key);
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  setTable('sync_idempotency_keys', all);
  return record;
}

export function getClientEventSequences(attemptId: string): ClientEventSequence[] {
  const all = getTable<ClientEventSequence>('client_event_sequences');
  return all
    .filter((e) => e.attempt_id === attemptId)
    .sort((a, b) => a.sequence_number - b.sequence_number);
}

export function insertClientEventSequence(event: ClientEventSequence): ClientEventSequence {
  const all = getTable<ClientEventSequence>('client_event_sequences');
  const existing = all.find(
    (e) => e.attempt_id === event.attempt_id && e.sequence_number === event.sequence_number
  );
  if (existing) {
    return existing; // idempotent duplicate ignore
  }
  all.push(event);
  setTable('client_event_sequences', all);
  return event;
}

export function getDeadLetterJobs(): DeadLetterJob[] {
  return getTable<DeadLetterJob>('dead_letter_jobs').sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function insertDeadLetterJob(job: DeadLetterJob): DeadLetterJob {
  const all = getTable<DeadLetterJob>('dead_letter_jobs');
  all.push(job);
  setTable('dead_letter_jobs', all);
  return job;
}

export function updateDeadLetterJob(id: string, patch: Partial<DeadLetterJob>): DeadLetterJob | null {
  const all = getTable<DeadLetterJob>('dead_letter_jobs');
  const idx = all.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  setTable('dead_letter_jobs', all);
  return all[idx];
}

// ---- Enhancement E11: Account Security & Sessions ----

export function getUserSessions(userId: string): UserSession[] {
  return getTable<UserSession>('user_sessions')
    .filter((s) => s.user_id === userId)
    .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
}

export function getAllUserSessions(): UserSession[] {
  return getTable<UserSession>('user_sessions').sort(
    (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  );
}

export function insertUserSession(session: UserSession): UserSession {
  const all = getTable<UserSession>('user_sessions');
  all.push(session);
  setTable('user_sessions', all);
  return session;
}

export function updateUserSession(id: string, patch: Partial<UserSession>): UserSession | null {
  const all = getTable<UserSession>('user_sessions');
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  setTable('user_sessions', all);
  return all[idx];
}

export function revokeUserSession(sessionId: string): boolean {
  const updated = updateUserSession(sessionId, { is_revoked: true });
  return !!updated;
}

export function getCspReports(): CspReport[] {
  return getTable<CspReport>('csp_reports').sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  );
}

export function insertCspReport(report: CspReport): CspReport {
  const all = getTable<CspReport>('csp_reports');
  all.push(report);
  setTable('csp_reports', all);
  return report;
}

export function getMfaRecoveryCodes(userId: string): MfaRecoveryCode[] {
  return getTable<MfaRecoveryCode>('mfa_recovery_codes').filter((c) => c.user_id === userId);
}

export function saveMfaRecoveryCodes(userId: string, codes: MfaRecoveryCode[]): void {
  const all = getTable<MfaRecoveryCode>('mfa_recovery_codes').filter((c) => c.user_id !== userId);
  all.push(...codes);
  setTable('mfa_recovery_codes', all);
}

export function markMfaRecoveryCodeUsed(id: string): boolean {
  const all = getTable<MfaRecoveryCode>('mfa_recovery_codes');
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], is_used: true, used_at: new Date().toISOString() };
  setTable('mfa_recovery_codes', all);
  return true;
}

// ---- Enhancement E1: Adaptive Spaced Repetition v2 ----

export function getSpacedRepetitionCards(studentId: string): SpacedRepetitionCard[] {
  return getTable<SpacedRepetitionCard>('spaced_repetition_cards')
    .filter((c) => c.student_id === studentId)
    .sort((a, b) => new Date(a.next_review_due).getTime() - new Date(b.next_review_due).getTime());
}

export function saveSpacedRepetitionCard(card: SpacedRepetitionCard): SpacedRepetitionCard {
  const all = getTable<SpacedRepetitionCard>('spaced_repetition_cards');
  const idx = all.findIndex((c) => c.student_id === card.student_id && c.question_id === card.question_id);
  if (idx >= 0) {
    all[idx] = { ...card, updated_at: new Date().toISOString() };
  } else {
    all.push({ ...card, updated_at: new Date().toISOString() });
  }
  setTable('spaced_repetition_cards', all);
  return card;
}

export function getDueSpacedRepetitionCards(studentId: string, asOf = new Date().toISOString()): SpacedRepetitionCard[] {
  const all = getSpacedRepetitionCards(studentId);
  const asOfTime = new Date(asOf).getTime();
  return all.filter((c) => new Date(c.next_review_due).getTime() <= asOfTime);
}

// ---- Enhancement E6: Calibration & Error Analytics ----

export function getCalibrationSnapshots(studentId: string): CalibrationSnapshot[] {
  return getTable<CalibrationSnapshot>('calibration_snapshots')
    .filter((s) => s.student_id === studentId)
    .sort((a, b) => new Date(b.as_of).getTime() - new Date(a.as_of).getTime());
}

export function saveCalibrationSnapshot(snapshot: CalibrationSnapshot): CalibrationSnapshot {
  const all = getTable<CalibrationSnapshot>('calibration_snapshots');
  all.push(snapshot);
  setTable('calibration_snapshots', all);
  return snapshot;
}

export function getLatestCalibrationSnapshot(studentId: string): CalibrationSnapshot | null {
  const snaps = getCalibrationSnapshots(studentId);
  return snaps.length > 0 ? snaps[0] : null;
}

// ---- Enhancement E3: Revision Cards & Formula Sheets ----

export function getChapterNotes(chapterId?: string): ChapterNote[] {
  const all = getTable<ChapterNote>('chapter_notes');
  if (chapterId) return all.filter((n) => n.chapter_id === chapterId);
  return all;
}

export function getVerifiedChapterNotes(chapterId?: string): ChapterNote[] {
  return getChapterNotes(chapterId).filter((n) => n.verified_at !== null && n.verified_at !== undefined);
}

export function saveChapterNote(note: ChapterNote): ChapterNote {
  const all = getTable<ChapterNote>('chapter_notes');
  const idx = all.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    all[idx] = note;
  } else {
    all.push(note);
  }
  setTable('chapter_notes', all);
  return note;
}

export function verifyChapterNote(id: string, verifiedBy: string): boolean {
  const all = getTable<ChapterNote>('chapter_notes');
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], verified_at: new Date().toISOString(), verified_by: verifiedBy };
  setTable('chapter_notes', all);
  return true;
}

// ---- Enhancement E5: Advanced Exam Analytics ----

export function getExamAdvancedAnalytics(attemptId: string): ExamAdvancedAnalytics | null {
  const all = getTable<ExamAdvancedAnalytics>('exam_advanced_analytics');
  return all.find((a) => a.attempt_id === attemptId) ?? null;
}

export function saveExamAdvancedAnalytics(analytics: ExamAdvancedAnalytics): ExamAdvancedAnalytics {
  const all = getTable<ExamAdvancedAnalytics>('exam_advanced_analytics');
  const idx = all.findIndex((a) => a.attempt_id === analytics.attempt_id);
  if (idx >= 0) {
    all[idx] = analytics;
  } else {
    all.push(analytics);
  }
  setTable('exam_advanced_analytics', all);
  return analytics;
}

// ---- Enhancement E8: Monitor Reporting Upgrades ----

export function getSavedReportViews(): SavedReportView[] {
  return getTable<SavedReportView>('saved_report_views');
}

export function insertSavedReportView(view: SavedReportView): SavedReportView {
  return insertRow<SavedReportView>('saved_report_views', view);
}

export function deleteSavedReportView(id: string): boolean {
  return deleteRow('saved_report_views', id);
}

// ---- Enhancement E7: Auto-Compose Exam Draft & Study Planner ----

export function getStudyPlans(): StudyPlan[] {
  return getTable<StudyPlan>('study_plans');
}

export function insertStudyPlan(plan: StudyPlan): StudyPlan {
  return insertRow<StudyPlan>('study_plans', plan);
}

export function updateStudyPlan(id: string, patch: Partial<StudyPlan>): StudyPlan | null {
  return updateRow<StudyPlan>('study_plans', id, { ...patch, updated_at: new Date().toISOString() });
}

export function deleteStudyPlan(id: string): boolean {
  return deleteRow('study_plans', id);
}

// ---- Enhancement E4: Search & "More Like This" Embeddings ----

export function getQuestionSearchIndices(): QuestionSearchIndex[] {
  return getTable<QuestionSearchIndex>('question_search_indices');
}

export function insertQuestionSearchIndex(index: QuestionSearchIndex): QuestionSearchIndex {
  return insertRow<QuestionSearchIndex>('question_search_indices', index);
}

// ---- Enhancement E2: Subtopic Taxonomy & Prerequisite Concept Map ----

export function getSubtopics(chapterId?: string): Subtopic[] {
  const all = getTable<Subtopic>('subtopics');
  if (!chapterId) return all;
  return all.filter((st) => st.chapter_id === chapterId);
}

export function insertSubtopic(subtopic: Subtopic): Subtopic {
  return insertRow<Subtopic>('subtopics', subtopic);
}

export function getConceptPrerequisites(): ConceptPrerequisite[] {
  return getTable<ConceptPrerequisite>('concept_prerequisites');
}

export function insertConceptPrerequisite(prereq: ConceptPrerequisite): ConceptPrerequisite {
  return insertRow<ConceptPrerequisite>('concept_prerequisites', prereq);
}

// ---- Controlled Syllabus Hierarchy (Subject > Group > Chapter > Topic > Subtopic) ----

export function getSyllabusSubjects(): SyllabusSubject[] {
  return getTable<SyllabusSubject>('syllabus_subjects').sort((a, b) => a.sort_order - b.sort_order);
}

export function getSyllabusSubject(id: string): SyllabusSubject | null {
  return getSyllabusSubjects().find(s => s.id === id) ?? null;
}

export function insertSyllabusSubject(subject: SyllabusSubject): SyllabusSubject {
  return insertRow<SyllabusSubject>('syllabus_subjects', subject);
}

export function updateSyllabusSubject(id: string, patch: Partial<SyllabusSubject>): SyllabusSubject | null {
  return updateRow<SyllabusSubject>('syllabus_subjects', id, patch);
}

export function deleteSyllabusSubject(id: string): boolean {
  return deleteRow('syllabus_subjects', id);
}

export function getSyllabusGroups(subjectId?: string): SyllabusGroup[] {
  const all = getTable<SyllabusGroup>('syllabus_groups').sort((a, b) => a.sort_order - b.sort_order);
  if (!subjectId) return all;
  return all.filter(g => g.subject_id === subjectId);
}

export function getSyllabusGroup(id: string): SyllabusGroup | null {
  return getSyllabusGroups().find(g => g.id === id) ?? null;
}

export function insertSyllabusGroup(group: SyllabusGroup): SyllabusGroup {
  return insertRow<SyllabusGroup>('syllabus_groups', group);
}

export function updateSyllabusGroup(id: string, patch: Partial<SyllabusGroup>): SyllabusGroup | null {
  return updateRow<SyllabusGroup>('syllabus_groups', id, patch);
}

export function deleteSyllabusGroup(id: string): boolean {
  return deleteRow('syllabus_groups', id);
}

export function getSyllabusChapters(filter?: { subjectId?: string; groupId?: string; status?: string }): SyllabusChapter[] {
  let all = getTable<SyllabusChapter>('syllabus_chapters').sort((a, b) => a.sort_order - b.sort_order);
  if (filter?.subjectId) {
    all = all.filter(c => c.subject_id === filter.subjectId);
  }
  if (filter?.groupId) {
    all = all.filter(c => c.group_id === filter.groupId);
  }
  if (filter?.status) {
    all = all.filter(c => c.status === filter.status);
  }
  return all;
}

export function getSyllabusChapter(id: string): SyllabusChapter | null {
  return getTable<SyllabusChapter>('syllabus_chapters').find(c => c.id === id) ?? null;
}

export function insertSyllabusChapter(chapter: SyllabusChapter): SyllabusChapter {
  return insertRow<SyllabusChapter>('syllabus_chapters', chapter);
}

export function updateSyllabusChapter(id: string, patch: Partial<SyllabusChapter>): SyllabusChapter | null {
  return updateRow<SyllabusChapter>('syllabus_chapters', id, { ...patch, updated_at: new Date().toISOString() });
}

export function deleteSyllabusChapter(id: string): boolean {
  return deleteRow('syllabus_chapters', id);
}

export function getSyllabusTopics(chapterId?: string): SyllabusTopic[] {
  const all = getTable<SyllabusTopic>('syllabus_topics').sort((a, b) => a.sort_order - b.sort_order);
  if (!chapterId) return all;
  return all.filter(t => t.chapter_id === chapterId);
}

export function getSyllabusTopic(id: string): SyllabusTopic | null {
  return getTable<SyllabusTopic>('syllabus_topics').find(t => t.id === id) ?? null;
}

export function insertSyllabusTopic(topic: SyllabusTopic): SyllabusTopic {
  return insertRow<SyllabusTopic>('syllabus_topics', topic);
}

export function updateSyllabusTopic(id: string, patch: Partial<SyllabusTopic>): SyllabusTopic | null {
  return updateRow<SyllabusTopic>('syllabus_topics', id, { ...patch, updated_at: new Date().toISOString() });
}

export function deleteSyllabusTopic(id: string): boolean {
  return deleteRow('syllabus_topics', id);
}

export function getSyllabusSubtopics(topicId?: string): SyllabusSubtopic[] {
  const all = getTable<SyllabusSubtopic>('syllabus_subtopics').sort((a, b) => a.sort_order - b.sort_order);
  if (!topicId) return all;
  return all.filter(st => st.topic_id === topicId);
}

export function getSyllabusSubtopic(id: string): SyllabusSubtopic | null {
  return getTable<SyllabusSubtopic>('syllabus_subtopics').find(st => st.id === id) ?? null;
}

export function insertSyllabusSubtopic(subtopic: SyllabusSubtopic): SyllabusSubtopic {
  return insertRow<SyllabusSubtopic>('syllabus_subtopics', subtopic);
}

export function updateSyllabusSubtopic(id: string, patch: Partial<SyllabusSubtopic>): SyllabusSubtopic | null {
  return updateRow<SyllabusSubtopic>('syllabus_subtopics', id, { ...patch, updated_at: new Date().toISOString() });
}

export function deleteSyllabusSubtopic(id: string): boolean {
  return deleteRow('syllabus_subtopics', id);
}

export function getSyllabusAliases(subjectId?: string): SyllabusAlias[] {
  const all = getTable<SyllabusAlias>('syllabus_aliases');
  if (!subjectId) return all;
  return all.filter(a => a.subject_id === subjectId);
}

export function getSyllabusAlias(id: string): SyllabusAlias | null {
  return getTable<SyllabusAlias>('syllabus_aliases').find(a => a.id === id) ?? null;
}

export function insertSyllabusAlias(alias: SyllabusAlias): SyllabusAlias {
  return insertRow<SyllabusAlias>('syllabus_aliases', alias);
}

export function deleteSyllabusAlias(id: string): boolean {
  return deleteRow('syllabus_aliases', id);
}

export function resetDatabase(): void {
  lastRawString = {};
  lastParsedData = {};
  _questionIdMap = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('jph_'));
      keys.forEach(k => localStorage.removeItem(k));
    }
  } catch { }
  try {
    if (_importedMocksModule) {
      _importedMocksModule.clearImportedCache();
    }
  } catch { }
}
