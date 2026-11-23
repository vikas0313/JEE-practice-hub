-- ============================================================
-- JEE Practice Hub — Migration 00017: Archive Mode Database-Enforced RLS Guards
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP POLICY IF EXISTS "archive_mode_block_student_attempts" ON attempts;
--   DROP POLICY IF EXISTS "archive_mode_block_student_responses" ON responses;
--   DROP POLICY IF EXISTS "archive_mode_block_student_visits" ON visits;
--   DROP POLICY IF EXISTS "archive_mode_block_student_bookmarks" ON bookmarks;
-- ============================================================

-- Guard all student mutations: block INSERT/UPDATE/DELETE when is_archive_mode_active() returns true

-- 1. Attempts
CREATE OR REPLACE POLICY "student_attempts_insert" ON attempts
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  );

CREATE OR REPLACE POLICY "student_attempts_update" ON attempts
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  );

-- 2. Responses
CREATE OR REPLACE POLICY "student_responses_insert" ON responses
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  );

CREATE OR REPLACE POLICY "student_responses_update" ON responses
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  );

-- 3. Visits
CREATE OR REPLACE POLICY "student_visits_insert" ON visits
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND NOT is_archive_mode_active()
  );

-- 4. Bookmarks
CREATE OR REPLACE POLICY "student_bookmarks_mutation" ON bookmarks
  FOR ALL
  USING (
    auth.role() = 'authenticated' 
    AND (get_user_role() = 'monitor' OR NOT is_archive_mode_active())
  );
