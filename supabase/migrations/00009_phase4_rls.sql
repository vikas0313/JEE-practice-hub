-- ============================================================================
-- 00009_phase4_rls.sql: Row-Level Security for Phase 4 Entities
-- ============================================================================
-- Enforces deny-by-default on all Phase 4 tables.
-- Students are DENIED access to paper_manifests, batches, review_samples,
-- defect_logs, ai_cost_logs, question_revisions, and unpublished questions/papers.
-- Monitor gets full CRUD access across all management tables.

-- 1. Enable RLS on all Phase 4 tables
ALTER TABLE public.paper_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Paper Manifests (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to paper_manifests"
    ON public.paper_manifests
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

-- ----------------------------------------------------------------------------
-- 3. Batches (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to batches"
    ON public.batches
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

-- ----------------------------------------------------------------------------
-- 4. Key Versions (Monitor Only Full Access)
-- Students cannot read key versions directly
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to key_versions"
    ON public.key_versions
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

-- ----------------------------------------------------------------------------
-- 5. Question Revisions (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to question_revisions"
    ON public.question_revisions
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

-- ----------------------------------------------------------------------------
-- 6. Review Samples (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to review_samples"
    ON public.review_samples
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

-- ----------------------------------------------------------------------------
-- 7. Defect Logs (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to defect_logs"
    ON public.defect_logs
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

-- ----------------------------------------------------------------------------
-- 8. AI Cost Logs (Monitor Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Monitor full access to ai_cost_logs"
    ON public.ai_cost_logs
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

-- ----------------------------------------------------------------------------
-- 9. Updated Visibility Policies for Papers & Questions
-- ----------------------------------------------------------------------------
-- Drop existing permissive public read if present and replace with status-aware checks
DROP POLICY IF EXISTS "papers_select" ON public.papers;
CREATE POLICY "papers_select_published" ON public.papers
    FOR SELECT
    TO authenticated
    USING (
        status = 'published'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );

DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select_published" ON public.questions
    FOR SELECT
    TO authenticated
    USING (
        (
            is_active = true
            AND superseded_by IS NULL
            AND needs_tag_review = false
            AND needs_key_review = false
            AND (figure_required = false OR figure_status = 'attached' OR figure_status = 'redrawn')
            AND EXISTS (
                SELECT 1 FROM public.papers
                WHERE papers.id = questions.paper_id AND papers.status = 'published'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'monitor'
        )
    );
