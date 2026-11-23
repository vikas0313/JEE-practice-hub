-- ============================================================
-- JEE Practice Hub — Migration 00035: Student Registration, Lifecycle & Multi-Student Scoping
-- ============================================================

-- 1. Extend PROFILES with lifecycle status and registration fields
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_email' 
    CHECK (status IN ('pending_email', 'pending_approval', 'approved', 'rejected', 'suspended')),
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR (age >= 10 AND age <= 99)),
  ADD COLUMN IF NOT EXISTS college_name text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS consent_tracking_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_guardian_at timestamptz,
  ADD COLUMN IF NOT EXISTS incomplete_profile boolean NOT NULL DEFAULT false;

-- 2. Extend SETTINGS with registration controls
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS registrations_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_pending_registrations integer NOT NULL DEFAULT 200;

-- 3. PER-STUDENT SETTINGS (overrides global defaults)
CREATE TABLE IF NOT EXISTS student_settings (
  student_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  stopwatch_visible boolean,
  ideal_time_basic integer,
  ideal_time_medium integer,
  ideal_time_advanced integer,
  idle_timeout integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_student_settings_student_id ON student_settings (student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status_requested ON profiles (status, requested_at DESC);

-- 4. Helper function to check if student is approved
CREATE OR REPLACE FUNCTION is_student_approved(target_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_id 
      AND role = 'student' 
      AND status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 5. Helper function to get student status
CREATE OR REPLACE FUNCTION get_user_status() RETURNS text AS $$
  SELECT status FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 6. Trigger function: Guard profile updates against privilege escalation
CREATE OR REPLACE FUNCTION guard_profile_updates() RETURNS trigger AS $$
BEGIN
  -- Monitor is allowed to change all fields including status and role
  IF (SELECT role FROM profiles WHERE id = auth.uid()) = 'monitor' THEN
    RETURN NEW;
  END IF;

  -- Non-monitors cannot touch privileged columns
  IF (OLD.role IS DISTINCT FROM NEW.role) THEN
    RAISE EXCEPTION 'Role elevation is strictly forbidden';
  END IF;

  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    RAISE EXCEPTION 'Status modification is strictly forbidden';
  END IF;

  IF (OLD.email IS DISTINCT FROM NEW.email) THEN
    RAISE EXCEPTION 'Email updates must go through auth';
  END IF;

  IF (OLD.decided_by IS DISTINCT FROM NEW.decided_by) OR (OLD.decided_at IS DISTINCT FROM NEW.decided_at) THEN
    RAISE EXCEPTION 'Approval decision metadata is monitor-only';
  END IF;

  IF (OLD.email_verified_at IS DISTINCT FROM NEW.email_verified_at) OR (OLD.requested_at IS DISTINCT FROM NEW.requested_at) THEN
    RAISE EXCEPTION 'Registration timestamp tampering is strictly forbidden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_profile_updates ON profiles;
CREATE TRIGGER trg_guard_profile_updates
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_updates();

-- 7. Trigger function: Handle new user sign-up
CREATE OR REPLACE FUNCTION handle_new_user_registration() RETURNS trigger AS $$
DECLARE
  v_registrations_open boolean;
  v_max_pending integer;
  v_pending_count integer;
  v_first_name text;
  v_last_name text;
  v_age integer;
  v_college text;
  v_tracking_consent timestamptz;
  v_guardian_consent timestamptz;
BEGIN
  -- Check if registrations are currently open
  SELECT COALESCE(registrations_open, true), COALESCE(max_pending_registrations, 200)
    INTO v_registrations_open, v_max_pending
    FROM settings LIMIT 1;

  IF NOT v_registrations_open THEN
    RAISE EXCEPTION 'Student self-registration is currently closed by the monitor';
  END IF;

  -- Check pending approvals cap
  SELECT count(*) INTO v_pending_count FROM profiles WHERE status = 'pending_approval';
  IF v_pending_count >= v_max_pending THEN
    RAISE EXCEPTION 'Registration limit reached. Please try again later or contact the monitor.';
  END IF;

  -- Extract and sanitize whitelisted metadata only
  v_first_name := trim(COALESCE(NEW.raw_user_meta_data->>'first_name', ''));
  v_last_name := trim(COALESCE(NEW.raw_user_meta_data->>'last_name', ''));
  v_age := (NEW.raw_user_meta_data->>'age')::integer;
  v_college := trim(COALESCE(NEW.raw_user_meta_data->>'college_name', ''));

  IF NEW.raw_user_meta_data->>'consent_tracking' = 'true' THEN
    v_tracking_consent := now();
  END IF;

  IF NEW.raw_user_meta_data->>'consent_guardian' = 'true' THEN
    v_guardian_consent := now();
  END IF;

  -- Insert profile: ALWAYS force role = 'student' and status = 'pending_email'
  INSERT INTO profiles (
    id,
    role,
    status,
    name,
    first_name,
    last_name,
    age,
    college_name,
    email,
    requested_at,
    consent_tracking_at,
    consent_guardian_at,
    incomplete_profile,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'student',
    'pending_email',
    CASE WHEN v_first_name <> '' THEN v_first_name || ' ' || v_last_name ELSE 'Student' END,
    v_first_name,
    v_last_name,
    v_age,
    v_college,
    NEW.email,
    now(),
    v_tracking_consent,
    v_guardian_consent,
    false,
    now(),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 8. Trigger function: Transition status upon email verification
CREATE OR REPLACE FUNCTION handle_user_email_verified() RETURNS trigger AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE profiles
    SET 
      status = 'pending_approval',
      email_verified_at = NEW.email_confirmed_at,
      updated_at = now()
    WHERE id = NEW.id AND status = 'pending_email';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9. Monitor Lifecycle Management Functions
CREATE OR REPLACE FUNCTION approve_student(p_student_id uuid, p_note text DEFAULT NULL) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'monitor' THEN
    RAISE EXCEPTION 'Only the monitor can approve students';
  END IF;

  UPDATE profiles
  SET 
    status = 'approved',
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = p_note,
    updated_at = now()
  WHERE id = p_student_id AND role = 'student';

  -- Create default per-student settings if not present
  INSERT INTO student_settings (student_id)
  VALUES (p_student_id)
  ON CONFLICT (student_id) DO NOTHING;

  -- Audit log entry
  INSERT INTO audit_log (id, action, performed_by, target_id, details, created_at)
  VALUES (
    gen_random_uuid(),
    'student_approved',
    auth.uid(),
    p_student_id,
    jsonb_build_object('note', p_note),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION reject_student(p_student_id uuid, p_note text DEFAULT NULL) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'monitor' THEN
    RAISE EXCEPTION 'Only the monitor can reject students';
  END IF;

  UPDATE profiles
  SET 
    status = 'rejected',
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = p_note,
    updated_at = now()
  WHERE id = p_student_id AND role = 'student';

  INSERT INTO audit_log (id, action, performed_by, target_id, details, created_at)
  VALUES (
    gen_random_uuid(),
    'student_rejected',
    auth.uid(),
    p_student_id,
    jsonb_build_object('note', p_note),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION suspend_student(p_student_id uuid, p_note text DEFAULT NULL) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'monitor' THEN
    RAISE EXCEPTION 'Only the monitor can suspend students';
  END IF;

  UPDATE profiles
  SET 
    status = 'suspended',
    decision_note = p_note,
    updated_at = now()
  WHERE id = p_student_id AND role = 'student';

  INSERT INTO audit_log (id, action, performed_by, target_id, details, created_at)
  VALUES (
    gen_random_uuid(),
    'student_suspended',
    auth.uid(),
    p_student_id,
    jsonb_build_object('note', p_note),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION reinstate_student(p_student_id uuid) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'monitor' THEN
    RAISE EXCEPTION 'Only the monitor can reinstate students';
  END IF;

  UPDATE profiles
  SET 
    status = 'approved',
    updated_at = now()
  WHERE id = p_student_id AND role = 'student';

  INSERT INTO audit_log (id, action, performed_by, target_id, details, created_at)
  VALUES (
    gen_random_uuid(),
    'student_reinstated',
    auth.uid(),
    p_student_id,
    jsonb_build_object('status', 'approved'),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_student_account(p_student_id uuid) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'monitor' THEN
    RAISE EXCEPTION 'Only the monitor can delete student accounts';
  END IF;

  -- Cascade delete student-owned records
  DELETE FROM responses WHERE student_id = p_student_id;
  DELETE FROM attempts WHERE student_id = p_student_id;
  DELETE FROM visits WHERE student_id = p_student_id;
  DELETE FROM pause_events WHERE student_id = p_student_id;
  DELETE FROM solution_views WHERE student_id = p_student_id;
  DELETE FROM practiced_questions WHERE student_id = p_student_id;
  DELETE FROM bookmarks WHERE student_id = p_student_id;
  DELETE FROM student_settings WHERE student_id = p_student_id;
  DELETE FROM revision_items WHERE student_id = p_student_id;
  DELETE FROM profiles WHERE id = p_student_id AND role = 'student';

  INSERT INTO audit_log (id, action, performed_by, target_id, details, created_at)
  VALUES (
    gen_random_uuid(),
    'student_deleted',
    auth.uid(),
    p_student_id,
    jsonb_build_object('deleted_at', now()),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 10. RLS POLICIES FOR STUDENT SETTINGS
CREATE POLICY "student_settings_select_own" ON student_settings
  FOR SELECT USING (student_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'monitor');

CREATE POLICY "student_settings_update_monitor" ON student_settings
  FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'monitor');

CREATE POLICY "student_settings_insert_monitor" ON student_settings
  FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'monitor');

CREATE POLICY "student_settings_delete_monitor" ON student_settings
  FOR DELETE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'monitor');

-- 11. MIGRATE EXISTING PHASE 1 STUDENT INTO APPROVED STATUS
UPDATE profiles
SET 
  status = 'approved',
  first_name = COALESCE(NULLIF(split_part(name, ' ', 1), ''), 'Student'),
  last_name = COALESCE(NULLIF(split_part(name, ' ', 2), ''), 'Account'),
  age = 18,
  college_name = 'Phase 1 Legacy Institution',
  incomplete_profile = true,
  consent_tracking_at = created_at,
  decided_at = created_at
WHERE role = 'student' AND (status IS NULL OR status = 'pending_email');
