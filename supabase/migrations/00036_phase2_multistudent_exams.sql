-- ============================================================
-- JEE Practice Hub — Migration 00036: Phase 2 Multi-Student Scoped Exams
-- ============================================================

-- 1. Add student_id to exams table for student-specific exam generation
ALTER TABLE exams 
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exams_student_id ON exams(student_id);

-- 2. Update exams RLS policy so approved students only see exams assigned to them (or unassigned templates)
DROP POLICY IF EXISTS "exams_select_student" ON exams;
CREATE POLICY "exams_select_student" ON exams
  FOR SELECT USING (
    status = 'published' 
    AND (student_id = auth.uid() OR student_id IS NULL)
  );

-- 3. Confirm unique attempt constraint per exam per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_attempt_per_exam 
  ON attempts(exam_id, student_id) 
  WHERE mode = 'exam';
