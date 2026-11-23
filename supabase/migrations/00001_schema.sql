-- ============================================================
-- JEE Practice Hub — Migration 00001: Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'monitor')),
  name text NOT NULL,
  email text NOT NULL,
  linked_account_id uuid REFERENCES profiles(id),
  time_tracking_acknowledged boolean NOT NULL DEFAULT false,
  stopwatch_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideal_time_basic integer NOT NULL DEFAULT 60,
  ideal_time_medium integer NOT NULL DEFAULT 120,
  ideal_time_advanced integer NOT NULL DEFAULT 180,
  idle_timeout integer NOT NULL DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PATTERN PROFILES
CREATE TABLE IF NOT EXISTS pattern_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  questions_per_subject integer NOT NULL DEFAULT 25,
  mcq_per_subject integer NOT NULL DEFAULT 20,
  nvq_per_subject integer NOT NULL DEFAULT 5,
  duration_minutes integer NOT NULL DEFAULT 180,
  marks_correct_mcq numeric NOT NULL DEFAULT 4,
  marks_wrong_mcq numeric NOT NULL DEFAULT -1,
  marks_correct_nvq numeric NOT NULL DEFAULT 4,
  marks_wrong_nvq numeric NOT NULL DEFAULT 0,
  marks_unattempted numeric NOT NULL DEFAULT 0,
  nvq_attempt_rule text NOT NULL DEFAULT 'any_5_of_10',
  language_options text[] NOT NULL DEFAULT '{English}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PAPERS
CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam text NOT NULL,
  year integer NOT NULL,
  session text,
  date date,
  shift text,
  source text NOT NULL CHECK (source IN ('Official NTA','CBSE-era','third-party')),
  source_url text,
  answer_key_source text NOT NULL CHECK (answer_key_source IN ('NTA final','NTA provisional','third-party')),
  pattern_profile_id uuid REFERENCES pattern_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TAXONOMY
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE(subject_id, name)
);

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE(chapter_id, name)
);

-- QUESTIONS (Text only, NO answers or solutions)
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id),
  chapter_id uuid NOT NULL REFERENCES chapters(id),
  topic_id uuid NOT NULL REFERENCES topics(id),
  subtopic text,
  type text NOT NULL CHECK (type IN ('MCQ', 'NVQ')),
  section text NOT NULL CHECK (section IN ('A', 'B')),
  question_text text NOT NULL,
  options jsonb,
  figure_required boolean NOT NULL DEFAULT false,
  figure_status text NOT NULL DEFAULT 'none' CHECK (figure_status IN ('none','needed','attached','redrawn')),
  difficulty text NOT NULL CHECK (difficulty IN ('Basic','Medium','Advanced')),
  rating_source text NOT NULL DEFAULT 'draft' CHECK (rating_source IN ('draft','reviewed','recalibrated')),
  weightage_tag text,
  answer_status text NOT NULL DEFAULT 'Normal' CHECK (answer_status IN ('Normal','Dropped','Bonus','Multiple correct')),
  is_visible boolean GENERATED ALWAYS AS (
    answer_status != 'Dropped'
    AND (NOT figure_required OR figure_status IN ('attached','redrawn'))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- QUESTION ANSWERS (Isolated table)
CREATE TABLE IF NOT EXISTS question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  answer_text text,
  answer_status text NOT NULL DEFAULT 'Normal' CHECK (answer_status IN ('Normal','Dropped','Bonus','Multiple correct'))
);

-- SOLUTIONS (Isolated table)
CREATE TABLE IF NOT EXISTS solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  steps text NOT NULL,
  shortcut text,
  shortcut_type text,
  shortcut_note text,
  verification_status text NOT NULL DEFAULT 'Unverified' CHECK (verification_status IN ('Unverified','Key-matched','Reviewed','Flagged')),
  matches_key boolean,
  checked_by uuid REFERENCES profiles(id),
  human_reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ATTEMPTS
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice','exam')),
  subject_id uuid REFERENCES subjects(id),
  chapter_id uuid REFERENCES chapters(id),
  topic_id uuid REFERENCES topics(id),
  difficulty text,
  set_size integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  score numeric,
  total_marks numeric,
  submit_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RESPONSES
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer text,
  is_correct boolean,
  marks numeric,
  submitted_at timestamptz,
  level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- PRACTICED QUESTIONS
CREATE TABLE IF NOT EXISTS practiced_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  first_practiced_at timestamptz NOT NULL DEFAULT now(),
  first_answer text,
  practice_attempts integer NOT NULL DEFAULT 1,
  last_result boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, question_id)
);

-- BOOKMARKS
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, question_id)
);

-- VISITS (Telemetry)
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  active_seconds numeric NOT NULL DEFAULT 0,
  idle_seconds numeric NOT NULL DEFAULT 0,
  actions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PAUSE EVENTS
CREATE TABLE IF NOT EXISTS pause_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  kind text NOT NULL CHECK (kind IN ('pause_button', 'idle_gap')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SOLUTION VIEWS
CREATE TABLE IF NOT EXISTS solution_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opened_steps_at timestamptz,
  opened_shortcut_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FLAG REPORTS
CREATE TABLE IF NOT EXISTS flag_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

