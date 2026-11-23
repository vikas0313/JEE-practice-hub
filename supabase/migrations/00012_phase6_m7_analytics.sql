-- ============================================================
-- JEE Practice Hub — Migration 00012: Phase 6 Module M7 Analytics & Settings
--
-- ROLLBACK NOTE:
-- Forward-only migration. If rollback is strictly needed in an emergency:
--   ALTER TABLE settings DROP COLUMN IF EXISTS exam_conditions_adjustment_enabled;
--   ALTER TABLE settings DROP COLUMN IF EXISTS allow_physical_keypad_a11y;
-- ============================================================

-- 1. EXTEND SETTINGS TABLE WITH EXAM-CONDITIONS ADJUSTMENT AND A11Y KEYPAD SETTING
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS exam_conditions_adjustment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_physical_keypad_a11y boolean NOT NULL DEFAULT false;

