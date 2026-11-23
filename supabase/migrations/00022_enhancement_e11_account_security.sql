-- ============================================================
-- JEE Practice Hub — Migration 00022: Enhancement Module E11 (Account Security & Sessions)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS mfa_recovery_codes CASCADE;
--   DROP TABLE IF EXISTS csp_reports CASCADE;
--   DROP TABLE IF EXISTS user_sessions CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e11_account_security;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e11_account_security BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. User Active Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_agent TEXT,
  device_summary TEXT NOT NULL DEFAULT 'Unknown Device',
  ip_address TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions_own"
  ON user_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_sessions_monitor_select"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'monitor');

CREATE POLICY "user_sessions_monitor_update"
  ON user_sessions
  FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- 3. CSP Violation Reports Table
CREATE TABLE IF NOT EXISTS csp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uri TEXT NOT NULL,
  blocked_uri TEXT,
  violated_directive TEXT NOT NULL,
  raw_report JSONB NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE csp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csp_reports_insert_public"
  ON csp_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "csp_reports_monitor_select"
  ON csp_reports
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'monitor');

-- 4. MFA Recovery Codes Table (for TOTP Emergency Access)
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_codes_own"
  ON mfa_recovery_codes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

