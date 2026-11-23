-- ============================================================
-- JEE Practice Hub — Migration 00025: Enhancement Module E3 (Revision Cards & Formula Sheets)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   DROP TABLE IF EXISTS chapter_notes CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e3_revision_cards;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e3_revision_cards BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Chapter Revision Notes & Formula Sheets Table
CREATE TABLE IF NOT EXISTS chapter_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  formula_sheet_url TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chapter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapter_notes_select"
  ON chapter_notes
  FOR SELECT
  TO authenticated
  USING (verified_at IS NOT NULL OR get_user_role() = 'monitor');

CREATE POLICY "chapter_notes_monitor_mutate"
  ON chapter_notes
  FOR ALL
  TO authenticated
  USING (get_user_role() = 'monitor')
  WITH CHECK (get_user_role() = 'monitor');

