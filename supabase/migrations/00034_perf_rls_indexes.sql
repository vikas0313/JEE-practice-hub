-- Migration 00034: Performance & RLS Composite Index Optimization
-- Speeds up high-frequency RLS EXISTS checks, question queries, and visit telemetry

-- 1. Accelerate student answer and solution release RLS checks
-- In 00002_rls_policies.sql, qa_select_student and solutions_select_student query:
--   EXISTS (SELECT 1 FROM responses r WHERE r.question_id = question_answers.question_id AND r.student_id = auth.uid() AND r.submitted_at IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_responses_q_student_submitted
  ON responses (question_id, student_id)
  WHERE submitted_at IS NOT NULL;

-- 2. Accelerate student attempts and responses retrieval by attempt
CREATE INDEX IF NOT EXISTS idx_responses_attempt_lookup
  ON responses (attempt_id, question_id);

CREATE INDEX IF NOT EXISTS idx_attempts_student_mode_started
  ON attempts (student_id, mode, started_at DESC);

-- 3. Accelerate visits active time aggregations for student and monitor telemetry
CREATE INDEX IF NOT EXISTS idx_visits_student_started
  ON visits (student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_response_lookup
  ON visits (response_id, student_id);

-- 4. Accelerate syllabus question filtering (Chapter, Topic, Difficulty)
CREATE INDEX IF NOT EXISTS idx_questions_lookup_perf
  ON questions (subject_id, primary_chapter_id, primary_topic_id, difficulty);

-- 5. Accelerate revision and bookmark queries
CREATE INDEX IF NOT EXISTS idx_revision_student_active
  ON revision_items (student_id, resolved)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_bookmarks_student
  ON bookmarks (student_id, question_id);
