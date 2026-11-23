-- ============================================================
-- JEE Practice Hub — Migration 00003: Seed Data
-- ============================================================

INSERT INTO pattern_profiles (id, name, questions_per_subject, mcq_per_subject, nvq_per_subject, duration_minutes, marks_correct_mcq, marks_wrong_mcq, marks_correct_nvq, marks_wrong_nvq, marks_unattempted, nvq_attempt_rule, language_options)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'JEE Main 2026',
  25, 20, 5, 180, 4, -1, 4, 0, 0,
  'any_5_of_10',
  '{English}'
) ON CONFLICT DO NOTHING;

INSERT INTO settings (id, ideal_time_basic, ideal_time_medium, ideal_time_advanced, idle_timeout)
VALUES (
  's0000000-0000-0000-0000-000000000001',
  60, 120, 180, 300
) ON CONFLICT DO NOTHING;

