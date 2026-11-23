-- ============================================================
-- JEE Practice Hub — Migration 00013: Phase 6 Module M4 Hindi Translations
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   ALTER TABLE responses DROP COLUMN IF EXISTS language;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_language;
--   DROP TABLE IF EXISTS question_translations;
-- ============================================================

-- 1. CREATE QUESTION TRANSLATIONS TABLE
CREATE TABLE IF NOT EXISTS question_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('english', 'hindi')),
  question_text text NOT NULL,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, language)
);

ALTER TABLE question_translations ENABLE ROW LEVEL SECURITY;

-- Both students and monitors can read translations
CREATE POLICY "question_translations_read" ON question_translations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Monitor can manage translations
CREATE POLICY "question_translations_monitor_write" ON question_translations
  FOR ALL
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

-- 2. EXTEND PROFILES WITH PREFERRED LANGUAGE
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'english'
    CHECK (preferred_language IN ('english', 'hindi'));

-- 3. EXTEND RESPONSES WITH LANGUAGE RECORDED AT ATTEMPT TIME
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'english'
    CHECK (language IN ('english', 'hindi'));

