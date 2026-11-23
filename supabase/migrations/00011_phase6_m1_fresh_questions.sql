-- ============================================================
-- JEE Practice Hub — Migration 00011: Phase 6 Module M1 Fresh Questions
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   DROP TABLE IF EXISTS exam_question_fresh_flags;
--   ALTER TABLE practiced_questions DROP COLUMN IF EXISTS first_answer_source;
--   ALTER TABLE exams DROP COLUMN IF EXISTS fresh_question_share_pct;
--   ALTER TABLE exams DROP COLUMN IF EXISTS allow_fresh_questions;
-- ============================================================

-- 1. EXTEND EXAMS TABLE WITH FRESH QUESTION PARAMETERS
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS allow_fresh_questions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fresh_question_share_pct integer NOT NULL DEFAULT 30
    CHECK (fresh_question_share_pct BETWEEN 0 AND 100);

-- 2. CREATE MONITOR-ONLY FRESH FLAGS MAPPING TABLE
-- Stored in a separate table so Row Level Security completely conceals
-- fresh status from student queries (RLS filters rows, not columns).
CREATE TABLE IF NOT EXISTS exam_question_fresh_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_fresh boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id, question_id)
);

ALTER TABLE exam_question_fresh_flags ENABLE ROW LEVEL SECURITY;

-- Monitor gets full access to inspect and manage fresh flags
CREATE POLICY "exam_question_fresh_flags_monitor" ON exam_question_fresh_flags
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- Student has ZERO access policies on exam_question_fresh_flags.
-- Deny by default guarantees queries by students return 0 rows.

-- 3. EXTEND PRACTICED_QUESTIONS WITH FIRST_ANSWER_SOURCE
ALTER TABLE practiced_questions
  ADD COLUMN IF NOT EXISTS first_answer_source text NOT NULL DEFAULT 'practice'
    CHECK (first_answer_source IN ('practice', 'exam'));

