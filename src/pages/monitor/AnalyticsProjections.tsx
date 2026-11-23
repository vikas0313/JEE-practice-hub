import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStudentProfile,
  getTargets,
  getSettings,
  updateSettings,
  checkStalePercentileMaps,
} from '../../lib/db';
import {
  computeShrinkageProjection,
  computeExamConditionsAdjustment,
  generateAssignmentSuggestions,
  getEstimateSnapshotsForTarget,
  PROJECTION_DISCLAIMER,
} from '../../lib/projectionEngine';
import {
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Sliders,
  Sparkles,
  Zap,
  ArrowRight,
  Clock,
  Layers,
  ChevronRight,
  Info,
  AlertTriangle,
} from 'lucide-react';

export default function AnalyticsProjections() {
  const navigate = useNavigate();
  const student = useMemo(() => getStudentProfile(), []);
  const targets = useMemo(() => getTargets(), []);
  const initialSettings = useMemo(() => getSettings(), []);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => targets[0]?.id || '');
  const [examAdjEnabled, setExamAdjEnabled] = useState<boolean>(
    initialSettings.exam_conditions_adjustment_enabled ?? false
  );

  const studentId = student?.id || '';

  // 1. Projection Computation
  const projection = useMemo(() => {
    if (!studentId || !selectedTargetId) return null;
    return computeShrinkageProjection({ studentId, targetId: selectedTargetId });
  }, [studentId, selectedTargetId]);

  // 2. Exam Conditions Adjustment Computation
  const examAdj = useMemo(() => {
    if (!studentId) return null;
    return computeExamConditionsAdjustment(studentId);
  }, [studentId]);

  // 3. Snapshot Trend History
  const snapshots = useMemo(() => {
    if (!studentId || !selectedTargetId) return [];
    return getEstimateSnapshotsForTarget(studentId, selectedTargetId);
  }, [studentId, selectedTargetId]);

  // 4. Assignment Suggestions
  const suggestions = useMemo(() => {
    if (!studentId) return [];
    return generateAssignmentSuggestions(studentId);
  }, [studentId]);

  // 5. Stale Percentile Map Warning Check
  const staleWarning = useMemo(() => {
    const target = targets.find(t => t.id === selectedTargetId);
    if (!target || !target.reference_map_id) return null;
    return checkStalePercentileMaps(target.exam_date).find(w => w.map_id === target.reference_map_id && w.is_stale);
  }, [targets, selectedTargetId]);

  const handleToggleAdjustment = (enabled: boolean) => {
    setExamAdjEnabled(enabled);
    updateSettings({ exam_conditions_adjustment_enabled: enabled });
  };

  const handleOpenTestBuilder = (subjId: string, chapId: string, title: string) => {
    navigate(`/monitor/exams/new?subject=${subjId}&chapter=${chapId}&title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={28} />
            Performance Analytics & Trajectory Projections
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor-only view of Bayesian trajectory models, exam pressure differentials, and targeted drill recommendations.
          </p>
        </div>

        {targets.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Target size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-gray-700">Target:</span>
            <select
              value={selectedTargetId}
              onChange={e => setSelectedTargetId(e.target.value)}
              className="text-xs font-medium text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              {targets.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.target_value}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stale Percentile Map Warning */}
      {staleWarning && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Stale Percentile Translation Map Warning
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {staleWarning.warning_message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Trajectory Projection Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            Bayesian Shrinkage Trajectory Projection
          </h2>
          <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-100">
            Model: P&#770;(t) = P&#770;&#8320; + &Delta;t&middot;&beta;&#770;&#8347; &plusmn; 1.96&middot;SE(t)
          </span>
        </div>

        {projection?.status === 'insufficient_history' ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Minimum Trajectory Gates Not Yet Met</p>
                <p className="text-xs text-amber-800 mt-1">{projection.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Practice History</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {projection.current_weeks} / {projection.required_weeks} weeks
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (projection.current_weeks / projection.required_weeks) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Qualifying First Answers</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {projection.current_first_answers} / {projection.required_first_answers}
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (projection.current_first_answers / projection.required_first_answers) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Distinct Chapters Covered</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {projection.chapters_covered} / {projection.required_chapters}
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (projection.chapters_covered / projection.required_chapters) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : projection?.status === 'sufficient' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700">Current Chance of Target</div>
                <div className="text-2xl font-black text-indigo-900 mt-1">{projection.current_chance_pct}%</div>
                <div className="text-xs text-indigo-600 mt-1">From latest calibrated snapshot</div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="text-xs font-semibold text-emerald-700">Projected Chance on Exam Date</div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {projection.projected_exam_chance_pct}%
                </div>
                <div className="text-xs text-emerald-600 mt-1">
                  Target Exam Date: {projection.target_exam_date}
                </div>
              </div>

              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="text-xs font-semibold text-purple-700">95% Confidence Interval</div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  {projection.ci_lower_pct}% &ndash; {projection.ci_upper_pct}%
                </div>
                <div className="text-xs text-purple-600 mt-1">&plusmn; 1.96 standard error at target date</div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold text-gray-600">Trajectory Velocity (Shrunk)</div>
                <div className="text-2xl font-black text-gray-900 mt-1">
                  {projection.shrunk_slope_pct_per_week && projection.shrunk_slope_pct_per_week > 0 ? '+' : ''}
                  {projection.shrunk_slope_pct_per_week}% / wk
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  OLS slope {projection.ols_slope_pct_per_week}% (shrinkage factor &lambda; = {projection.shrinkage_factor})
                </div>
              </div>
            </div>

            {/* Trajectory Timeline Points */}
            {projection.trajectory_points && projection.trajectory_points.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Weekly Trajectory Forecast Milestones
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Milestone</th>
                        <th className="py-2.5 px-4">Projected Date</th>
                        <th className="py-2.5 px-4 text-center">Projected Chance</th>
                        <th className="py-2.5 px-4 text-right">95% Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {projection.trajectory_points.map(pt => (
                        <tr key={pt.week} className="hover:bg-gray-50/50">
                          <td className="py-2 px-4 font-semibold text-gray-800">Week +{pt.week}</td>
                          <td className="py-2 px-4 text-gray-600">{pt.date}</td>
                          <td className="py-2 px-4 text-center font-bold text-indigo-700">{pt.projected_pct}%</td>
                          <td className="py-2 px-4 text-right text-gray-600 font-mono">
                            [{pt.ci_lower_pct}% &ndash; {pt.ci_upper_pct}%]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Mandatory Prominent Caveat */}
        <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-blue-900 text-xs flex items-center gap-2">
          <Info size={16} className="text-blue-600 flex-shrink-0" />
          <span>
            <strong>Caveat:</strong> {PROJECTION_DISCLAIMER}
          </span>
        </div>
      </div>

      {/* 2. Exam-Conditions Adjustment Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sliders className="text-indigo-600" size={20} />
              Exam-Conditions Adjustment (SRD Section 6.1)
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Differential between performance under timed exam pressure vs relaxed practice: &Delta; = Accuracy(fresh, exam) &minus; Accuracy(practice).
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={examAdjEnabled}
              disabled={!examAdj?.eligible}
              onChange={e => handleToggleAdjustment(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className={`text-xs font-bold ${!examAdj?.eligible ? 'text-gray-400' : 'text-gray-900'}`}>
              Apply Adjustment to Simulation
            </span>
          </label>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-700">Status & Data Sample</div>
            <p className="text-xs text-gray-600 mt-0.5">{examAdj?.message}</p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-gray-500">Exam Fresh Accuracy</div>
              <div className="font-bold text-gray-900">{examAdj?.exam_accuracy_pct ?? '&mdash;'}%</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Practice Accuracy</div>
              <div className="font-bold text-gray-900">{examAdj?.practice_accuracy_pct ?? '&mdash;'}%</div>
            </div>
            <div className="text-right pl-2 border-l border-gray-200">
              <div className="text-gray-500">Adjustment Delta</div>
              <div className={`font-black ${examAdj && examAdj.adjustment_delta < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {examAdj ? `${(examAdj.adjustment_delta * 100).toFixed(1)}%` : '&mdash;'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Smart Targeted Drill Suggestions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Zap className="text-amber-500" size={20} />
              Targeted Practice & Exam Suggestions
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              High-impact recommendations based on accuracy deficits, slow pacing, and high-weightage topic gaps. (Never auto-assigned).
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{suggestions.length} suggestions</span>
        </div>

        {suggestions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No critical gaps or slow chapters detected. Student practice is well-balanced across syllabus weightages.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map(s => (
              <div
                key={s.id}
                className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        s.type === 'weak_chapter'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : s.type === 'slow_pacing'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}
                    >
                      {s.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{s.metric_summary}</span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-3">{s.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenTestBuilder(s.subject_id, s.chapter_id, s.title)}
                  className="w-full py-2 px-3 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  Review in Test Builder
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Historical Snapshot Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="text-indigo-600" size={20} />
          Estimate Snapshot History
        </h2>

        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No snapshots recorded for this target yet. Run or schedule chance estimations to populate trend data.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-4">Calculated At</th>
                  <th className="py-2.5 px-4 text-center">First Answers</th>
                  <th className="py-2.5 px-4 text-center">Chapters</th>
                  <th className="py-2.5 px-4 text-center">P10</th>
                  <th className="py-2.5 px-4 text-center">P50</th>
                  <th className="py-2.5 px-4 text-center">P90</th>
                  <th className="py-2.5 px-4 text-right">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {snapshots.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="py-2 px-4 text-gray-700 font-mono">
                      {new Date(s.as_of || s.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-600">
                      {s.qualifying_questions_count}
                      {s.model_metadata.practice_first_answers_count !== undefined && (
                        <span className="text-[10px] text-gray-400 block">
                          (P: {s.model_metadata.practice_first_answers_count}, E: {s.model_metadata.exam_fresh_answers_count ?? 0})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-600">{s.qualifying_chapters_count}</td>
                    <td className="py-2 px-4 text-center font-mono text-gray-600">{s.p10_percentile ?? '&mdash;'}</td>
                    <td className="py-2 px-4 text-center font-mono text-gray-600">{s.p50_percentile ?? '&mdash;'}</td>
                    <td className="py-2 px-4 text-center font-mono text-gray-600">{s.p90_percentile ?? '&mdash;'}</td>
                    <td className="py-2 px-4 text-right font-black text-indigo-700">
                      {s.chance_probability_rounded !== null
                        ? `${(s.chance_probability_rounded * 100).toFixed(0)}%`
                        : 'Insufficient Data'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
