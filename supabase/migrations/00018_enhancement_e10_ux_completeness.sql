-- ============================================================
-- JEE Practice Hub — Migration 00018: Enhancement Module E10 (UX Completeness)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS destructive_actions CASCADE;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_completed_at;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e10_ux_completeness;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e10_ux_completeness BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Onboarding Completion Timestamp on Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 3. Destructive Actions Table for Monitor Undo Capability
CREATE TABLE IF NOT EXISTS destructive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_before JSONB NOT NULL,
  payload_after JSONB,
  is_undone BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of pending undoable actions
CREATE INDEX IF NOT EXISTS idx_destructive_actions_monitor 
ON destructive_actions(monitor_id, is_undone, expires_at);

-- 4. Row Level Security for Destructive Actions
ALTER TABLE destructive_actions ENABLE ROW LEVEL SECURITY;

-- Monitor can read, insert, and update their own destructive actions
CREATE POLICY "monitor_destructive_actions_select" ON destructive_actions
  FOR SELECT
  USING (get_user_role() = 'monitor' AND monitor_id = auth.uid());

CREATE POLICY "monitor_destructive_actions_insert" ON destructive_actions
  FOR INSERT
  WITH CHECK (get_user_role() = 'monitor' AND monitor_id = auth.uid());

CREATE POLICY "monitor_destructive_actions_update" ON destructive_actions
  FOR UPDATE
  USING (get_user_role() = 'monitor' AND monitor_id = auth.uid())
  WITH CHECK (get_user_role() = 'monitor' AND monitor_id = auth.uid());

-- Students have ZERO access (deny by default via absence of student policy)

