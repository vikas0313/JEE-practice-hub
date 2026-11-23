// ============================================================
// Module E14: Feature Flag Registry & Rollback Center
// Unified monitor dashboard listing all enhancement flags,
// current live state, descriptions, and rollback instructions.
// ============================================================

import React, { useState, useMemo } from 'react';
import { getSettings, updateSettings } from '../../lib/db';
import { Settings } from '../../lib/types';
import {
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Terminal,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';

interface FlagDefinition {
  key: keyof Settings;
  id: string;
  name: string;
  category: 'Foundation & Security' | 'Learning & Practice' | 'Analytics & Planning' | 'UX & Utilities';
  description: string;
  migrationFile: string;
  rollbackCommand: string;
}

export const ENHANCEMENT_FLAGS: FlagDefinition[] = [
  {
    key: 'flag_e10_ux_completeness',
    id: 'E10',
    name: 'UX Completeness & Safety Defaults',
    category: 'Foundation & Security',
    description: 'Student onboarding tour, 30s destructive action undo grace window, zero-time student exports, and branded email templates.',
    migrationFile: '00017_enhancement_e10_safety_ux.sql',
    rollbackCommand: 'ALTER TABLE settings DROP COLUMN IF EXISTS flag_e10_ux_completeness;',
  },
  {
    key: 'flag_e9_performance_and_visual_polish',
    id: 'E9',
    name: 'Performance & Visual Polish',
    category: 'UX & Utilities',
    description: 'Vendor route-splitting, next-question text prefetching, dark mode theme toggle with strict CBT exam exemption.',
    migrationFile: '00018_enhancement_e9_performance.sql',
    rollbackCommand: 'ALTER TABLE settings DROP COLUMN IF EXISTS flag_e9_performance_and_visual_polish;',
  },
  {
    key: 'flag_e13_enhanced_testing',
    id: 'E13',
    name: 'Test Depth & QA Resilience',
    category: 'Foundation & Security',
    description: 'Seeded PRNG tests, Monte Carlo convergence verification, KaTeX parser fuzzing, and telemetry soak pipelines.',
    migrationFile: '00019_enhancement_e13_testing.sql',
    rollbackCommand: 'ALTER TABLE settings DROP COLUMN IF EXISTS flag_e13_enhanced_testing;',
  },
  {
    key: 'flag_e12_integrity_resilience',
    id: 'E12',
    name: 'Sync Idempotency & Circuit Breaker',
    category: 'Foundation & Security',
    description: 'Client event sequence tracking, idempotency deduplication keys, dead letter jobs isolation, and automatic sync circuit breaker.',
    migrationFile: '00020_enhancement_e12_sync_idempotency.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS sync_idempotency_keys, client_event_sequences, dead_letter_jobs CASCADE;',
  },
  {
    key: 'flag_e11_account_security',
    id: 'E11',
    name: 'Account Security & Sessions',
    category: 'Foundation & Security',
    description: 'Active device session management, remote token revocation, monitor-only login notices, single-use MFA backup codes, and CSP audit reports.',
    migrationFile: '00022_enhancement_e11_account_security.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS user_sessions, csp_reports, mfa_recovery_codes CASCADE;',
  },
  {
    key: 'flag_e1_adaptive_repetition',
    id: 'E1',
    name: 'Adaptive Practice & Spaced Repetition v2',
    category: 'Learning & Practice',
    description: 'Dynamic SM-2 spaced repetition intervals, ease factor decay, and Today’s Focus queue capped strictly at 3 items per day.',
    migrationFile: '00023_enhancement_e1_adaptive_spaced_repetition.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS spaced_repetition_cards CASCADE;',
  },
  {
    key: 'flag_e6_calibration_analytics',
    id: 'E6',
    name: 'Calibration & Error Analytics',
    category: 'Analytics & Planning',
    description: 'Brier score calculation, Expected Calibration Error (ECE), slip vs guess rates, and 5-bin confidence-accuracy reliability curves.',
    migrationFile: '00024_enhancement_e6_calibration_analytics.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS calibration_snapshots CASCADE;',
  },
  {
    key: 'flag_e3_revision_cards',
    id: 'E3',
    name: 'Revision Cards, Notes & Formula Sheets',
    category: 'Learning & Practice',
    description: 'Human-verified chapter concept notes, high-yield KaTeX formula extraction, and printer-friendly student formula sheet downloads.',
    migrationFile: '00025_enhancement_e3_revision_notes_formula_sheets.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS chapter_notes CASCADE;',
  },
  {
    key: 'flag_e5_advanced_exam_analytics',
    id: 'E5',
    name: 'Advanced Exam Analytics',
    category: 'Analytics & Planning',
    description: '4-quadrant speed-accuracy categorization, multi-pass attempt order navigation analysis, and avoided-slip what-if score simulations.',
    migrationFile: '00026_enhancement_e5_advanced_exam_analytics.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS exam_advanced_analytics CASCADE;',
  },
  {
    key: 'flag_e8_custom_reporting',
    id: 'E8',
    name: 'Monitor Reporting Upgrades',
    category: 'Analytics & Planning',
    description: 'Multifaceted saved report views, live analytical aggregate metrics, and monitor-only monthly digest generators (Zero-Student-Email compliant).',
    migrationFile: '00027_enhancement_e8_reporting_upgrades.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS saved_report_views CASCADE;',
  },
  {
    key: 'flag_e7_exam_auto_composer',
    id: 'E7',
    name: 'Auto-Compose Exam Draft & Study Planner',
    category: 'Analytics & Planning',
    description: 'Balanced 75-question mock exam generator matching official NTA distribution (20 MCQ + 5 NVQ per subject) and weekly study targets.',
    migrationFile: '00028_enhancement_e7_auto_compose_planner.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS study_plans CASCADE;',
  },
  {
    key: 'flag_e4_question_search_embeddings',
    id: 'E4',
    name: 'Search & "More Like This" Embeddings',
    category: 'Learning & Practice',
    description: 'Full-text token search and pseudo-embedding cosine similarity, unlocking strictly post-submission "More Like This" suggestions.',
    migrationFile: '00029_enhancement_e4_search_embeddings.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS question_search_indices CASCADE;',
  },
  {
    key: 'flag_e2_concept_map',
    id: 'E2',
    name: 'Subtopic Taxonomy & Prerequisite Concept Map',
    category: 'Learning & Practice',
    description: 'Granular subtopics, prerequisite dependency DAG traversal, cycle detection, and student prerequisite readiness evaluations.',
    migrationFile: '00030_enhancement_e2_concept_map.sql',
    rollbackCommand: 'DROP TABLE IF EXISTS concept_prerequisites, subtopics CASCADE;',
  },
  {
    key: 'flag_g3_practice_scratchpad',
    id: 'G3',
    name: 'Practice Digital Scratchpad',
    category: 'UX & Utilities',
    description: 'Canvas stylus/finger scratchpad exclusively in Practice mode, with zero network transmission and zero server storage.',
    migrationFile: '00031_enhancement_g3_digital_scratchpad.sql',
    rollbackCommand: 'ALTER TABLE settings DROP COLUMN IF EXISTS flag_g3_practice_scratchpad;',
  },
];

export default function FeatureFlagRegistry() {
  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const categories = ['All', 'Foundation & Security', 'Learning & Practice', 'Analytics & Planning', 'UX & Utilities'];

  const filteredFlags = useMemo(() => {
    return ENHANCEMENT_FLAGS.filter((f) => selectedCategory === 'All' || f.category === selectedCategory);
  }, [selectedCategory]);

  const activeCount = useMemo(() => {
    return ENHANCEMENT_FLAGS.filter((f) => !!settings[f.key]).length;
  }, [settings]);

  const handleToggleFlag = (key: keyof Settings) => {
    const nextVal = !settings[key];
    const updated = updateSettings({ [key]: nextVal });
    setSettings({ ...updated });
  };

  const handleCopyRollback = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-md tracking-wider uppercase">
              Module E14
            </span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Feature Flag Registry &amp; Rollback Center</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Complete inventory of all 14 enhancement modules, live runtime switches, and emergency rollback SQL commands.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>{activeCount} of {ENHANCEMENT_FLAGS.length} Active</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Flags List */}
      <div className="space-y-4">
        {filteredFlags.map((flag) => {
          const isActive = !!settings[flag.key];

          return (
            <div
              key={flag.id}
              className={`p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-white border-indigo-200 shadow-sm'
                  : 'bg-gray-50/70 border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-black rounded-md tracking-wider uppercase">
                      {flag.id}
                    </span>
                    <h2 className="text-sm font-bold text-gray-900">{flag.name}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold border border-gray-200">
                      {flag.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{flag.description}</p>
                  <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                    <span>
                      Migration: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{flag.migrationFile}</code>
                    </span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleFlag(flag.key)}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition"
                    aria-label={`Toggle ${flag.name}`}
                  >
                    <span className={`text-xs font-bold ${isActive ? 'text-indigo-700' : 'text-gray-400'}`}>
                      {isActive ? 'ENABLED' : 'DISABLED'}
                    </span>
                    {isActive ? (
                      <ToggleRight size={38} className="text-indigo-600" />
                    ) : (
                      <ToggleLeft size={38} className="text-gray-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyRollback(flag.rollbackCommand, flag.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition"
                    title="Copy Rollback SQL"
                  >
                    <Terminal size={12} />
                    <span>{copiedKey === flag.id ? 'Copied SQL!' : 'Rollback SQL'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

