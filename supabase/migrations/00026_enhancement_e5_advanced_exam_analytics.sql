-- ============================================================
-- JEE Practice Hub — Migration 00026: Enhancement Module E5 (Advanced Exam Analytics)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS exam_advanced_analytics CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e5_advanced_exam_analytics;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e5_advanced_exam_analytics BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Advanced Exam Analytics Table (Monitor-Only)
CREATE TABLE IF NOT EXISTS exam_advanced_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  speed_accuracy_quadrants JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_order_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  what_if_simulation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exam_advanced_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_adv_monitor_all"
  ON exam_advanced_analytics
  FOR ALL
  TO authenticated
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

