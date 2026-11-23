// ============================================================
// Phase 4: Two-Stage Solver & Shortcut Verification Engine
// ============================================================
// Scope Items 20, 21, 22, 23 & FR-5.2
// Stage 1: Blind solve (never sees answer key).
// Stage 2: Full step-by-step solution + shortcut with key known.
// Status: 'Key-matched' ONLY if both stages agree with official key.
// Shortcuts must use valid FR-5.2 type and reproduce the correct answer.

import type { ShortcutType, VerificationStatus } from './types';

export const VALID_SHORTCUT_TYPES: ShortcutType[] = [
  'formula trick',
  'option elimination',
  'back-substitution',
  'dimensional analysis',
  'approximation',
  'symmetry',
  'special-case check',
];

export interface Stage1BlindOutput {
  blind_final_answer: string;
  reasoning: string;
  model: string;
  provider: string;
}

export interface Stage2SolutionOutput {
  step_by_step_solution: string;
  final_answer: string;
  shortcut: string | null;
  shortcut_type: ShortcutType | null;
  shortcut_note: string | null;
  shortcut_final_answer: string | null;
  model: string;
  provider: string;
}

export interface SolverVerificationResult {
  verification_status: VerificationStatus;
  matches_key: boolean;
  needs_key_review: boolean;
  flag_reason: string | null;
  solution_steps: string;
  shortcut: string | null;
  shortcut_type: ShortcutType | null;
  shortcut_note: string | null;
  provenance: {
    stage1_model: string;
    stage2_model: string;
    prompt_version: string;
    run_id: string;
    verified_at: string;
  };
}

export function compareAnswers(
  computed: string,
  target: string,
  isNumerical: boolean = false,
  tolerance: number = 0.01
): boolean {
  const c = computed.trim().toUpperCase();
  const t = target.trim().toUpperCase();

  if (!isNumerical) {
    return c === t;
  }

  // Numerical comparison with rounding tolerance
  const numC = parseFloat(c);
  const numT = parseFloat(t);

  if (isNaN(numC) || isNaN(numT)) {
    return c === t;
  }

  if (Math.abs(numT) < 1e-6) {
    return Math.abs(numC - numT) <= 1e-4;
  }

  return Math.abs(numC - numT) / Math.abs(numT) <= tolerance;
}

export function evaluateTwoStageSolve(
  officialKey: string,
  stage1: Stage1BlindOutput,
  stage2: Stage2SolutionOutput,
  isNumerical: boolean = false,
  runId: string = 'run-default',
  promptVersion: string = '1.0'
): SolverVerificationResult {
  const stage1Agrees = compareAnswers(stage1.blind_final_answer, officialKey, isNumerical);
  const stage2Agrees = compareAnswers(stage2.final_answer, officialKey, isNumerical);

  let verification_status: VerificationStatus = 'Unverified';
  let matches_key = false;
  let needs_key_review = false;
  let flag_reason: string | null = null;

  if (stage1Agrees && stage2Agrees) {
    verification_status = 'Key-matched';
    matches_key = true;
  } else if (!stage1Agrees) {
    verification_status = 'Flagged';
    matches_key = false;
    needs_key_review = true;
    flag_reason = `Key or solve in doubt: Stage 1 blind solve got "${stage1.blind_final_answer}", official key is "${officialKey}"`;
  } else if (!stage2Agrees) {
    verification_status = 'Flagged';
    matches_key = false;
    needs_key_review = true;
    flag_reason = `Stage 2 solution final answer "${stage2.final_answer}" does not match official key "${officialKey}"`;
  }

  // Shortcut verification (Item 21)
  let validShortcut = stage2.shortcut;
  let validShortcutType = stage2.shortcut_type;
  let validShortcutNote = stage2.shortcut_note;

  if (validShortcut) {
    // Validate shortcut type
    if (!validShortcutType || !VALID_SHORTCUT_TYPES.includes(validShortcutType)) {
      validShortcut = null;
      validShortcutType = null;
      validShortcutNote = 'Rejected: invalid or unrecognized shortcut type';
    } else if (stage2.shortcut_final_answer) {
      const shortcutAgrees = compareAnswers(stage2.shortcut_final_answer, officialKey, isNumerical);
      if (!shortcutAgrees) {
        validShortcut = null;
        validShortcutType = null;
        validShortcutNote = `Rejected: shortcut produced "${stage2.shortcut_final_answer}" instead of official answer "${officialKey}"`;
      }
    }
  }

  return {
    verification_status,
    matches_key,
    needs_key_review,
    flag_reason,
    solution_steps: stage2.step_by_step_solution,
    shortcut: validShortcut,
    shortcut_type: validShortcutType,
    shortcut_note: validShortcutNote,
    provenance: {
      stage1_model: stage1.model,
      stage2_model: stage2.model,
      prompt_version: promptVersion,
      run_id: runId,
      verified_at: new Date().toISOString(),
    },
  };
}
