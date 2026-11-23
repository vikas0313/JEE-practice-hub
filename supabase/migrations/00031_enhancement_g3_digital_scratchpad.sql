-- Migration: 00031_enhancement_g3_digital_scratchpad.sql
-- Description: G3 Practice Digital Scratchpad (Canvas-based tablet scratchpad for practice mode)
-- Rollback:
--   ALTER TABLE settings DROP COLUMN IF EXISTS flag_g3_practice_scratchpad;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS flag_g3_practice_scratchpad BOOLEAN NOT NULL DEFAULT false;

