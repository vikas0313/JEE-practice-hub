-- ============================================================
-- JEE Practice Hub — Migration 00019: Enhancement Module E9 (Performance & Visual Polish)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS preferences;
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e9_performance_and_visual_polish;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e9_performance_and_visual_polish BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Display & Accessibility Preferences on Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{"theme":"light","fontSize":"normal","highContrast":false,"reducedMotion":false}'::jsonb;

