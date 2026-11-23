-- ============================================================
-- JEE Practice Hub — Migration 00008: Phase 4 Schema Extensions
-- ============================================================
-- Bulk content loading, paper registry & verified profiles,
-- manifest tracking, key versioning, quality sampling,
-- question revisions, defect logs, and AI cost tracking.

-- 1. Extend papers table
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Official NTA'
    CHECK (source IN ('Official NTA', 'CBSE-era', 'third-party')),
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS date_retrieved date,
  ADD COLUMN IF NOT EXISTS source_file_sha256 text,
  ADD COLUMN IF NOT EXISTS key_source text DEFAULT 'NTA final'
    CHECK (key_source IN ('NTA provisional', 'NTA final', 'third-party')),
  ADD COLUMN IF NOT EXISTS key_status text DEFAULT 'final'
    CHECK (key_status IN ('provisional', 'final', 'disputed')),
  ADD COLUMN IF NOT EXISTS pattern_profile_id uuid REFERENCES pattern_profiles(id),
  ADD COLUMN IF NOT EXISTS profile_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS information_bulletin_ref text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'extracted', 'tagged', 'solved', 'in_review', 'ready', 'published', 'rolled_back')),
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- 2. Extend questions table & enforce uniqueness on (paper_id, number)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES questions(id),
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS draft_level text,
  ADD COLUMN IF NOT EXISTS rating_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS rubric_version text,
  ADD COLUMN IF NOT EXISTS tag_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS needs_tag_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_key_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provenance jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_paper_number ON questions(paper_id, number);

-- 3. Paper Manifests Table (Manifest-driven offline ingestion)
CREATE TABLE IF NOT EXISTS paper_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  year int NOT NULL,
  session text NOT NULL,
  shift text NOT NULL,
  pdf_filename text NOT NULL,
  pdf_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Batches Table (Review, Publish Gate, and Rollback)
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  paper_ids uuid[] NOT NULL,
  total_questions int NOT NULL DEFAULT 0,
  key_matched_count int NOT NULL DEFAULT 0,
  flagged_count int NOT NULL DEFAULT 0,
  sample_size int NOT NULL DEFAULT 0,
  defect_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'sample_passed', 'published', 'rolled_back')),
  published_at timestamptz,
  published_by uuid REFERENCES profiles(id),
  rolled_back_at timestamptz,
  rolled_back_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Key Versions Table (Official Answer Key Tracking & Re-Scoring)
CREATE TABLE IF NOT EXISTS key_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  key_status text NOT NULL CHECK (key_status IN ('provisional', 'final', 'correction')),
  notice_reference text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  re_scored_at timestamptz,
  re_scored_by uuid REFERENCES profiles(id),
  changes_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Question Revisions Table (Audit Log for Question Edits & Recompute Hooks)
CREATE TABLE IF NOT EXISTS question_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  revised_by uuid NOT NULL REFERENCES profiles(id),
  revision_reason text NOT NULL,
  diff jsonb NOT NULL,
  triggered_recompute boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Review Samples Table (Stratified Quality Sampling)
CREATE TABLE IF NOT EXISTS review_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  stratum text NOT NULL,
  random_seed text NOT NULL,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'defective')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Defect Logs Table (Sampling Defect Categories & Remediation)
CREATE TABLE IF NOT EXISTS defect_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES review_samples(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'wrong_solution', 'wrong_key', 'wrong_tag', 'wrong_level',
    'broken_latex_or_extraction', 'wrong_or_missing_figure', 'bad_shortcut'
  )),
  defect_details text NOT NULL,
  reported_by uuid NOT NULL REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. AI Cost Logs Table (Token Counts, Provider, Model, Budget Cap Tracking)
CREATE TABLE IF NOT EXISTS ai_cost_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  stage text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL,
  output_tokens int NOT NULL,
  cost_usd numeric(8, 5) NOT NULL,
  prompt_version text NOT NULL,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Performance Indexes for 10,000 Questions and 100,000 Visits
CREATE INDEX IF NOT EXISTS idx_questions_active_chapter ON questions(chapter_id, is_active, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active_subject ON questions(subject_id, is_active);
CREATE INDEX IF NOT EXISTS idx_visits_student_time ON visits(student_id, started_at, ended_at);
CREATE INDEX IF NOT EXISTS idx_attempts_student_exam ON attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_responses_attempt_q ON responses(attempt_id, question_id);

-- 11. Seed Phase 4 Settings (Missing settings identified in pre-flight audit)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS tag_confidence_threshold numeric(4,2) NOT NULL DEFAULT 0.80,
  ADD COLUMN IF NOT EXISTS sampling_percentage integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS escalation_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weightage_minimum_papers integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS include_cbse_practice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_budget_cap_usd numeric(8,2) NOT NULL DEFAULT 10.0;
