-- ============================================================
-- JEE Practice Hub — Migration 00023: Enhancement Module E1 (Adaptive Practice & Spaced Repetition v2)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS spaced_repetition_cards CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e1_adaptive_repetition;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e1_adaptive_repetition BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Spaced Repetition Cards Table
CREATE TABLE IF NOT EXISTS spaced_repetition_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  interval_days NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  next_review_due TIMESTAMPTZ NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, question_id)
);

ALTER TABLE spaced_repetition_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spaced_cards_student_own"
  ON spaced_repetition_cards
  FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "spaced_cards_monitor_select"
  ON spaced_repetition_cards
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'monitor');

