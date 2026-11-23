-- ============================================================
-- JEE Practice Hub — Migration 00005: Phase 2 RLS Policies
-- ============================================================

-- 1. CRITICAL: ANSWER & SOLUTION WITHHOLDING DURING OPEN EXAM
-- Update question_answers RLS to withhold answers during open Exam attempts
DROP POLICY IF EXISTS "qa_select_student" ON question_answers;
CREATE POLICY "qa_select_student" ON question_answers
  FOR SELECT USING (
    -- 1. Student has submitted this question in Practice or in a completed Exam
    EXISTS (
      SELECT 1 FROM responses r
      JOIN attempts a ON r.attempt_id = a.id
      WHERE r.question_id = question_answers.question_id
        AND r.student_id = auth.uid()
        AND r.submitted_at IS NOT NULL
        AND a.ended_at IS NOT NULL
    )
    -- 2. AND student does NOT currently have an open Exam that includes this question!
    AND NOT EXISTS (
      SELECT 1 FROM attempts open_a
      JOIN exam_questions eq ON eq.exam_id = open_a.exam_id
      WHERE open_a.student_id = auth.uid()
        AND open_a.mode = 'exam'
        AND open_a.ended_at IS NULL
        AND eq.question_id = question_answers.question_id
    )
  );

-- Update solutions RLS with identical withholding rule
DROP POLICY IF EXISTS "solutions_select_student" ON solutions;
CREATE POLICY "solutions_select_student" ON solutions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM responses r
      JOIN attempts a ON r.attempt_id = a.id
      WHERE r.question_id = solutions.question_id
        AND r.student_id = auth.uid()
        AND r.submitted_at IS NOT NULL
        AND a.ended_at IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM attempts open_a
      JOIN exam_questions eq ON eq.exam_id = open_a.exam_id
      WHERE open_a.student_id = auth.uid()
        AND open_a.mode = 'exam'
        AND open_a.ended_at IS NULL
        AND eq.question_id = solutions.question_id
    )
  );

-- 2. EXAMS POLICIES
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams_select_monitor" ON exams FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "exams_insert_monitor" ON exams FOR INSERT WITH CHECK (get_user_role() = 'monitor');
CREATE POLICY "exams_update_monitor" ON exams FOR UPDATE USING (get_user_role() = 'monitor');
CREATE POLICY "exams_select_student" ON exams FOR SELECT USING (status = 'published');

-- 3. EXAM QUESTIONS POLICIES
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eq_select_monitor" ON exam_questions FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "eq_insert_monitor" ON exam_questions FOR INSERT WITH CHECK (get_user_role() = 'monitor');
CREATE POLICY "eq_update_monitor" ON exam_questions FOR UPDATE USING (get_user_role() = 'monitor');
CREATE POLICY "eq_delete_monitor" ON exam_questions FOR DELETE USING (get_user_role() = 'monitor');

-- Student can only read exam_questions for an exam they have already started (attempt exists)
CREATE POLICY "eq_select_student" ON exam_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.exam_id = exam_questions.exam_id
        AND a.student_id = auth.uid()
    )
  );

-- 4. REVISION ITEMS (MISTAKE NOTEBOOK) POLICIES
ALTER TABLE revision_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_select_student" ON revision_items FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "rev_select_monitor" ON revision_items FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "rev_insert_all" ON revision_items FOR INSERT WITH CHECK (student_id = auth.uid() OR get_user_role() = 'monitor');
CREATE POLICY "rev_update_all" ON revision_items FOR UPDATE USING (student_id = auth.uid() OR get_user_role() = 'monitor');

-- 5. EXAM TELEMETRY EVENTS
ALTER TABLE exam_telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ete_insert_student" ON exam_telemetry_events FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "ete_select_monitor" ON exam_telemetry_events FOR SELECT USING (get_user_role() = 'monitor');

-- 6. MONITOR NOTICES
ALTER TABLE monitor_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mn_select_monitor" ON monitor_notices FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "mn_update_monitor" ON monitor_notices FOR UPDATE USING (get_user_role() = 'monitor');
