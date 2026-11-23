-- ============================================================
-- JEE Practice Hub — Migration 00021: Enhancement Module E12 (Sync Idempotency & Resilience)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS dead_letter_jobs CASCADE;
--   DROP TABLE IF EXISTS client_event_sequences CASCADE;
--   DROP TABLE IF EXISTS sync_idempotency_keys CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e12_integrity_resilience;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e12_integrity_resilience BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Offline Sync Idempotency Keys Table
CREATE TABLE IF NOT EXISTS sync_idempotency_keys (
  key TEXT PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_hash TEXT NOT NULL,
  payload JSONB
);

ALTER TABLE sync_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_keys_student_own"
  ON sync_idempotency_keys
  FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "sync_keys_monitor_select"
  ON sync_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'monitor');

-- 3. Client Event Sequences for Gap Detection
CREATE TABLE IF NOT EXISTS client_event_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, sequence_number)
);

ALTER TABLE client_event_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_event_student_insert"
  ON client_event_sequences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "client_event_monitor_select"
  ON client_event_sequences
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'monitor');

-- 4. Queue Dead Letter Jobs for Transient Failure Isolation
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'discarded'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE dead_letter_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dead_letter_monitor_all"
  ON dead_letter_jobs
  FOR ALL
  TO authenticated
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

