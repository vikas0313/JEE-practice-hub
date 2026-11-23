-- ============================================================
-- JEE Practice Hub — Migration 00033: Controlled Syllabus RLS & Views
-- Strict separation between Monitor CRUD and Student Restricted Read-Only.
-- Hides inactive chapters, verify_current_syllabus, and aliases from Student.
-- ============================================================

-- Enable RLS on all syllabus tables
ALTER TABLE syllabus_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_aliases ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- MONITOR POLICIES: Full CRUD on all syllabus tables
-- ------------------------------------------------------------
CREATE POLICY "Monitor full access on syllabus_subjects"
ON syllabus_subjects FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

CREATE POLICY "Monitor full access on syllabus_groups"
ON syllabus_groups FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

CREATE POLICY "Monitor full access on syllabus_chapters"
ON syllabus_chapters FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

CREATE POLICY "Monitor full access on syllabus_topics"
ON syllabus_topics FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

CREATE POLICY "Monitor full access on syllabus_subtopics"
ON syllabus_subtopics FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

CREATE POLICY "Monitor full access on syllabus_aliases"
ON syllabus_aliases FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'));

-- ------------------------------------------------------------
-- STUDENT POLICIES: Restricted Read-Only
-- ------------------------------------------------------------
-- 1. Subjects: Active subjects readable
CREATE POLICY "Student read syllabus_subjects"
ON syllabus_subjects FOR SELECT TO authenticated
USING (true);

-- 2. Groups: Readable
CREATE POLICY "Student read syllabus_groups"
ON syllabus_groups FOR SELECT TO authenticated
USING (true);

-- 3. Chapters: Active AND confirmed/listed only (hides inactive, removed, verify_current_syllabus)
CREATE POLICY "Student read syllabus_chapters"
ON syllabus_chapters FOR SELECT TO authenticated
USING (
  status = 'active'
  AND syllabus_status IN ('confirmed', 'listed_in_guide')
);

-- 4. Topics: Active only
CREATE POLICY "Student read syllabus_topics"
ON syllabus_topics FOR SELECT TO authenticated
USING (status = 'active');

-- 5. Subtopics: Active only
CREATE POLICY "Student read syllabus_subtopics"
ON syllabus_subtopics FOR SELECT TO authenticated
USING (status = 'active');

-- 6. Aliases: Denied to students
CREATE POLICY "Student deny syllabus_aliases"
ON syllabus_aliases FOR ALL TO authenticated
USING (false);

-- ------------------------------------------------------------
-- VIEWS
-- ------------------------------------------------------------
-- RESTRICTED VIEW FOR STUDENT: Strips source_note, confirmed_by, confirmed_at
CREATE OR REPLACE VIEW v_student_visible_syllabus AS
SELECT
    c.id AS chapter_id,
    c.external_id,
    s.id AS subject_id,
    s.name AS subject_name,
    g.id AS group_id,
    g.name AS group_name,
    c.name AS chapter_name,
    c.sort_order AS chapter_sort_order,
    t.id AS topic_id,
    t.name AS topic_name,
    st.id AS subtopic_id,
    st.name AS subtopic_name
FROM syllabus_chapters c
JOIN syllabus_subjects s ON s.id = c.subject_id
JOIN syllabus_groups g ON g.id = c.group_id
LEFT JOIN syllabus_topics t ON t.chapter_id = c.id AND t.status = 'active'
LEFT JOIN syllabus_subtopics st ON st.topic_id = t.id AND st.status = 'active'
WHERE c.status = 'active'
  AND c.syllabus_status IN ('confirmed', 'listed_in_guide');

-- TAGGABLE COMPLETE VIEW (For Phase 2 Exam Builder check)
CREATE OR REPLACE VIEW v_taggable_complete_questions AS
SELECT
    q.id AS question_id,
    q.primary_chapter_id,
    q.primary_topic_id,
    (q.primary_chapter_id IS NOT NULL AND q.primary_topic_id IS NOT NULL) AS taggable_complete
FROM questions q;

