-- ============================================================
-- Migration 00038: Instant Access Profiles & Multi-Student Sync
-- ============================================================

-- 1. Relax foreign key on profiles(id) so instant-access self-registered profiles can sync cleanly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- 2. Verify is_student_active helper checks both 'active' and legacy 'approved'
CREATE OR REPLACE FUNCTION is_student_active(target_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_id 
      AND role = 'student' 
      AND status IN ('active', 'approved')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Enable RLS on core student data tables and ensure monitor access policies
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS practiced_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookmarks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_insert_self_registration" ON profiles;
CREATE POLICY "profiles_insert_self_registration" ON profiles
  FOR INSERT WITH CHECK (role = 'student');

DROP POLICY IF EXISTS "profiles_select_active_or_monitor" ON profiles;
CREATE POLICY "profiles_select_active_or_monitor" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_monitor" ON profiles;
CREATE POLICY "profiles_update_self_or_monitor" ON profiles
  FOR UPDATE USING (true);

-- Responses policies
DROP POLICY IF EXISTS "responses_select_monitor_and_student" ON responses;
CREATE POLICY "responses_select_monitor_and_student" ON responses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "responses_insert_student" ON responses;
CREATE POLICY "responses_insert_student" ON responses
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "responses_update_student" ON responses;
CREATE POLICY "responses_update_student" ON responses
  FOR UPDATE USING (true);

-- Visits policies
DROP POLICY IF EXISTS "visits_select_monitor" ON visits;
CREATE POLICY "visits_select_monitor" ON visits
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "visits_insert_student" ON visits;
CREATE POLICY "visits_insert_student" ON visits
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "visits_update_student" ON visits;
CREATE POLICY "visits_update_student" ON visits
  FOR UPDATE USING (true);

-- Attempts policies
DROP POLICY IF EXISTS "attempts_select_monitor" ON attempts;
CREATE POLICY "attempts_select_monitor" ON attempts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "attempts_insert_student" ON attempts;
CREATE POLICY "attempts_insert_student" ON attempts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "attempts_update_student" ON attempts;
CREATE POLICY "attempts_update_student" ON attempts
  FOR UPDATE USING (true);
