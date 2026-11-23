-- Migration: 00030_enhancement_e2_concept_map.sql
-- Description: E2 Subtopic Taxonomy & Prerequisite Concept Map
-- Rollback:
--   DROP TABLE IF EXISTS concept_prerequisites CASCADE;
--   DROP TABLE IF EXISTS subtopics CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e2_concept_map;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS flag_e2_concept_map BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS subtopics (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_prerequisites (
    id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
    prerequisite_concept_id TEXT NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_prerequisite CHECK (concept_id <> prerequisite_concept_id)
);

-- RLS: Authenticated read access
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read access to subtopics"
ON subtopics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Read access to concept_prerequisites"
ON concept_prerequisites FOR SELECT TO authenticated USING (true);

