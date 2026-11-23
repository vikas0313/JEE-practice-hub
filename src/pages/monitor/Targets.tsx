// ============================================================
// Targets Management & Chance Projection Console (Phase 3: SRD FR-10.1, 10.2)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import {
  getTargets, createTarget, updateTarget, deleteTarget,
  getPercentileMaps, getStudentProfile, getLatestEstimateSnapshot,
  getStudentEstimate, checkStalePercentileMaps, rolloverNextSession,
} from '../../lib/db';
import { runChanceEstimation } from '../../lib/estimationEngine';
import type { Target, TargetType, CutoffUnit, PercentileMap, EstimateSnapshot } from '../../lib/types';
import { AlertTriangle, RotateCcw, CheckCircle2, ArrowRight } from 'lucide-react';

export default function TargetsPage() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<Target[]>([]);
  const [percentileMaps, setPercentileMaps] = useState<PercentileMap[]>([]);
  const [studentId, setStudentId] = useState<string>('');

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('percentile');
  const [targetValue, setTargetValue] = useState<number>(99.0);
  const [candidateCount, setCandidateCount] = useState<number>(1400000);
  const [cutoffUnit, setCutoffUnit] = useState<CutoffUnit>('marks');
  const [examDate, setExamDate] = useState('2026-04-02');
  const [referenceMapId, setReferenceMapId] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'range' | 'band'>('range');

  // Estimation simulation states
  const [runningTargetId, setRunningTargetId] = useState<string | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<EstimateSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Rollover states (Phase 7 item 10)
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [rolloverDate, setRolloverDate] = useState('2026-04-05');
  const [rolloverResult, setRolloverResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const student = getStudentProfile();
    if (student) setStudentId(student.id);

    const tgts = getTargets();
    setTargets(tgts);

    const maps = getPercentileMaps();
    setPercentileMaps(maps);
    if (maps.length > 0 && !referenceMapId) {
      setReferenceMapId(maps[0].id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !studentId) return;

    createTarget({
      student_id: studentId,
      name: name.trim(),
      target_type: targetType,
      target_value: Number(targetValue),
      candidate_count: targetType === 'rank' ? Number(candidateCount) : null,
      cutoff_unit: targetType === 'cutoff' ? cutoffUnit : null,
      exam_date: examDate,
      reference_map_id: referenceMapId || null,
    });

    setIsCreating(false);
    setName('');
    loadData();
    setMessage('Target created successfully!');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this target?')) {
      deleteTarget(id);
      loadData();
    }
  };

  const handleRunEstimation = (target: Target) => {
    setRunningTargetId(target.id);
    try {
      const res = runChanceEstimation({
        studentId: target.student_id,
        targetId: target.id,
        displayMode,
        minQuestionsThreshold: 5,
        minChaptersThreshold: 2,
      });
      setActiveSnapshot(res.snapshot);
      setMessage(`Projection updated for ${target.name}!`);
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setRunningTargetId(null);
    }
  };

  const handleRollover = () => {
    if (!studentId) {
      alert('No student profile found.');
      return;
    }
    try {
      const res = rolloverNextSession({
        studentId,
        newExamDate: rolloverDate,
        sessionSuffix: 'Session 2',
      });
      setRolloverResult(res);
      loadData();
      setMessage(`Successfully rolled over to Session 2! ${res.copied_targets.length} targets created with new exam date.`);
    } catch (err: any) {
      alert(`Rollover error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Target Goals & Bayesian Chance Projections</h1>
          <p className="text-sm text-gray-600">
            Define student targets (Percentile, Rank, Cut-off) and execute Bayesian Monte Carlo simulations to estimate probability of achievement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRolloverOpen(true)}
            className="px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 font-medium text-sm rounded-lg hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Roll Over to Session 2
          </button>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
          >
            {isCreating ? 'Cancel' : '+ Add Target'}
          </button>
        </div>
      </div>

      {/* Rollover Modal */}
      {isRolloverOpen && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-700" />
                Session 2 Rollover & Focus Suggestions
              </h3>
              <p className="text-xs text-indigo-800 leading-relaxed max-w-2xl">
                When Session 1 ends, rolling over to Session 2 copies existing targets with a new target date, keeps all question practice and error history intact, resets the countdown, and suggests new focus areas based on the weakest chapters from Session 1 history. It does not delete anything, does not reset the streak, and does not send any student-facing messages.
              </p>
            </div>
            <button
              onClick={() => { setIsRolloverOpen(false); setRolloverResult(null); }}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                New Exam Date (Session 2)
              </label>
              <input
                type="date"
                value={rolloverDate}
                onChange={e => setRolloverDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleRollover}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm"
              >
                Confirm Rollover
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {rolloverResult && (
            <div className="mt-4 pt-4 border-t border-indigo-200 space-y-3">
              <div className="p-3 bg-white rounded-lg border border-emerald-300 flex items-center gap-2 text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Successfully created <strong>{rolloverResult.copied_targets.length}</strong> Session 2 targets. Student practice and streak history preserved 100%.
                </span>
              </div>

              {rolloverResult.suggested_focus_areas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Recommended Session 2 Focus Areas (Weakest Chapters from Session 1):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rolloverResult.suggested_focus_areas.map((fa: any) => (
                      <div key={fa.chapter_id} className="p-3 bg-white rounded-lg border border-indigo-100 text-xs space-y-1 shadow-2xs">
                        <div className="font-semibold text-gray-900 flex justify-between">
                          <span>[{fa.subject_id}] {fa.chapter_name}</span>
                          <span className="text-rose-600 font-bold">{fa.accuracy_pct}% Acc</span>
                        </div>
                        <p className="text-gray-500 text-[11px] leading-snug">{fa.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Creation Modal / Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">New Target</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 99th Percentile or Top 5000 Rank"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Type</label>
              <select
                value={targetType}
                onChange={e => setTargetType(e.target.value as TargetType)}
                className="w-full p-2.5 border rounded-lg text-sm"
              >
                <option value="percentile">Percentile</option>
                <option value="rank">AIR Rank</option>
                <option value="cutoff">JEE Advanced Cut-Off</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Value</label>
              <input
                type="number"
                step="any"
                required
                value={targetValue}
                onChange={e => setTargetValue(parseFloat(e.target.value))}
                placeholder={targetType === 'rank' ? 'e.g. 5000' : 'e.g. 99.0'}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            {targetType === 'rank' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Total Candidates (N)</label>
                <input
                  type="number"
                  required
                  value={candidateCount}
                  onChange={e => setCandidateCount(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 border rounded-lg text-sm"
                />
              </div>
            )}

            {targetType === 'cutoff' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Cut-Off Unit</label>
                <select
                  value={cutoffUnit}
                  onChange={e => setCutoffUnit(e.target.value as CutoffUnit)}
                  className="w-full p-2.5 border rounded-lg text-sm"
                >
                  <option value="marks">Marks</option>
                  <option value="percentile">Percentile</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Exam Date</label>
              <input
                type="date"
                required
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Reference Percentile Map</label>
              <select
                value={referenceMapId}
                onChange={e => setReferenceMapId(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              >
                <option value="">None / Select map</option>
                {percentileMaps.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.is_approximation ? '(Approximation)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Save Target
            </button>
          </div>
        </form>
      )}

      {/* Target Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {targets.map(target => {
          const map = percentileMaps.find(m => m.id === target.reference_map_id);
          const snap = getLatestEstimateSnapshot(target.student_id, target.id);
          const studentEst = getStudentEstimate(target.student_id, target.id);
          const staleWarning = target.reference_map_id
            ? checkStalePercentileMaps(target.exam_date).find(w => w.map_id === target.reference_map_id && w.is_stale)
            : null;

          return (
            <div key={target.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              {staleWarning && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Stale Percentile Map Warning:</span> {staleWarning.warning_message}
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {target.target_type}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">{target.name}</h3>
                  <p className="text-xs text-gray-500">Exam Date: {target.exam_date}</p>
                </div>
                <button
                  onClick={() => handleDelete(target.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  Delete
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block sm:inline">Target Value:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {target.target_value} {target.target_type === 'percentile' ? '%ile' : target.target_type === 'rank' ? `(AIR)` : target.cutoff_unit}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="text-gray-500 block sm:inline">Shift Map:</span>{' '}
                  <span className="font-semibold text-gray-900 break-words inline-block max-w-full">
                    {map ? map.name : <span className="text-amber-600 font-normal">Needs map</span>}
                  </span>
                </div>
              </div>

              {/* Snapshot Info (Monitor-only telemetry) */}
              {snap && (
                <div className="border border-indigo-100 bg-indigo-50/50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-bold text-indigo-950">
                    <span>Monte Carlo Projection (10,000 draws)</span>
                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded">
                      {snap.chance_probability_rounded !== null ? `${Math.round(snap.chance_probability_rounded * 100)}% chance` : 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center py-1">
                    <div className="bg-white p-1.5 rounded border">
                      <div className="text-[10px] text-gray-500">P10 (Low)</div>
                      <div className="font-bold text-gray-800">{snap.p10_percentile ?? '—'}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border">
                      <div className="text-[10px] text-gray-500">P50 (Median)</div>
                      <div className="font-bold text-gray-800">{snap.p50_percentile ?? '—'}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border">
                      <div className="text-[10px] text-gray-500">P90 (High)</div>
                      <div className="font-bold text-gray-800">{snap.p90_percentile ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                    <span>Coverage: {snap.coverage_percentage}% ({snap.qualifying_chapters_count} chaps)</span>
                    <span>Sample: {snap.qualifying_questions_count} first answers</span>
                  </div>
                </div>
              )}

              {/* Student View Indicator */}
              <div className="text-xs text-gray-500 flex items-center justify-between border-t pt-3">
                <span>
                  Student sees:{' '}
                  <strong className="text-gray-800">
                    {studentEst
                      ? studentEst.display_mode === 'range'
                        ? studentEst.projected_range_low !== null
                          ? `${studentEst.projected_range_low} - ${studentEst.projected_range_high} %ile`
                          : 'Not enough data yet'
                        : studentEst.coarse_band
                      : 'Not enough data yet'}
                  </strong>
                </span>
                <button
                  disabled={runningTargetId === target.id}
                  onClick={() => handleRunEstimation(target)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold disabled:opacity-50"
                >
                  {runningTargetId === target.id ? 'Simulating...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
