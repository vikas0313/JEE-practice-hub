-- ============================================================
-- JEE Practice Hub — Migration 00024: Enhancement Module E6 (Calibration & Error Analytics)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS calibration_snapshots CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e6_calibration_analytics;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e6_calibration_analytics BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Calibration Snapshots Table (Monitor-Only)
CREATE TABLE IF NOT EXISTS calibration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  brier_score NUMERIC(5,4),
  expected_calibration_error NUMERIC(5,4),
  confidence_accuracy_bins JSONB NOT NULL DEFAULT '[]'::jsonb,
  slip_rate NUMERIC(5,4),
  guess_rate NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calibration_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calibration_monitor_all"
  ON calibration_snapshots
  FOR ALL
  TO authenticated
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

