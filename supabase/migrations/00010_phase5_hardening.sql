-- ============================================================
-- JEE Practice Hub — Migration 00010: Phase 5 Security Hardening & Observability
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   DROP INDEX IF EXISTS idx_single_active_exam_student;
--   DROP INDEX IF EXISTS idx_single_active_exam_attempt;
--   DROP TABLE IF EXISTS system_status_logs;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS privacy_acknowledged_at;
-- ============================================================

-- 1. FUNCTION HARDENING (search_path safety)
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 2. DUAL-TAB & CONCURRENCY EXAM ATTEMPT GUARDS
-- Ensures a student can have at most ONE active (unsubmitted) exam attempt at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_exam_student
  ON attempts(student_id)
  WHERE ended_at IS NULL AND mode = 'exam';

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_exam_attempt
  ON attempts(student_id, exam_id)
  WHERE ended_at IS NULL AND mode = 'exam';

-- 3. PROFILES PRIVACY CONSENT RECORD
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamptz;

-- 4. SYSTEM STATUS OBSERVABILITY LOGS
CREATE TABLE IF NOT EXISTS system_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  component text NOT NULL CHECK (component IN ('edge_function', 'cron', 'storage', 'auth', 'database', 'security')),
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'error')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS: Monitor-only access for observability logs
ALTER TABLE system_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_status_logs_select_monitor" ON system_status_logs
  FOR SELECT USING (get_user_role() = 'monitor');

CREATE POLICY "system_status_logs_insert_monitor" ON system_status_logs
  FOR INSERT WITH CHECK (get_user_role() = 'monitor');

