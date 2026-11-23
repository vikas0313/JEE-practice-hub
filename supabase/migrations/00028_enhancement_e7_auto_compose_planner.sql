-- Migration: 00028_enhancement_e7_auto_compose_planner.sql
-- Description: E7 Auto-Compose Exam Draft & Study Planner
-- Rollback:
--   DROP TABLE IF EXISTS study_plans CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e7_exam_auto_composer;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS flag_e7_exam_auto_composer BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_date DATE NOT NULL,
    weekly_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Monitor only
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Monitor full access to study_plans"
ON study_plans
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'monitor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'monitor'
  )
);

