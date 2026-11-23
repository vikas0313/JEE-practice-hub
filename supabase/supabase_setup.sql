-- ============================================================
-- JEE PRACTICE HUB — HOSTED SUPABASE INITIALIZATION SCRIPT
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jugtkxdlajirafrsdvxm/sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('student', 'monitor')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'approved', 'suspended', 'rejected', 'pending_email')),
  name text NOT NULL,
  first_name text,
  last_name text,
  age integer,
  college_name text,
  email text NOT NULL,
  password text,
  incomplete_profile boolean DEFAULT false,
  linked_account_id uuid,
  time_tracking_acknowledged boolean NOT NULL DEFAULT true,
  stopwatch_visible boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  consent_tracking_at timestamptz,
  consent_guardian_at timestamptz,
  requested_at timestamptz DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  rejection_reason text,
  preferred_language text DEFAULT 'english',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique email index on profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(LOWER(email));

-- 2. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideal_time_basic integer NOT NULL DEFAULT 60,
  ideal_time_medium integer NOT NULL DEFAULT 120,
  ideal_time_advanced integer NOT NULL DEFAULT 180,
  idle_timeout integer NOT NULL DEFAULT 300,
  registrations_open boolean NOT NULL DEFAULT true,
  registration_enabled boolean NOT NULL DEFAULT true,
  require_approval boolean NOT NULL DEFAULT false,
  daily_registration_cap integer NOT NULL DEFAULT 50,
  registration_in_app_notice boolean NOT NULL DEFAULT true,
  max_pending_registrations integer NOT NULL DEFAULT 200,
  exam_conditions_adjustment_enabled boolean DEFAULT false,
  allow_physical_keypad_a11y boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default settings row if empty
INSERT INTO public.settings (id, ideal_time_basic, ideal_time_medium, ideal_time_advanced, idle_timeout, registrations_open, registration_enabled, require_approval)
SELECT gen_random_uuid(), 60, 120, 180, 300, true, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.settings LIMIT 1);

-- 3. RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id text NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer text,
  is_correct boolean,
  marks numeric,
  submitted_at timestamptz,
  level text DEFAULT 'Medium',
  confidence text,
  error_reason text,
  palette_status text DEFAULT 'not_visited',
  visit_order integer DEFAULT 1,
  answer_changes_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_responses_student_id ON public.responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_attempt_id ON public.responses(attempt_id);

-- 4. VISITS TABLE
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_id uuid,
  question_id text NOT NULL,
  response_id uuid,
  visit_order integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  active_seconds integer NOT NULL DEFAULT 0,
  idle_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  visit_type text DEFAULT 'practice',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_student_id ON public.visits(student_id);

-- 5. ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paper_id uuid,
  mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'exam', 'paper', 'diagnostic')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned', 'paused', 'time_up')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  deadline_at timestamptz,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  raw_score numeric,
  total_marks numeric,
  percentage numeric,
  score numeric,
  accuracy numeric,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_student_id ON public.attempts(student_id);

-- 6. PRACTICED QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.practiced_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer text,
  is_correct boolean,
  practiced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practiced_questions_student ON public.practiced_questions(student_id);

-- 7. BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_student ON public.bookmarks(student_id);

-- 8. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. SEED MONITOR ACCOUNT
-- Creates default monitor account if none exists
INSERT INTO public.profiles (
  id, role, status, name, first_name, last_name, email, password,
  time_tracking_acknowledged, stopwatch_visible, email_verified, created_at, updated_at
)
SELECT 
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'monitor',
  'active',
  'Monitor Account',
  'Guardian',
  'Monitor',
  'monitor@jeepractice.local',
  '$pbkdf2-sha256$i=100000$91b5eff61245426207a3572ecb9da1f2$df03d26cdf4b1f96e650d5c8778f65b239293fc0f63a0c61ecabc41bd0c13977',
  true,
  true,
  false,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'monitor' LIMIT 1);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practiced_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Anonymous & authenticated read/write policies for client sync
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_all" ON public.profiles;
CREATE POLICY "profiles_insert_all" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_all" ON public.profiles;
CREATE POLICY "profiles_update_all" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_update_all" ON public.settings;
CREATE POLICY "settings_update_all" ON public.settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "responses_all" ON public.responses;
CREATE POLICY "responses_all" ON public.responses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "visits_all" ON public.visits;
CREATE POLICY "visits_all" ON public.visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attempts_all" ON public.attempts;
CREATE POLICY "attempts_all" ON public.attempts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "practiced_questions_all" ON public.practiced_questions;
CREATE POLICY "practiced_questions_all" ON public.practiced_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bookmarks_all" ON public.bookmarks;
CREATE POLICY "bookmarks_all" ON public.bookmarks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alerts_all" ON public.alerts;
CREATE POLICY "alerts_all" ON public.alerts FOR ALL USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
