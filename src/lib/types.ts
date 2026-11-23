// ============================================================
// JEE Practice Hub — Type definitions
// Maps 1:1 to the Supabase schema (Phase 1 + Phase 2)
// ============================================================

export type Role = 'student' | 'monitor';
export type AccountStatus = 'active' | 'suspended' | 'pending_approval' | 'pending_email' | 'approved' | 'rejected';
export type QuestionType = 'MCQ' | 'NVQ';
export type Section = 'A' | 'B';
export type Difficulty = 'Basic' | 'Medium' | 'Advanced';
export type DifficultyFilter = Difficulty | 'Mixed';
export type FigureStatus = 'none' | 'needed' | 'attached' | 'redrawn';
export type AnswerStatus = 'Normal' | 'Dropped' | 'Bonus' | 'Multiple correct' | 'Standard';
export type RatingSource = 'draft' | 'reviewed' | 'recalibrated' | 'pilot' | 'demo';
export type VerificationStatus = 'Unverified' | 'Key-matched' | 'Reviewed' | 'Flagged';
export type ShortcutType =
  | 'formula trick'
  | 'option elimination'
  | 'back-substitution'
  | 'dimensional analysis'
  | 'approximation'
  | 'symmetry'
  | 'special-case check';
export type Source = 'Official NTA' | 'CBSE-era' | 'third-party' | 'jee_advanced';
export type AnswerKeySource = 'NTA final' | 'NTA provisional' | 'third-party';
export type PauseKind = 'pause_button' | 'idle_gap';
export type FlagStatus = 'open' | 'reviewed' | 'dismissed';

// Phase 2: Palette, Confidence, Error Reasons, Exam End Reasons
export type PaletteStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_marked_for_review';

export type ConfidenceTag = 'Sure' | 'Not sure' | 'Guess';
export type ErrorReason =
  | 'Calculation error'
  | 'Formula forgotten / misremembered'
  | 'Misread question'
  | 'Conceptual gap'
  | 'Ran out of time / rushed'
  | 'calculation_error'
  | 'formula_forgotten'
  | 'misread_question'
  | 'conceptual_gap'
  | 'time_pressure'
  | 'silly_mistake'
  | 'guessed';
export type ExamSubmitReason = 'submitted' | 'time_up' | 'left_full_screen' | 'no_signal';
export type RevisionReason = 'wrong_answer' | 'slow_correct';

// ---- Identity ----

export interface Profile {
  id: string;
  role: Role;
  status: AccountStatus;
  name: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  college_name?: string;
  email: string;
  password?: string; // plaintext for local dev only
  linked_account_id: string | null;
  requested_at?: string;
  email_verified_at?: string | null;
  email_verified?: boolean; // false per Amendment 1
  decided_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
  consent_tracking_at?: string | null;
  consent_guardian_at?: string | null;
  incomplete_profile?: boolean;
  time_tracking_acknowledged: boolean;
  privacy_acknowledged_at?: string | null;
  is_mfa_enabled?: boolean;
  stopwatch_visible: boolean;
  preferred_language?: 'english' | 'hindi';
  onboarding_completed_at?: string | null;
  preferences?: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface StudentSettings {
  student_id: string;
  stopwatch_visible?: boolean | null;
  ideal_time_basic?: number | null;
  ideal_time_medium?: number | null;
  ideal_time_advanced?: number | null;
  idle_timeout?: number | null;
  updated_at?: string;
}

export interface Settings {
  id: string;
  ideal_time_basic: number;    // seconds
  ideal_time_medium: number;
  ideal_time_advanced: number;
  idle_timeout: number;        // seconds
  registrations_open?: boolean;
  registration_enabled?: boolean; // master on/off switch for registration (default true in dev/staging, false in prod until legal review)
  require_approval?: boolean; // default false per Amendment 1
  daily_registration_cap?: number; // default 50 per Amendment 1
  registration_in_app_notice?: boolean; // default true per Amendment 1
  max_pending_registrations?: number;
  exam_conditions_adjustment_enabled?: boolean;
  allow_physical_keypad_a11y?: boolean;
  include_jee_advanced_in_practice?: boolean;
  archive_mode?: boolean;
  stale_percentile_map_threshold_years?: number;
  auto_expiry_log_days?: number;
  auto_expiry_backup_days?: number;
  flag_e10_ux_completeness?: boolean;
  flag_e9_performance_and_visual_polish?: boolean;
  flag_e13_enhanced_testing?: boolean;
  flag_e12_integrity_resilience?: boolean;
  flag_e11_account_security?: boolean;
  flag_e1_adaptive_repetition?: boolean;
  flag_e6_calibration_analytics?: boolean;
  flag_e3_revision_cards?: boolean;
  flag_e5_advanced_exam_analytics?: boolean;
  flag_e8_custom_reporting?: boolean;
  flag_e7_exam_auto_composer?: boolean;
  flag_e4_question_search_embeddings?: boolean;
  flag_e2_concept_map?: boolean;
  flag_g3_practice_scratchpad?: boolean;
  flag_imported_mocks_enabled?: boolean;
  updated_at: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  fontSize?: 'normal' | 'large' | 'xlarge';
  highContrast?: boolean;
  reducedMotion?: boolean;
}

export interface PrefetchedQuestionText {
  question_id: string;
  type: QuestionType;
  question_text: string;
  section: Section;
  options: string[] | null;
  figure_required: boolean;
  correct_answer: null;
  solution_text: null;
}

export interface DestructiveAction {
  id: string;
  monitor_id: string;
  action_type: 'delete_exam' | 'rollback_paper' | 'archive_session' | 'reset_practice';
  target_id: string;
  description: string;
  payload_before: Record<string, any>;
  payload_after?: Record<string, any> | null;
  is_undone: boolean;
  expires_at: string;
  created_at: string;
}

export interface StudentResultExportRow {
  question_id: string;
  subject: string;
  chapter: string;
  question_type: string;
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  marks_awarded: number;
  solution_text: string | null;
  shortcut_text: string | null;
  error_tag?: string | null;
  confidence_tag?: string | null;
  // NOTE: STRICTLY ZERO TIME DATA PER SRD VISIBILITY MATRIX
}

// ---- Enhancement E12: Sync Idempotency & Resilience ----

export interface SyncIdempotencyKey {
  key: string;
  student_id: string;
  attempt_id: string | null;
  processed_at: string;
  response_hash: string;
  payload?: any;
}

export interface ClientEventSequence {
  id: string;
  attempt_id: string;
  sequence_number: number;
  event_type: string;
  payload: any;
  created_at: string;
}

export interface DeadLetterJob {
  id: string;
  job_type: string;
  payload: any;
  error_message: string;
  attempts_count: number;
  status: 'pending' | 'resolved' | 'discarded';
  created_at: string;
  resolved_at?: string | null;
}

export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  status: CircuitBreakerStatus;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

// ---- Enhancement E11: Account Security & Sessions ----

export interface UserSession {
  id: string;
  user_id: string;
  user_agent?: string | null;
  device_summary: string;
  ip_address?: string | null;
  last_active_at: string;
  is_revoked: boolean;
  created_at: string;
}

export interface CspReport {
  id: string;
  document_uri: string;
  blocked_uri?: string | null;
  violated_directive: string;
  raw_report: Record<string, any>;
  reported_at: string;
}

export interface MfaRecoveryCode {
  id: string;
  user_id: string;
  code_hash: string;
  is_used: boolean;
  used_at?: string | null;
  created_at: string;
}

// ---- Enhancement E1: Adaptive Spaced Repetition v2 ----

export interface SpacedRepetitionCard {
  id: string;
  student_id: string;
  question_id: string;
  interval_days: number;
  ease_factor: number;
  consecutive_correct: number;
  next_review_due: string;
  last_reviewed_at: string | null;
  updated_at: string;
}

export interface TodayRecommendation {
  question_id: string;
  subject_name: string;
  chapter_name: string;
  reason_badge: 'Review due' | 'High weightage' | 'Mistake review';
  due_date?: string;
}

// ---- Enhancement E6: Calibration & Error Analytics ----

export interface ConfidenceAccuracyBin {
  bin_start: number; // e.g. 0.0, 0.2, 0.4
  bin_end: number;   // e.g. 0.2, 0.4, 0.6
  sample_count: number;
  expected_confidence: number;
  observed_accuracy: number;
}

export interface CalibrationSnapshot {
  id: string;
  student_id: string;
  as_of: string;
  brier_score: number | null;
  expected_calibration_error: number | null;
  confidence_accuracy_bins: ConfidenceAccuracyBin[];
  slip_rate: number | null;
  guess_rate: number | null;
  created_at: string;
}

export interface ErrorMatrixSummary {
  conceptual_error_count: number;
  calculation_error_count: number;
  careless_error_count: number;
  time_pressure_error_count: number;
  total_classified_errors: number;
}

// ---- Enhancement E3: Revision Cards & Formula Sheets ----

export interface ChapterNote {
  id: string;
  chapter_id: string;
  title: string;
  content_markdown: string;
  formula_sheet_url?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  created_at: string;
}

export interface PrintableFormulaSheet {
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  formulas: { title: string; latex: string; explanation?: string }[];
  verified: boolean;
}

// ---- Enhancement E5: Advanced Exam Analytics ----

export interface SpeedAccuracyQuadrant {
  efficient_mastery_count: number; // Fast & Correct
  rushed_error_count: number;      // Fast & Incorrect
  time_sink_count: number;         // Slow & Correct
  stuck_bottleneck_count: number;  // Slow & Incorrect
  total_analyzed: number;
}

export interface AttemptOrderAnalysis {
  strategy_classification: '2-Pass Strategy' | 'Linear' | 'Disorganized Jumping';
  round1_attempts_count: number;
  round2_attempts_count: number;
  pass_switch_count: number;
  average_time_gap_seconds: number;
}

export interface WhatIfSimulationResult {
  actual_score: number;
  potential_score_if_slips_avoided: number;
  potential_score_if_guesses_omitted: number;
  slips_avoidable_count: number;
  estimated_percentile_gain: number;
}

export interface ExamAdvancedAnalytics {
  id: string;
  attempt_id: string;
  speed_accuracy_quadrants: SpeedAccuracyQuadrant;
  attempt_order_strategy: AttemptOrderAnalysis;
  what_if_simulation: WhatIfSimulationResult;
  created_at: string;
}

// ---- Enhancement E8: Monitor Reporting Upgrades ----

export interface ReportFilterCriteria {
  date_range: 'all' | 'today' | 'week' | 'month' | 'custom';
  start_date?: string;
  end_date?: string;
  subject_id?: string | null;
  mode?: 'all' | 'practice' | 'exam';
  confidence?: ConfidenceTag | null;
  error_reason?: ErrorReason | null;
  min_score?: number;
  max_score?: number;
}

export interface SavedReportView {
  id: string;
  name: string;
  description?: string;
  filters: ReportFilterCriteria;
  created_at: string;
  updated_at: string;
}

export interface MonthlyDigestMetrics {
  period_start: string;
  period_end: string;
  total_questions_attempted: number;
  overall_accuracy: number;
  practice_questions_count: number;
  exam_questions_count: number;
  subject_breakdowns: {
    subject_name: string;
    questions_attempted: number;
    accuracy: number;
  }[];
  top_error_reasons: {
    reason: string;
    count: number;
  }[];
  active_days_count: number;
  average_speed_index: number;
}

// ---- Enhancement E7: Auto-Compose Exam Draft & Study Planner ----

export interface WeeklyStudyTarget {
  week_number: number;
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  target_questions: number;
  completed_questions: number;
}

export interface StudyPlan {
  id: string;
  title: string;
  target_date: string;
  weekly_targets: WeeklyStudyTarget[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AutoComposeCriteria {
  exam_name: string;
  pattern_profile_id?: string | null;
  duration_minutes?: number;
  questions_per_subject?: number; // default 25 (20 MCQ + 5 NVQ)
  difficulty_ratio?: { basic: number; medium: number; advanced: number };
  allow_fresh_questions?: boolean;
  fresh_question_share_pct?: number;
}

export interface AutoComposeResult {
  exam: Exam;
  exam_questions: ExamQuestion[];
  unfulfilled_notices: string[];
}

// ---- Enhancement E4: Search & "More Like This" Embeddings ----

export interface QuestionSearchIndex {
  id: string;
  question_id: string;
  search_tokens: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface QuestionSearchResult {
  question: Question;
  match_score: number;
  highlight_snippet?: string;
}

// ---- Enhancement E2: Subtopic Taxonomy & Prerequisite Concept Map ----

export interface Subtopic {
  id: string;
  chapter_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface ConceptPrerequisite {
  id: string;
  concept_id: string; // Subtopic that requires prerequisite
  prerequisite_concept_id: string; // Subtopic that is required first
  notes?: string | null;
  created_at: string;
}

export interface PrerequisiteNode {
  subtopic: Subtopic;
  prerequisites: Subtopic[];
  dependents: Subtopic[];
  is_ready: boolean;
}

// ---- Content: Public ----

export type PaperStatus =
  | 'registered'
  | 'extracted'
  | 'tagged'
  | 'solved'
  | 'in_review'
  | 'ready'
  | 'published'
  | 'rolled_back';

export type KeyStatus = 'provisional' | 'final' | 'disputed';

export interface Paper {
  id: string;
  exam: string;
  year: number;
  session: string | null;
  date: string | null;
  shift: string | null;
  source: Source;
  source_url: string | null;
  date_retrieved?: string | null;
  source_file_sha256?: string | null;
  key_source?: AnswerKeySource;
  answer_key_source?: AnswerKeySource;
  key_status?: KeyStatus;
  pattern_profile_id: string | null;
  profile_verified_at?: string | null;
  profile_verified_by?: string | null;
  information_bulletin_ref?: string | null;
  status?: PaperStatus;
  is_synthetic?: boolean;
  created_at: string;
}

export interface PatternProfile {
  id: string;
  name: string;
  description?: string;
  questions_per_subject: number;
  mcq_per_subject: number;
  nvq_per_subject: number;
  duration_minutes: number;
  marks_correct_mcq: number;
  marks_wrong_mcq: number;
  marks_correct_nvq: number;
  marks_wrong_nvq: number;
  marks_unattempted: number;
  nvq_attempt_rule: string;
  nvq_attempt_limit_per_subject?: number | null;
  language_options: string[];
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
}

export interface Topic {
  id: string;
  chapter_id: string;
  name: string;
}

// Question text only — no answer, no solution
export interface Question {
  id: string;
  number: number;
  paper_id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  subtopic: string | null;
  primary_chapter_id?: string | null;
  primary_topic_id?: string | null;
  primary_subtopic_id?: string | null;
  secondary_chapter_id?: string | null;
  secondary_topic_id?: string | null;
  type: QuestionType;
  section: Section;
  question_text: string;
  options: string[] | null;    // null for NVQ
  figure?: string | null;
  figure_required: boolean;
  figure_status: FigureStatus;
  difficulty: Difficulty;
  rating_source: RatingSource;
  weightage_tag: string | null;
  answer_status: AnswerStatus;
  verification_status?: VerificationStatus;
  flagged_for_review?: boolean;
  flag_reason?: string | null;
  is_active?: boolean;
  batch_id?: string | null;
  superseded_by?: string | null;
  draft_level?: Difficulty | null;
  rubric_version?: string | null;
  tag_confidence?: number | null;
  needs_tag_review?: boolean;
  needs_key_review?: boolean;
  provenance?: Record<string, any> | null;
  is_synthetic?: boolean;
  created_at: string;
  updated_at: string;
}

// Separate table — released only after student submits and not during open exam
export interface QuestionAnswer {
  id: string;
  question_id: string;
  correct_answer: string;
  answer_text?: string | null;
  answer_status: AnswerStatus;
  created_at?: string;
}

export interface QuestionTranslation {
  id: string;
  question_id: string;
  language: 'english' | 'hindi';
  question_text: string;
  options: string[] | null;
  created_at: string;
}

export interface Solution {
  id: string;
  question_id: string;
  steps: string;
  shortcut: string | null;
  shortcut_type: ShortcutType | null;
  shortcut_note: string | null;
  verification_status: VerificationStatus;
  matches_key: boolean | null;
  checked_by: string | null;
  human_reviewed: boolean;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FigureAsset {
  id: string;
  question_id: string;
  file_path: string;
  status: FigureStatus;
  origin: 'NTA PDF' | 'redrawn' | null;
  created_at: string;
}

// ---- Phase 2: Exams & Builder ----

export interface Exam {
  id: string;
  name: string;
  pattern_profile_id: string | null;
  duration_minutes: number;
  grace_period_seconds: number;
  start_window_start: string | null;
  start_window_end: string | null;
  status: 'draft' | 'published' | 'archived';
  is_template: boolean;
  copy_of_id: string | null;
  marks_correct_mcq: number;
  marks_wrong_mcq: number;
  marks_correct_nvq: number;
  marks_wrong_nvq: number;
  marks_unattempted: number;
  total_questions: number;
  max_marks: number;
  allow_fresh_questions?: boolean;
  fresh_question_share_pct?: number;
  student_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_id: string;
  subject_id: string;
  chapter_id: string;
  section: Section;
  order_index: number;
  created_at: string;
}

export interface ExamQuestionFreshFlag {
  id: string;
  exam_id: string;
  question_id: string;
  is_fresh: boolean;
  created_at: string;
}

// ---- Student Activity ----

export interface Attempt {
  id: string;
  student_id: string;
  mode: 'practice' | 'exam';
  exam_id?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  difficulty?: DifficultyFilter | null;
  set_size?: number | null;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  total_marks: number | null;
  submit_reason: ExamSubmitReason | 'manual' | null;
  client_offset_ms?: number;
  exam_duration_minutes?: number;
  deadline_at?: string | null;
  tab_switches_count?: number;
  created_at: string;
}

export interface Response {
  id: string;
  attempt_id: string;
  question_id: string;
  student_id: string;
  answer: string | null;
  is_correct: boolean | null;
  marks: number | null;
  submitted_at: string | null;
  level: Difficulty | null;
  palette_status?: PaletteStatus;
  confidence?: ConfidenceTag | null;
  error_reason?: ErrorReason | null;
  visit_order?: number | null;
  answer_changes_count?: number;
  language?: 'english' | 'hindi';
  created_at: string;
  updated_at: string;
}

export interface PracticedQuestion {
  id: string;
  student_id: string;
  question_id: string;
  first_practiced_at: string;
  first_answer: string | null;
  first_answer_source?: 'practice' | 'exam';
  practice_attempts: number;
  last_result: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id: string;
  student_id: string;
  question_id: string;
  note: string | null;
  created_at: string;
}

// ---- Phase 2: Mistake Notebook (Spaced Repetition) ----

export interface RevisionItem {
  id: string;
  student_id: string;
  question_id: string;
  stage: 1 | 2 | 3; // 3 days, 7 days, 21 days
  due_at: string;
  cleared: boolean;
  added_reason: RevisionReason;
  last_attempt_at: string;
  created_at: string;
  updated_at: string;
}

// ---- Phase 2: Telemetry & Notices ----

export interface ExamTelemetryEvent {
  id: string;
  attempt_id: string;
  student_id: string;
  event_type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'fullscreen_restored' | 'reload' | 'answer_change' | 'navigation';
  details: Record<string, unknown> | null;
  timestamp: string;
  created_at: string;
}

export interface MonitorNotice {
  id: string;
  exam_id: string | null;
  attempt_id: string | null;
  student_id: string | null;
  message: string;
  reason: string;
  read: boolean;
  created_at: string;
}

// ---- Monitor-only Telemetry (Phase 1) ----

export interface Visit {
  id: string;
  response_id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  idle_seconds: number;
  actions: unknown[] | null;
  created_at: string;
}

export interface PauseEvent {
  id: string;
  visit_id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
  kind: PauseKind;
  created_at: string;
}

export interface SolutionView {
  id: string;
  response_id: string;
  student_id: string;
  opened_steps_at: string | null;
  opened_shortcut_at: string | null;
  created_at: string;
}

// ---- Settings & Control ----

export interface FlagReport {
  id: string;
  question_id: string;
  reporter_id: string;
  reason: string;
  status: FlagStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown | null;
  created_at: string;
}

// ---- Helpers ----

export function isQuestionVisible(q: Question): boolean {
  if (q.is_active === false) return false;
  if (q.superseded_by) return false;
  if (q.needs_key_review) return false;
  if (q.needs_tag_review) return false;
  if (q.answer_status === 'Dropped') return false;
  if (q.figure_required && q.figure_status !== 'attached' && q.figure_status !== 'redrawn') return false;
  return true;
}

export function getIdealTime(settings: Settings, level: Difficulty): number {
  switch (level) {
    case 'Basic': return settings.ideal_time_basic;
    case 'Medium': return settings.ideal_time_medium;
    case 'Advanced': return settings.ideal_time_advanced;
  }
}

export interface MasteryStats {
  basic: { total: number; correct: number; accuracy: number | null };
  medium: { total: number; correct: number; accuracy: number | null };
  advanced: { total: number; correct: number; accuracy: number | null };
  stepAchieved: 0 | 1 | 2 | 3;
  recommendedDifficulty: 'Basic' | 'Medium' | 'Advanced';
  advisoryMessage: string | null;
}

// Pilot JSON import format
export interface PilotQuestionRecord {
  id: string;
  number: number;
  paper: {
    exam: string;
    year: number;
    session: string;
    date: string;
    shift: string;
  };
  source: Source;
  answer_key_source: AnswerKeySource;
  subject: string;
  chapter: string;
  topic: string;
  subtopic: string | null;
  type: QuestionType;
  section: Section;
  question_text: string;
  options: string[] | null;
  figure: string | null;
  figure_required: boolean;
  figure_status: FigureStatus;
  correct_answer: string;
  answer_text?: string | null;
  answer_status: AnswerStatus;
  difficulty: Difficulty;
  rating_source: RatingSource;
  weightage_tag: string | null;
  solution_steps: string;
  shortcut: string | null;
  shortcut_type: ShortcutType | null;
  shortcut_note: string | null;
  translations?: Array<{
    language: 'english' | 'hindi';
    question_text: string;
    options?: string[] | null;
  }>;
  verification_status: VerificationStatus;
  matches_key: boolean | null;
  checked_by: string | null;
  human_reviewed: boolean;
}

// ============================================================
// Phase 3: Targets, Percentile Maps, Bayesian Estimates,
// Alerts, Assignments, and Shortcut Retries
// ============================================================

export type TargetType = 'percentile' | 'rank' | 'cutoff';
export type CutoffUnit = 'marks' | 'percentile';

export interface Target {
  id: string;
  student_id: string;
  name: string;
  target_type: TargetType;
  target_value: number;
  candidate_count?: number | null; // N required if target_type is 'rank'
  cutoff_unit?: CutoffUnit | null;
  exam_date: string; // YYYY-MM-DD
  reference_map_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PercentileMap {
  id: string;
  name: string;
  year: number;
  shift: string;
  source: string;
  is_approximation: boolean;
  created_at: string;
}

export interface PercentileMapRow {
  id: string;
  map_id: string;
  marks: number;
  percentile: number;
}

export interface ChapterWeightage {
  id: string;
  pattern_profile_id: string;
  subject: string;
  chapter: string;
  expected_questions: number;
  is_manual_override: boolean;
  updated_at: string;
}

export type EstimateDisplayMode = 'range' | 'band';
export type CoarseBand = 'Low' | 'Medium' | 'High' | 'Not enough data yet';

export interface EstimateSnapshot {
  id: string;
  student_id: string;
  target_id: string;
  as_of: string;
  qualifying_questions_count: number;
  qualifying_chapters_count: number;
  coverage_percentage: number;
  p10_percentile: number | null;
  p50_percentile: number | null;
  p90_percentile: number | null;
  chance_probability_rounded: number | null; // rounded to nearest 5% (0.00 to 1.00)
  model_metadata: {
    status?: 'sufficient' | 'insufficient_data' | 'needs_percentile_map';
    message?: string;
    target_percentile?: number;
    draws_count?: number;
    coverage_percentage?: number;
    practice_first_answers_count?: number;
    exam_fresh_answers_count?: number;
    data_note?: string;
    exam_conditions_adjustment_applied?: boolean;
    exam_conditions_adjustment_delta?: number;
    chapter_posteriors?: Record<string, { alpha: number; beta: number; expected_questions: number }>;
  };
  created_at: string;
}

export interface StudentEstimate {
  id: string;
  student_id: string;
  target_id: string;
  display_mode: EstimateDisplayMode;
  projected_range_low: number | null;
  projected_range_high: number | null;
  coarse_band: CoarseBand | null;
  as_of: string;
  updated_at: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  student_id: string;
  alert_type: string;
  severity: AlertSeverity;
  dedupe_key: string;
  title: string;
  message: string;
  status: AlertStatus;
  cooldown_until?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  resolved_at?: string | null;
}

export interface AlertSettings {
  id: string;
  inactivity_days: number;
  accuracy_drop_threshold: number; // e.g. 0.15 for 15% drop
  email_alerts_enabled: boolean;
  monitor_email: string | null;
  updated_at: string;
}

export type AssignmentStatus = 'active' | 'completed' | 'cancelled';

export interface Assignment {
  id: string;
  student_id: string;
  title: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  level?: DifficultyFilter | null;
  target_count: number;
  due_date: string; // ISO string
  status: AssignmentStatus;
  created_at: string;
}

export type ShortcutVerdict = 'faster' | 'slower';

export interface ShortcutRetry {
  id: string;
  student_id: string;
  question_id: string;
  baseline_active_seconds: number;
  retry_active_seconds: number;
  verdict: ShortcutVerdict;
  submitted_answer: string;
  is_correct: boolean;
  created_at: string;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  email_type: string;
  idempotency_key: string;
  status: 'sent' | 'failed';
  sent_at: string;
}

// ============================================================
// PHASE 6 MODULE M7: MONITOR ANALYTICS & PROJECTIONS
// ============================================================

export interface ShrinkageProjectionPoint {
  week: number;
  date: string;
  projected_pct: number;
  ci_lower_pct: number;
  ci_upper_pct: number;
}

export interface ShrinkageProjectionResult {
  status: 'sufficient' | 'insufficient_history';
  current_weeks: number;
  required_weeks: number;
  current_first_answers: number;
  required_first_answers: number;
  chapters_covered: number;
  required_chapters: number;
  message?: string;
  current_chance_pct?: number;
  ols_slope_pct_per_week?: number;
  shrinkage_factor?: number;
  shrunk_slope_pct_per_week?: number;
  target_exam_date?: string;
  projected_exam_chance_pct?: number;
  ci_lower_pct?: number;
  ci_upper_pct?: number;
  trajectory_points?: ShrinkageProjectionPoint[];
  disclaimer: string;
}

export interface ExamConditionsAdjustmentResult {
  eligible: boolean;
  fresh_exam_answers_count: number;
  required_count: number;
  exam_accuracy_pct?: number;
  practice_accuracy_pct?: number;
  adjustment_delta: number; // e.g. -0.05 for a 5% drop under exam pressure
  message: string;
}

export interface AssignmentSuggestion {
  id: string;
  type: 'weak_chapter' | 'slow_pacing' | 'unvisited_topic';
  title: string;
  description: string;
  subject_id: string;
  chapter_id: string;
  topic_id?: string;
  recommended_question_count: number;
  metric_summary: string;
}

// ============================================================
// PHASE 6 MODULE M5: MONITOR-CURATED RESOURCE LINKS
// ============================================================

export type ResourceType = 'video' | 'notes' | 'solution' | 'external';

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  resource_type: ResourceType;
  subject_id?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  question_id?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// PHASE 7: OPERATIONS, TUNING, CALIBRATION & ARCHIVE
// ============================================================

export interface RealExamOutcome {
  id: string;
  student_id: string;
  exam_name: string;
  exam_date: string;
  actual_score: number;
  actual_percentile: number;
  actual_rank?: number | null;
  category_rank?: number | null;
  admit_card_app_no?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalibrationLogEntry {
  id: string;
  student_id: string;
  real_outcome_id: string;
  target_id?: string | null;
  projection_snapshot_id?: string | null;
  predicted_score: number;
  predicted_percentile: number;
  predicted_rank?: number | null;
  actual_score: number;
  actual_percentile: number;
  actual_rank?: number | null;
  score_diff: number;
  percentile_diff: number;
  rank_diff?: number | null;
  calibration_notes: string;
  created_at: string;
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

export type MaintenanceTaskType =
  | 'dependency_audit'
  | 'key_rotation'
  | 'backup_drill'
  | 'archive_retention'
  | 'monthly_review';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed';

export interface MaintenanceRecord {
  id: string;
  task_name: string;
  task_type: MaintenanceTaskType;
  status: MaintenanceStatus;
  performed_by: string;
  details?: Record<string, any>;
  completed_at?: string | null;
  created_at: string;
}

// ============================================================
// CONTROLLED SYLLABUS TYPES (Subject > Group > Chapter > Topic > Subtopic)
// ============================================================
export type SyllabusStatus = 'listed_in_guide' | 'verify_current_syllabus' | 'confirmed' | 'removed';
export type ControlledSyllabusItemStatus = 'active' | 'inactive';
export type SyllabusAliasTargetType = 'chapter' | 'topic' | 'subtopic';

export interface SyllabusSubject {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface SyllabusGroup {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface SyllabusChapter {
  id: string;
  external_id?: string | null;
  subject_id: string;
  group_id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: ControlledSyllabusItemStatus;
  syllabus_status: SyllabusStatus;
  source_note?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyllabusTopic {
  id: string;
  chapter_id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: ControlledSyllabusItemStatus;
  created_at: string;
  updated_at: string;
}

export interface SyllabusSubtopic {
  id: string;
  topic_id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: ControlledSyllabusItemStatus;
  created_at: string;
  updated_at: string;
}

export interface SyllabusAlias {
  id: string;
  alias: string;
  target_type: SyllabusAliasTargetType;
  target_id: string;
  subject_id: string;
  created_by?: string | null;
  created_at: string;
}



