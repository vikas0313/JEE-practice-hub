-- ============================================================================
-- 00007_phase3_rls.sql: Row-Level Security for Phase 3 Entities
-- ============================================================================

-- Enable RLS on all Phase 3 tables
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.percentile_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.percentile_map_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_weightages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortcut_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Targets RLS
-- Students: read-only access to their targets (id, name, target_type, target_value, exam_date)
-- Monitor: full CRUD
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor has full access to targets"
    ON public.targets
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

CREATE POLICY "Student can view assigned targets"
    ON public.targets
    FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
    );

-- ----------------------------------------------------------------------------
-- 2. Percentile Maps & Rows RLS (Monitor Only)
-- Students have zero access
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to percentile_maps"
    ON public.percentile_maps
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

CREATE POLICY "Monitor full access to percentile_map_rows"
    ON public.percentile_map_rows
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 3. Chapter Weightages RLS (Monitor Only)
-- Students have zero access
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to chapter_weightages"
    ON public.chapter_weightages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 4. Estimate Snapshots RLS (Monitor Only - Internal State)
-- Students have zero access (protects simulation draws, probability, and internals)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to estimate_snapshots"
    ON public.estimate_snapshots
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 5. Student Estimates RLS (Student View - Projections Only)
-- Students can read their own projection.
-- Monitor can read/write.
-- ----------------------------------------------------------------------------
CREATE POLICY "Student can view own student_estimates"
    ON public.student_estimates
    FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
    );

CREATE POLICY "Monitor full access to student_estimates"
    ON public.student_estimates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 6. Alerts & Alert Settings RLS (Monitor Only)
-- Students have zero access (no notices, no alerts, no anxiety)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to alerts"
    ON public.alerts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

CREATE POLICY "Monitor full access to alert_settings"
    ON public.alert_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 7. Assignments RLS
-- Students can read assignments directed to them.
-- Monitor has full CRUD.
-- ----------------------------------------------------------------------------
CREATE POLICY "Student can view own assignments"
    ON public.assignments
    FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
    );

CREATE POLICY "Monitor full access to assignments"
    ON public.assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 8. Shortcut Retries RLS
-- Inserted via server/security definer function or user.
-- Monitor can see all columns (including baseline_active_seconds and retry_active_seconds).
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to shortcut_retries"
    ON public.shortcut_retries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

-- ----------------------------------------------------------------------------
-- 9. Email Logs RLS (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to email_logs"
    ON public.email_logs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );
