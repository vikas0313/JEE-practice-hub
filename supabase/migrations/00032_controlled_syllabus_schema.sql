-- ============================================================
-- JEE Practice Hub — Migration 00032: Controlled Syllabus Schema
-- Controlled Syllabus Hierarchy: Subject > Group > Chapter > Topic > Subtopic,
-- plus Syllabus Aliases and Question Foreign Key Links.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SYLLABUS SUBJECTS (Physics, Chemistry, Mathematics)
CREATE TABLE IF NOT EXISTS syllabus_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SYLLABUS GROUPS (Subject-scoped clusters)
CREATE TABLE IF NOT EXISTS syllabus_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES syllabus_subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_groups_subject_name UNIQUE (subject_id, name)
);

-- 3. SYLLABUS CHAPTERS (92 Official Chapters)
CREATE TABLE IF NOT EXISTS syllabus_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE, -- e.g. 'PHY-001'
    subject_id UUID NOT NULL REFERENCES syllabus_subjects(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES syllabus_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    syllabus_status TEXT NOT NULL DEFAULT 'listed_in_guide' 
        CHECK (syllabus_status IN ('listed_in_guide', 'verify_current_syllabus', 'confirmed', 'removed')),
    source_note TEXT,
    confirmed_by UUID REFERENCES profiles(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_chapters_subject_name UNIQUE (subject_id, name)
);

-- 4. SYLLABUS TOPICS
CREATE TABLE IF NOT EXISTS syllabus_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES syllabus_chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_topics_chapter_name UNIQUE (chapter_id, name)
);

-- 5. SYLLABUS SUBTOPICS
CREATE TABLE IF NOT EXISTS syllabus_subtopics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_subtopics_topic_name UNIQUE (topic_id, name)
);

-- 6. SYLLABUS ALIASES (Alternate/legacy spelling mapping)
CREATE TABLE IF NOT EXISTS syllabus_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('chapter', 'topic', 'subtopic')),
    target_id UUID NOT NULL,
    subject_id UUID NOT NULL REFERENCES syllabus_subjects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_aliases UNIQUE (subject_id, target_type, alias)
);

-- 7. ALTER QUESTIONS TABLE WITH CONTROLLED FOREIGN KEYS
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS primary_chapter_id UUID REFERENCES syllabus_chapters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS primary_topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS primary_subtopic_id UUID REFERENCES syllabus_subtopics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS secondary_chapter_id UUID REFERENCES syllabus_chapters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS secondary_topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_primary_chapter_id ON questions(primary_chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_primary_topic_id ON questions(primary_topic_id);

