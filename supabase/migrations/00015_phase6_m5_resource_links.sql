-- ============================================================
-- JEE Practice Hub — Migration 00015: Phase 6 Module M5 Resource Links
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   DROP TABLE IF EXISTS resource_links;
-- ============================================================

-- 1. CREATE RESOURCE LINKS TABLE
CREATE TABLE IF NOT EXISTS resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('video', 'notes', 'solution', 'external')),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES chapters(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resource_links ENABLE ROW LEVEL SECURITY;

-- Monitor gets full access to create, edit, and delete resource links
CREATE POLICY "resource_links_monitor_all" ON resource_links
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- Authenticated students can view resource links (exam shielding enforced at application & API boundary)
CREATE POLICY "resource_links_student_select" ON resource_links
  FOR SELECT
  USING (auth.role() = 'authenticated');

