-- ============================================================
-- JEE Practice Hub — Migration 00002: Row Level Security (RLS)
-- Deny by default across ALL tables.
-- ============================================================

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR get_user_role() = 'monitor');

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_update_monitor" ON profiles
  FOR UPDATE USING (get_user_role() = 'monitor');

-- 2. SETTINGS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON settings
  FOR SELECT USING (true);

CREATE POLICY "settings_update_monitor" ON settings
  FOR UPDATE USING (get_user_role() = 'monitor');

-- 3. CONTENT (Public metadata)
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "papers_select" ON papers FOR SELECT USING (true);
CREATE POLICY "papers_insert_monitor" ON papers FOR INSERT WITH CHECK (get_user_role() = 'monitor');

ALTER TABLE pattern_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_select" ON pattern_profiles FOR SELECT USING (true);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subj_select" ON subjects FOR SELECT USING (true);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chap_select" ON chapters FOR SELECT USING (true);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topic_select" ON topics FOR SELECT USING (true);

-- 4. QUESTIONS (Visible questions only to student; all to monitor)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_select_student" ON questions
  FOR SELECT USING (is_visible = true);

CREATE POLICY "questions_select_monitor" ON questions
  FOR SELECT USING (get_user_role() = 'monitor');

CREATE POLICY "questions_insert_monitor" ON questions
  FOR INSERT WITH CHECK (get_user_role() = 'monitor');

CREATE POLICY "questions_update_monitor" ON questions
  FOR UPDATE USING (get_user_role() = 'monitor');

-- 5. QUESTION ANSWERS (Released ONLY after student submits response)
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_select_student" ON question_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM responses r
      WHERE r.question_id = question_answers.question_id
        AND r.student_id = auth.uid()
        AND r.submitted_at IS NOT NULL
    )
  );

CREATE POLICY "qa_select_monitor" ON question_answers
  FOR SELECT USING (get_user_role() = 'monitor');

CREATE POLICY "qa_insert_monitor" ON question_answers
  FOR INSERT WITH CHECK (get_user_role() = 'monitor');

CREATE POLICY "qa_update_monitor" ON question_answers
  FOR UPDATE USING (get_user_role() = 'monitor');

-- 6. SOLUTIONS (Released ONLY after student submits response)
ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solutions_select_student" ON solutions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM responses r
      WHERE r.question_id = solutions.question_id
        AND r.student_id = auth.uid()
        AND r.submitted_at IS NOT NULL
    )
  );

CREATE POLICY "solutions_select_monitor" ON solutions
  FOR SELECT USING (get_user_role() = 'monitor');

CREATE POLICY "solutions_insert_monitor" ON solutions
  FOR INSERT WITH CHECK (get_user_role() = 'monitor');

CREATE POLICY "solutions_update_monitor" ON solutions
  FOR UPDATE USING (get_user_role() = 'monitor');

-- 7. ATTEMPTS
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_select_own" ON attempts FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "att_select_monitor" ON attempts FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "att_insert_student" ON attempts FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "att_update_student" ON attempts FOR UPDATE USING (student_id = auth.uid());

-- 8. RESPONSES
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resp_select_own" ON responses FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "resp_select_monitor" ON responses FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "resp_insert_student" ON responses FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "resp_update_student" ON responses FOR UPDATE USING (student_id = auth.uid());

-- 9. PRACTICED QUESTIONS
ALTER TABLE practiced_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pq_select_own" ON practiced_questions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "pq_select_monitor" ON practiced_questions FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "pq_insert_student" ON practiced_questions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "pq_update_student" ON practiced_questions FOR UPDATE USING (student_id = auth.uid());

-- 10. BOOKMARKS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bm_select_own" ON bookmarks FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "bm_insert_student" ON bookmarks FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "bm_delete_student" ON bookmarks FOR DELETE USING (student_id = auth.uid());
CREATE POLICY "bm_select_monitor" ON bookmarks FOR SELECT USING (get_user_role() = 'monitor');

-- 11. TELEMETRY: VISITS, PAUSE EVENTS, SOLUTION VIEWS
-- STUDENT CAN INSERT ONLY. STUDENT CAN NEVER SELECT BACK.
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vis_insert_student" ON visits FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "vis_select_monitor" ON visits FOR SELECT USING (get_user_role() = 'monitor');

ALTER TABLE pause_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_insert_student" ON pause_events FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "pe_select_monitor" ON pause_events FOR SELECT USING (get_user_role() = 'monitor');

ALTER TABLE solution_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_insert_student" ON solution_views FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "sv_select_monitor" ON solution_views FOR SELECT USING (get_user_role() = 'monitor');

-- 12. FLAG REPORTS
ALTER TABLE flag_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_insert_student" ON flag_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "fr_select_monitor" ON flag_reports FOR SELECT USING (get_user_role() = 'monitor');
CREATE POLICY "fr_update_monitor" ON flag_reports FOR UPDATE USING (get_user_role() = 'monitor');

