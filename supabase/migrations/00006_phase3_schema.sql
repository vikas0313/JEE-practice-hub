-- ============================================================================
-- 00006_phase3_schema.sql: Schema for Phase 3 Targets, Percentile Maps, Weightages,
-- Estimate Snapshots, Student Estimates, Alerts, Assignments, Shortcut Retries, and Email Logs
-- ============================================================================

-- 1. Targets table (SRD FR-10.1)
CREATE TABLE IF NOT EXISTS public.targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('percentile', 'rank', 'cutoff')),
    target_value NUMERIC(7, 2) NOT NULL,
    candidate_count INTEGER, -- N required if target_type = 'rank'
    cutoff_unit TEXT CHECK (cutoff_unit IN ('marks', 'percentile')),
    exam_date DATE NOT NULL,
    reference_map_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Percentile Maps & Shift Rows (SRD FR-10.3, Section 6.1)
CREATE TABLE IF NOT EXISTS public.percentile_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    shift TEXT NOT NULL,
    source TEXT NOT NULL,
    is_approximation BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.percentile_map_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES public.percentile_maps(id) ON DELETE CASCADE,
    marks NUMERIC(5, 2) NOT NULL,
    percentile NUMERIC(7, 4) NOT NULL,
    CONSTRAINT uniq_map_marks UNIQUE(map_id, marks)
);

-- 3. Chapter Weightages (derived or manual overrides per pattern profile)
CREATE TABLE IF NOT EXISTS public.chapter_weightages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_profile_id UUID NOT NULL REFERENCES public.pattern_profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    expected_questions NUMERIC(4, 2) NOT NULL,
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uniq_profile_subject_chapter UNIQUE(pattern_profile_id, subject, chapter)
);

-- 4. Estimate Snapshots (Monitor Only - Full Bayesian internals & simulation draws)
CREATE TABLE IF NOT EXISTS public.estimate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    as_of TIMESTAMPTZ NOT NULL,
    qualifying_questions_count INTEGER NOT NULL,
    qualifying_chapters_count INTEGER NOT NULL,
    coverage_percentage NUMERIC(5, 2) NOT NULL,
    p10_percentile NUMERIC(6, 2),
    p50_percentile NUMERIC(6, 2),
    p90_percentile NUMERIC(6, 2),
    chance_probability_rounded NUMERIC(4, 2),
    model_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. Student Estimates (Student visible projections - strictly range or coarse band)
CREATE TABLE IF NOT EXISTS public.student_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    display_mode TEXT NOT NULL DEFAULT 'range' CHECK (display_mode IN ('range', 'band')),
    projected_range_low NUMERIC(6, 2),
    projected_range_high NUMERIC(6, 2),
    coarse_band TEXT CHECK (coarse_band IN ('Low', 'Medium', 'High', 'Not enough data yet')),
    as_of TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uniq_student_target_projection UNIQUE(student_id, target_id)
);

-- 6. Alerts & Alert Settings (Replacing/Migrating monitor_notices)
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    dedupe_key TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    cooldown_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inactivity_days INTEGER NOT NULL DEFAULT 3,
    accuracy_drop_threshold NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
    email_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
    monitor_email TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. Assignments (SRD 4.14)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT,
    chapter TEXT,
    topic TEXT,
    level TEXT CHECK (level IN ('Basic', 'Medium', 'Advanced', 'Mixed')),
    target_count INTEGER NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. Shortcut Retries (SRD 4.3 FR-3.10)
CREATE TABLE IF NOT EXISTS public.shortcut_retries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    baseline_active_seconds INTEGER NOT NULL,
    retry_active_seconds INTEGER NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('faster', 'slower')),
    submitted_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. Email Logs (Weekly digest idempotency & audit)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. Migration of existing unread monitor_notices into alerts (if monitor_notices exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monitor_notices') THEN
        INSERT INTO public.alerts (student_id, alert_type, severity, dedupe_key, title, message, status, created_at)
        SELECT 
            student_id,
            'legacy_notice' AS alert_type,
            'info' AS severity,
            'legacy:' || id::text AS dedupe_key,
            title,
            body,
            CASE WHEN is_read THEN 'acknowledged' ELSE 'active' END AS status,
            created_at
        FROM public.monitor_notices
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
