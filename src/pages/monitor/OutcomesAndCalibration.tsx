import React, { useState, useEffect } from 'react';
import {
  getStudentProfile, getTargets, getRealOutcomes, recordRealOutcome,
  getCalibrationLogs, checkStalePercentileMaps, getSettings,
} from '../../lib/db';
import { computeCalibrationMetrics, computeErrorTaxonomyBreakdown } from '../../lib/calibrationAnalytics';
import type { RealExamOutcome, CalibrationLogEntry, StalePercentileMapWarning, CalibrationSnapshot, ErrorMatrixSummary } from '../../lib/types';
import { Award, AlertTriangle, CheckCircle2, TrendingUp, HelpCircle, History, BarChart2, Target } from 'lucide-react';

export default function OutcomesAndCalibration() {
  const student = getStudentProfile();
  const targets = getTargets();
  const primaryTarget = targets[0];

  const [outcomes, setOutcomes] = useState<RealExamOutcome[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationLogEntry[]>([]);
  const [staleWarnings, setStaleWarnings] = useState<StalePercentileMapWarning[]>([]);

  const settings = getSettings();
  const [calibSnapshot, setCalibSnapshot] = useState<CalibrationSnapshot | null>(null);
  const [errorMatrix, setErrorMatrix] = useState<ErrorMatrixSummary | null>(null);

  // Form state
  const [examName, setExamName] = useState('JEE Main 2026 Session 1');
  const [examDate, setExamDate] = useState(primaryTarget?.exam_date || '2026-01-24');
  const [actualScore, setActualScore] = useState('');
  const [actualPercentile, setActualPercentile] = useState('');
  const [actualRank, setActualRank] = useState('');
  const [categoryRank, setCategoryRank] = useState('');
  const [admitCardNo, setAdmitCardNo] = useState('');
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const refreshData = () => {
    if (student) {
      setOutcomes(getRealOutcomes(student.id));
      setCalibrations(getCalibrationLogs(student.id));
    } else {
      setOutcomes(getRealOutcomes());
      setCalibrations(getCalibrationLogs());
    }

    const targetDate = primaryTarget?.exam_date || examDate || '2026-04-01';
    setStaleWarnings(checkStalePercentileMaps(targetDate).filter(w => w.is_stale));

    if (student && settings.flag_e6_calibration_analytics) {
      setCalibSnapshot(computeCalibrationMetrics(student.id));
      setErrorMatrix(computeErrorTaxonomyBreakdown(student.id));
    }
  };

  useEffect(() => {
    refreshData();
  }, [student, primaryTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavedSuccess(false);

    const scoreNum = parseFloat(actualScore);
    const percentileNum = parseFloat(actualPercentile);

    if (isNaN(scoreNum) || scoreNum < -75 || scoreNum > 300) {
      setErrorMsg('Please enter a valid actual score between -75 and 300.');
      return;
    }

    if (isNaN(percentileNum) || percentileNum < 0 || percentileNum > 100) {
      setErrorMsg('Please enter a valid actual percentile between 0 and 100.');
      return;
    }

    const studentId = student?.id || 'std-1';
    const rankNum = actualRank ? parseInt(actualRank, 10) : null;
    const catRankNum = categoryRank ? parseInt(categoryRank, 10) : null;

    try {
      recordRealOutcome({
        student_id: studentId,
        exam_name: examName.trim(),
        exam_date: examDate,
        actual_score: scoreNum,
        actual_percentile: percentileNum,
        actual_rank: rankNum,
        category_rank: catRankNum,
        admit_card_app_no: admitCardNo.trim() || null,
        notes: notes.trim() || null,
      });

      setSavedSuccess(true);
      setActualScore('');
      setActualPercentile('');
      setActualRank('');
      setCategoryRank('');
      setNotes('');
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record real exam outcome.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-7 h-7 text-indigo-600" />
          After the Exam: Real Outcomes & Calibration Log
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Record verified official NTA JEE Main results, compare against final system projections, and inspect model calibration logs.
        </p>
      </div>

      {/* Honest Assessment & N=1 Limitation Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">
            N=1 Calibration Notice & Scientific Integrity Policy
          </p>
          <p className="text-amber-800 leading-relaxed">
            Real exam outcomes are compared directly against the final Bayesian shrinkage projection to assess estimation fidelity. Note that an N=1 comparison is strictly anecdotal, not statistical. To prevent severe overfitting, the app does <strong>NOT</strong> automatically adjust its underlying projection model based on a single student outcome. All errors and residuals are displayed honestly below.
          </p>
        </div>
      </div>

      {/* Stale Percentile Map Warning */}
      {staleWarnings.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 mr-3 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-orange-800">
                Stale Percentile Translation Map Warning
              </h3>
              {staleWarnings.map(w => (
                <p key={w.map_id} className="text-xs text-orange-700 mt-1">
                  {w.warning_message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Outcome Entry Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Record Official JEE Main Result
        </h2>

        {savedSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Exam outcome recorded and calibration log updated successfully!
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Exam Name / Session
              </label>
              <input
                type="text"
                required
                value={examName}
                onChange={e => setExamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. JEE Main 2026 Session 1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Official Exam Date
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Actual Score (Out of 300) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={actualScore}
                onChange={e => setActualScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 215.0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Actual NTA Percentile *
              </label>
              <input
                type="number"
                step="0.0000001"
                required
                value={actualPercentile}
                onChange={e => setActualPercentile(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 99.4218041"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                All India Rank (AIR) (Optional)
              </label>
              <input
                type="number"
                value={actualRank}
                onChange={e => setActualRank(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 6420"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Category Rank (Optional)
              </label>
              <input
                type="number"
                value={categoryRank}
                onChange={e => setCategoryRank(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 1150"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Admit Card / Application No. (Optional)
              </label>
              <input
                type="text"
                value={admitCardNo}
                onChange={e => setAdmitCardNo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 260310048123"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Notes & Student Feedback
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Shift difficulty feedback, exam hall conditions, or paper surprise notes..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
            >
              Record Outcome & Calculate Calibration
            </button>
          </div>
        </form>
      </div>

      {/* Calibration Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Calibration Log & Residuals</h2>
          </div>
          <span className="text-xs text-gray-500">
            {calibrations.length} records recorded
          </span>
        </div>

        {calibrations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No real exam outcomes recorded yet. Record an outcome above to view projection calibration metrics.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Exam Date</th>
                  <th className="px-6 py-3">Predicted vs Actual Score</th>
                  <th className="px-6 py-3">Predicted vs Actual %ile</th>
                  <th className="px-6 py-3">Predicted vs Actual Rank</th>
                  <th className="px-6 py-3">Error Residuals (Δ)</th>
                  <th className="px-6 py-3">Scientific Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calibrations.map(c => {
                  const outcome = outcomes.find(o => o.id === c.real_outcome_id);
                  const scoreDiffSign = c.score_diff > 0 ? `+${c.score_diff}` : `${c.score_diff}`;
                  const pctDiffSign = c.percentile_diff > 0 ? `+${c.percentile_diff}` : `${c.percentile_diff}`;
                  const rankDiffSign = c.rank_diff != null ? (c.rank_diff > 0 ? `+${c.rank_diff}` : `${c.rank_diff}`) : 'N/A';

                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{outcome?.exam_name || 'JEE Main'}</div>
                        <div className="text-xs text-gray-500">{outcome?.exam_date || new Date(c.created_at).toLocaleDateString()}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-mono text-gray-900">
                          {c.predicted_score.toFixed(1)} &rarr; <span className="font-bold text-indigo-700">{c.actual_score.toFixed(1)}</span>
                        </div>
                        <div className="text-xs text-gray-500">Predicted &rarr; Actual</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-mono text-gray-900">
                          {c.predicted_percentile.toFixed(2)}% &rarr; <span className="font-bold text-indigo-700">{c.actual_percentile.toFixed(2)}%</span>
                        </div>
                        <div className="text-xs text-gray-500">Predicted &rarr; Actual</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-mono text-gray-900">
                          {c.predicted_rank ? `#${c.predicted_rank}` : 'None'} &rarr; <span className="font-bold text-indigo-700">{c.actual_rank ? `#${c.actual_rank}` : 'None'}</span>
                        </div>
                        <div className="text-xs text-gray-500">Predicted &rarr; Actual</div>
                      </td>

                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Score Δ:</span>
                          <span className={`inline-block px-1.5 py-0.5 text-xs font-mono font-semibold rounded ${
                            c.score_diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {scoreDiffSign}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">%ile Δ:</span>
                          <span className={`inline-block px-1.5 py-0.5 text-xs font-mono font-semibold rounded ${
                            c.percentile_diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {pctDiffSign}%
                          </span>
                        </div>
                        {c.rank_diff != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Rank Δ:</span>
                            <span className="inline-block px-1.5 py-0.5 text-xs font-mono font-semibold rounded bg-gray-100 text-gray-800">
                              {rankDiffSign}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 max-w-xs text-xs text-gray-600 leading-snug">
                        {c.calibration_notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Module E6: Advanced Calibration & Error Taxonomy Analytics */}
      {settings.flag_e6_calibration_analytics && calibSnapshot && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Advanced Calibration &amp; Error Taxonomy (Module E6)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Monitors probability calibration, overconfidence slip rates, and error taxonomy matrices.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              Monitor Only
            </span>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Brier Score</span>
              <p className="text-xl font-black text-gray-900 mt-1">
                {calibSnapshot.brier_score !== null ? calibSnapshot.brier_score : 'N/A'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">0.0 = perfect calibration</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase">ECE</span>
              <p className="text-xl font-black text-gray-900 mt-1">
                {calibSnapshot.expected_calibration_error !== null
                  ? `${(calibSnapshot.expected_calibration_error * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Expected Calibration Error</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Slip Rate</span>
              <p className="text-xl font-black text-rose-600 mt-1">
                {calibSnapshot.slip_rate !== null ? `${(calibSnapshot.slip_rate * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">High confidence &rarr; wrong</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Guess Rate</span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {calibSnapshot.guess_rate !== null ? `${(calibSnapshot.guess_rate * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Low confidence &rarr; correct</p>
            </div>
          </div>

          {/* Reliability Bins Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Confidence Reliability Bins
            </h3>
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5">Confidence Bin</th>
                    <th className="px-4 py-2.5">Samples</th>
                    <th className="px-4 py-2.5">Expected Confidence</th>
                    <th className="px-4 py-2.5">Observed Accuracy</th>
                    <th className="px-4 py-2.5">Calibration Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calibSnapshot.confidence_accuracy_bins.map((bin, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono font-medium">
                        {(bin.bin_start * 100).toFixed(0)}% &ndash; {(bin.bin_end * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-2">{bin.sample_count}</td>
                      <td className="px-4 py-2 font-mono">{(bin.expected_confidence * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 font-mono">{(bin.observed_accuracy * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2">
                        <span
                          className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                            Math.abs(bin.observed_accuracy - bin.expected_confidence) < 0.1
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {(Math.abs(bin.observed_accuracy - bin.expected_confidence) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Taxonomy Matrix */}
          {errorMatrix && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Error Taxonomy Breakdown ({errorMatrix.total_classified_errors} total errors)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="font-semibold text-purple-900 block">Conceptual</span>
                  <span className="text-lg font-bold text-purple-700">
                    {errorMatrix.conceptual_error_count}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="font-semibold text-blue-900 block">Calculation</span>
                  <span className="text-lg font-bold text-blue-700">
                    {errorMatrix.calculation_error_count}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="font-semibold text-amber-900 block">Careless</span>
                  <span className="text-lg font-bold text-amber-700">
                    {errorMatrix.careless_error_count}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="font-semibold text-rose-900 block">Time Pressure</span>
                  <span className="text-lg font-bold text-rose-700">
                    {errorMatrix.time_pressure_error_count}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
