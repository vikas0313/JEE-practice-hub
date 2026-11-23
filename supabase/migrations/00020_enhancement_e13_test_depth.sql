-- ============================================================
-- JEE Practice Hub — Migration 00020: Enhancement Module E13 (Test Depth & QA Resilience)
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback needed:
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_e13_enhanced_testing;
-- ============================================================

-- 1. Feature Flag on Settings (Default OFF)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS flag_e13_enhanced_testing BOOLEAN NOT NULL DEFAULT FALSE;

