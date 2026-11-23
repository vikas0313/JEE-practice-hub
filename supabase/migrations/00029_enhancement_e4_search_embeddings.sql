-- Migration: 00029_enhancement_e4_search_embeddings.sql
-- Description: E4 Question Search & "More Like This" Embedding Similarity
-- Rollback:
--   DROP TABLE IF EXISTS question_search_indices CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e4_question_search_embeddings;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS flag_e4_question_search_embeddings BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS question_search_indices (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    search_tokens TEXT NOT NULL,
    embedding JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Authenticated read access
ALTER TABLE question_search_indices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read access to question_search_indices"
ON question_search_indices
FOR SELECT
TO authenticated
USING (true);

