-- ============================================================
-- JEE Practice Hub — Migration 00014: Phase 6 Module M2 JEE Advanced Pool
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   ALTER TABLE settings DROP COLUMN IF EXISTS include_jee_advanced_in_practice;
-- ============================================================

-- 1. EXTEND SETTINGS TABLE WITH JEE ADVANCED PRACTICE POOL TOGGLE
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS include_jee_advanced_in_practice boolean NOT NULL DEFAULT false;

