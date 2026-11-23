-- Migration: 00027_enhancement_e8_reporting_upgrades.sql
-- Description: E8 Monitor Reporting Upgrades (Saved Views, Custom Filters, Digest Generator)
-- Rollback:
--   DROP TABLE IF EXISTS saved_report_views CASCADE;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e8_custom_reporting;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS flag_e8_custom_reporting BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS saved_report_views (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Monitor only
ALTER TABLE saved_report_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Monitor full access to saved_report_views"
ON saved_report_views
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'monitor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'monitor'
  )
);

