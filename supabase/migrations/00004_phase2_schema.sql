-- ============================================================
-- JEE Practice Hub — Migration 00004: Phase 2 Schema Extensions
-- ============================================================

-- 1. EXAMS TABLE
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pattern_profile_id uuid REFERENCES pattern_profiles(id),
  duration_minutes integer NOT NULL DEFAULT 180,
  grace_period_seconds integer NOT NULL DEFAULT 0,
  start_window_start timestamptz,
  start_window_end timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_template boolean NOT NULL DEFAULT false,
  copy_of_id uuid REFERENCES exams(id),
  marks_correct_mcq numeric NOT NULL DEFAULT 4,
  marks_wrong_mcq numeric NOT NULL DEFAULT -1,
  marks_correct_nvq numeric NOT NULL DEFAULT 4,
  marks_wrong_nvq numeric NOT NULL DEFAULT 0,
  marks_unattempted numeric NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  max_marks numeric NOT NULL DEFAULT 300,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. EXAM QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id),
  chapter_id uuid NOT NULL REFERENCES chapters(id),
  section text NOT NULL CHECK (section IN ('A', 'B')),
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id, question_id)
);

-- 3. EXTEND ATTEMPTS TABLE FOR EXAM MODE
ALTER TABLE attempts 
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES exams(id),
  ADD COLUMN IF NOT EXISTS client_offset_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exam_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS tab_switches_count integer DEFAULT 0;

-- Unique constraint: exactly one attempt per exam per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_attempt_per_exam 
  ON attempts(exam_id, student_id) 
  WHERE mode = 'exam';

-- 4. EXTEND RESPONSES TABLE FOR NTA PALETTE & CONFIDENCE/ERROR TAGS
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS palette_status text DEFAULT 'not_visited'
    CHECK (palette_status IN ('not_visited', 'not_answered', 'answered', 'marked_for_review', 'answered_marked_for_review')),
  ADD COLUMN IF NOT EXISTS confidence text 
    CHECK (confidence IN ('Sure', 'Not sure', 'Guess')),
  ADD COLUMN IF NOT EXISTS error_reason text 
    CHECK (error_reason IN ('concept_gap', 'silly_mistake', 'calculation_error', 'time_pressure', 'guessed')),
  ADD COLUMN IF NOT EXISTS visit_order integer,
  ADD COLUMN IF NOT EXISTS answer_changes_count integer DEFAULT 0;

-- 5. MISTAKE NOTEBOOK (REVISION ITEMS)
CREATE TABLE IF NOT EXISTS revision_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  stage integer NOT NULL DEFAULT 1 CHECK (stage IN (1, 2, 3)), -- 1: 3 days, 2: 7 days, 3: 21 days
  due_at timestamptz NOT NULL,
  cleared boolean NOT NULL DEFAULT false,
  added_reason text NOT NULL CHECK (added_reason IN ('wrong_answer', 'slow_correct')),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, question_id)
);

-- 6. EXAM TELEMETRY EVENTS (Focus events, switches, exits)
CREATE TABLE IF NOT EXISTS exam_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('tab_switch', 'window_blur', 'fullscreen_exit', 'reload', 'answer_change', 'navigation')),
  details jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. MONITOR NOTICES (In-app alerts for auto-submits, reload exits)
CREATE TABLE IF NOT EXISTS monitor_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES attempts(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  reason text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. IMMUTABILITY TRIGGER FOR PUBLISHED EXAMS
CREATE OR REPLACE FUNCTION check_exam_immutability() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.status = 'published' THEN
    IF (OLD.name != NEW.name OR OLD.duration_minutes != NEW.duration_minutes OR OLD.pattern_profile_id != NEW.pattern_profile_id) THEN
      RAISE EXCEPTION 'Published exams cannot be modified. Create a copy to make changes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exam_immutable ON exams;
CREATE TRIGGER trg_exam_immutable
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION check_exam_immutability();
