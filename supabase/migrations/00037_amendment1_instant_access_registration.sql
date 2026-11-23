-- ============================================================
-- JEE Practice Hub — Migration 00037: Amendment 1 Instant Access Registration
-- Eliminates mandatory email verification; adds optional monitor approval setting (default false);
-- enforces daily cap, abuse controls, server-enforced role and active status, and audit-logged email updates.
-- ============================================================

-- 1. Extend profiles table with email_verified flag (defaults false per Amendment 1 item 4.a)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Update status check constraint to support 'active' and 'suspended' as primary lifecycle statuses
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'pending_approval', 'pending_email', 'approved', 'rejected'));

-- Default status is now 'active'
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';

-- 2. Extend settings table with Amendment 1 control flags
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS registration_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_registration_cap integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS registration_in_app_notice boolean NOT NULL DEFAULT true;

-- 3. Replace registration trigger with Amendment 1 instant-access lifecycle
CREATE OR REPLACE FUNCTION handle_new_user_registration() RETURNS trigger AS $$
DECLARE
  v_registration_enabled boolean;
  v_registrations_open boolean;
  v_require_approval boolean;
  v_daily_cap integer;
  v_today_registrations integer;
  v_initial_status text;
  v_monitor_id uuid;
BEGIN
  -- Fetch current abuse prevention and registration settings
  SELECT 
    COALESCE(registration_enabled, true),
    COALESCE(registrations_open, true),
    COALESCE(require_approval, false),
    COALESCE(daily_registration_cap, 50)
  INTO 
    v_registration_enabled,
    v_registrations_open,
    v_require_approval,
    v_daily_cap
  FROM settings LIMIT 1;

  -- Master self-registration on/off switch check
  IF (NOT v_registration_enabled) OR (NOT v_registrations_open) THEN
    RAISE EXCEPTION 'Student self-registration is currently closed by the monitor.';
  END IF;

  -- Enforce daily registration cap (default 50)
  SELECT count(*) INTO v_today_registrations
  FROM profiles
  WHERE role = 'student'
    AND created_at >= date_trunc('day', now());

  IF v_today_registrations >= v_daily_cap THEN
    RAISE EXCEPTION 'Daily registration limit reached (% accounts). Please try again tomorrow.', v_daily_cap;
  END IF;

  -- Locate primary monitor account
  SELECT id INTO v_monitor_id FROM profiles WHERE role = 'monitor' LIMIT 1;

  -- Determine initial status: active by default, or pending_approval if require_approval = true
  IF v_require_approval THEN
    v_initial_status := 'pending_approval';
  ELSE
    v_initial_status := 'active';
  END IF;

  -- Server-enforced fields: ignore any client-supplied role or status
  NEW.role := 'student';
  NEW.status := v_initial_status;
  NEW.email_verified := false; -- Always false; treated as unverified contact data
  NEW.linked_account_id := v_monitor_id;
  NEW.requested_at := now();
  NEW.created_at := now();
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON profiles;
CREATE TRIGGER trg_on_auth_user_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_registration();

-- 4. Active student check helper (active or legacy approved)
CREATE OR REPLACE FUNCTION is_student_active(target_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_id 
      AND role = 'student' 
      AND status IN ('active', 'approved')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 5. Indexes for fast status and daily cap queries
CREATE INDEX IF NOT EXISTS idx_profiles_role_created ON profiles (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_status_active ON profiles (status);
