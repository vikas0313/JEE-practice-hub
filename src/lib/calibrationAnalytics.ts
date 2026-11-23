// ============================================================
// JEE Practice Hub — Module E6: Calibration & Error Analytics
// ============================================================

import { v4 as uuid } from 'uuid';
import type {
  CalibrationSnapshot,
  ConfidenceAccuracyBin,
  ErrorMatrixSummary,
} from './types';
import {
  getResponsesByStudent,
  getRevisionItems,
  saveCalibrationSnapshot,
} from './db';

/**
 * Calculates Brier score: (1/N) * sum((prob - outcome)^2).
 * Lower is better (0.0 = perfect calibration).
 */
export function calculateBrierScore(
  predictions: { confidence: number; isCorrect: boolean }[]
): number | null {
  if (predictions.length === 0) return null;
  const sum = predictions.reduce((acc, p) => {
    const outcome = p.isCorrect ? 1 : 0;
    return acc + Math.pow(p.confidence - outcome, 2);
  }, 0);
  return Number((sum / predictions.length).toFixed(4));
}

/**
 * Calculates Expected Calibration Error (ECE) across N confidence bins.
 */
export function calculateECE(
  predictions: { confidence: number; isCorrect: boolean }[],
  binCount = 5
): number | null {
  if (predictions.length === 0) return null;
  const bins = buildCalibrationBins(predictions, binCount);
  let weightedError = 0;

  for (const b of bins) {
    if (b.sample_count > 0) {
      const error = Math.abs(b.observed_accuracy - b.expected_confidence);
      weightedError += error * (b.sample_count / predictions.length);
    }
  }

  return Number(weightedError.toFixed(4));
}

/**
 * Bins predictions into uniform confidence intervals and computes observed accuracy.
 */
export function buildCalibrationBins(
  predictions: { confidence: number; isCorrect: boolean }[],
  binCount = 5
): ConfidenceAccuracyBin[] {
  const binWidth = 1.0 / binCount;
  const bins: ConfidenceAccuracyBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const start = Number((i * binWidth).toFixed(2));
    const end = Number(((i + 1) * binWidth).toFixed(2));

    const inBin = predictions.filter(
      (p) => p.confidence >= start && (i === binCount - 1 ? p.confidence <= end : p.confidence < end)
    );

    const count = inBin.length;
    const avgConf = count > 0 ? inBin.reduce((s, p) => s + p.confidence, 0) / count : (start + end) / 2;
    const correctCount = inBin.filter((p) => p.isCorrect).length;
    const obsAcc = count > 0 ? correctCount / count : 0;

    bins.push({
      bin_start: start,
      bin_end: end,
      sample_count: count,
      expected_confidence: Number(avgConf.toFixed(3)),
      observed_accuracy: Number(obsAcc.toFixed(3)),
    });
  }

  return bins;
}

/**
 * Computes full calibration snapshot and persists it for monitor analysis.
 * CRITICAL INVARIANT: Student NEVER sees calibration metrics, Brier scores, or error matrices.
 */
export function computeCalibrationMetrics(studentId: string): CalibrationSnapshot {
  const responses = getResponsesByStudent(studentId);

  // Map response confidence tags to numerical probabilities
  const predictions: { confidence: number; isCorrect: boolean }[] = [];
  let slips = 0;
  let confidentTotal = 0;
  let guesses = 0;
  let unconfidentTotal = 0;

  for (const r of responses) {
    if (r.is_correct === null) continue;

    let conf = 0.50; // default medium
    const cTag = (r.confidence as string) || '';
    if (cTag === 'Sure' || cTag === 'high') conf = 0.85;
    else if (cTag === 'Not sure' || cTag === 'medium') conf = 0.50;
    else if (cTag === 'Guess' || cTag === 'low') conf = 0.25;

    predictions.push({ confidence: conf, isCorrect: r.is_correct });

    // Slip: high confidence (>= 0.70) but incorrect
    if (conf >= 0.70) {
      confidentTotal++;
      if (!r.is_correct) slips++;
    }

    // Guess: low confidence (<= 0.30) but correct
    if (conf <= 0.30) {
      unconfidentTotal++;
      if (r.is_correct) guesses++;
    }
  }

  const brier = calculateBrierScore(predictions);
  const ece = calculateECE(predictions, 5);
  const bins = buildCalibrationBins(predictions, 5);
  const slipRate = confidentTotal > 0 ? Number((slips / confidentTotal).toFixed(4)) : 0;
  const guessRate = unconfidentTotal > 0 ? Number((guesses / unconfidentTotal).toFixed(4)) : 0;

  const snapshot: CalibrationSnapshot = {
    id: uuid(),
    student_id: studentId,
    as_of: new Date().toISOString(),
    brier_score: brier,
    expected_calibration_error: ece,
    confidence_accuracy_bins: bins,
    slip_rate: slipRate,
    guess_rate: guessRate,
    created_at: new Date().toISOString(),
  };

  saveCalibrationSnapshot(snapshot);
  return snapshot;
}

/**
 * Computes the error matrix taxonomy breakdown from mistakes and error tags.
 */
export function computeErrorTaxonomyBreakdown(studentId: string): ErrorMatrixSummary {
  const mistakes = getRevisionItems(studentId);
  const responses = getResponsesByStudent(studentId);

  let conceptual = 0;
  let calculation = 0;
  let careless = 0;
  let timePressure = 0;

  for (const r of responses) {
    if (!r.is_correct && r.error_reason) {
      const reason = r.error_reason.toLowerCase();
      if (reason.includes('concept')) conceptual++;
      else if (reason.includes('calculation')) calculation++;
      else if (reason.includes('misread') || reason.includes('silly') || reason.includes('careless')) careless++;
      else if (reason.includes('time') || reason.includes('rushed')) timePressure++;
      else conceptual++;
    }
  }

  const total = conceptual + calculation + careless + timePressure;

  return {
    conceptual_error_count: conceptual,
    calculation_error_count: calculation,
    careless_error_count: careless,
    time_pressure_error_count: timePressure,
    total_classified_errors: total,
  };
}
