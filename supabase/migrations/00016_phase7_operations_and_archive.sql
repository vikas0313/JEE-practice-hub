-- ============================================================
-- JEE Practice Hub — Migration 00016: Phase 7 Operations, Calibration & Archive
--
-- ROLLBACK NOTE:
-- Forward-only migration. If emergency rollback is required:
--   DROP TABLE IF EXISTS calibration_log;
--   DROP TABLE IF EXISTS real_exam_outcomes;
--   DROP TABLE IF EXISTS maintenance_records;
--   ALTER TABLE settings DROP COLUMN IF EXISTS archive_mode;
--   ALTER TABLE settings DROP COLUMN IF EXISTS stale_percentile_map_threshold_years;
--   ALTER TABLE settings DROP COLUMN IF EXISTS auto_expiry_log_days;
--   ALTER TABLE settings DROP COLUMN IF EXISTS auto_expiry_backup_days;
-- ============================================================

-- 1. EXTEND SETTINGS TABLE
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS archive_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_percentile_map_threshold_years integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS auto_expiry_log_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS auto_expiry_backup_days integer NOT NULL DEFAULT 30;

-- 2. CREATE REAL EXAM OUTCOMES TABLE
CREATE TABLE IF NOT EXISTS real_exam_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES student_profiles(id) ON DELETE CASCADE,
  exam_name text NOT NULL,
  exam_date date NOT NULL,
  actual_score numeric NOT NULL,
  actual_percentile numeric NOT NULL,
  actual_rank integer,
  category_rank integer,
  admit_card_app_no text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE real_exam_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "real_exam_outcomes_monitor_all" ON real_exam_outcomes
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- 3. CREATE CALIBRATION LOG TABLE
CREATE TABLE IF NOT EXISTS calibration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES student_profiles(id) ON DELETE CASCADE,
  real_outcome_id uuid REFERENCES real_exam_outcomes(id) ON DELETE CASCADE,
  target_id uuid REFERENCES targets(id) ON DELETE SET NULL,
  projection_snapshot_id text,
  predicted_score numeric NOT NULL,
  predicted_percentile numeric NOT NULL,
  predicted_rank integer,
  actual_score numeric NOT NULL,
  actual_percentile numeric NOT NULL,
  actual_rank integer,
  score_diff numeric NOT NULL,
  percentile_diff numeric NOT NULL,
  rank_diff integer,
  calibration_notes text NOT NULL DEFAULT 'N=1 calibration is anecdotal, not statistical. No automatic model tuning performed.',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calibration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calibration_log_monitor_all" ON calibration_log
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- 4. CREATE MAINTENANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('dependency_audit', 'key_rotation', 'backup_drill', 'archive_retention', 'monthly_review')),
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')),
  performed_by text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_records_monitor_all" ON maintenance_records
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- 5. ARCHIVE MODE IMMUTABILITY GUARD (RLS Helper Function)
CREATE OR REPLACE FUNCTION is_archive_mode_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT archive_mode FROM settings LIMIT 1), false);
$$;
