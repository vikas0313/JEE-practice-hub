import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getExam,
  getAttempts,
  getResponsesByAttempt,
  getExamQuestions,
  getAllQuestions,
  getAllQuestionAnswers,
  getExamTelemetry,
  getAllVisits,
  copyExam,
  getStudentProfile,
  getSettings,
} from '../../lib/db';
import { runAdvancedExamAnalytics } from '../../lib/examAdvancedAnalytics';
import type { Exam, Attempt } from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';
import {
  ArrowLeft,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  HelpCircle,
  Activity,
  Layers,
} from 'lucide-react';

export default function ExamResultDetail() {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const exam = useMemo(() => (examId ? getExam(examId) : null), [examId]);
  const attempts = useMemo(() => {
    return examId ? getAttempts().filter(a => a.exam_id === examId) : [];
  }, [examId]);

  const attempt: Attempt | undefined = attempts[0];

  const student = useMemo(() => getStudentProfile(), []);
  const examQuestions = useMemo(() => (examId ? getExamQuestions(examId) : []), [examId]);
  const allQs = useMemo(() => getAllQuestions(), []);
  const allAnswers = useMemo(() => getAllQuestionAnswers(), []);
  const allVisits = useMemo(() => getAllVisits(), []);

  const qMap = useMemo(() => new Map(allQs.map(q => [q.id, q])), [allQs]);
  const aMap = useMemo(() => new Map(allAnswers.map(a => [a.question_id, a])), [allAnswers]);

  const responses = useMemo(() => {
    return attempt ? getResponsesByAttempt(attempt.id) : [];
  }, [attempt]);

  const telemetryEvents = useMemo(() => {
    return attempt ? getExamTelemetry(attempt.id) : [];
  }, [attempt]);

  const settings = useMemo(() => getSettings(), []);
  const advAnalytics = useMemo(() => {
    if (!attempt || !settings.flag_e5_advanced_exam_analytics) return null;
    return runAdvancedExamAnalytics(attempt.id);
  }, [attempt, settings.flag_e5_advanced_exam_analytics]);

  const handleIssueFreshCopy = () => {
    if (!exam) return;
    const copy = copyExam(exam.id, `${exam.name} (Fresh Attempt)`);
    alert(`Fresh copy created successfully (ID: ${copy.id}). The student can take this attempt once published.`);
    navigate(`/monitor/exams/${copy.id}`);
  };

  if (!exam) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Exam not found</h2>
        <Link to="/monitor/exams" className="text-indigo-600 font-semibold text-sm">
          &larr; Return to Exams
        </Link>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-4 max-w-xl mx-auto my-12">
        <HelpCircle className="w-12 h-12 text-gray-400 mx-auto" />
        <h3 className="text-lg font-bold text-gray-800">No Attempts Recorded Yet</h3>
        <p className="text-xs text-gray-500">
          The student has not started or submitted an attempt for this examination yet.
        </p>
        <Link
          to="/monitor/exams"
          className="inline-block text-xs font-bold text-indigo-600 hover:text-indigo-800"
        >
          &larr; Back to Exams
        </Link>
      </div>
    );
  }

  const correctCount = responses.filter(r => r.is_correct === true).length;
  const wrongCount = responses.filter(r => r.is_correct === false && r.answer !== null).length;
  const unattemptedCount = responses.filter(r => r.answer === null || r.answer === '').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/monitor/exams"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Exams
          </Link>
          <h1 className="text-2xl font-black text-gray-900">{exam.name} — Monitor Analytics</h1>
          <p className="text-xs text-gray-500 mt-1">
            Candidate: <strong>{student?.name || 'Student'}</strong> · Full telemetry, timing, and order of attempt.
          </p>
        </div>

        <button
          onClick={handleIssueFreshCopy}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Copy className="w-4 h-4" /> Issue Fresh Copy
        </button>
      </div>

      {/* Auto-Submit Notice if abnormal */}
      {attempt.submit_reason && attempt.submit_reason !== 'submitted' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-3.5 text-amber-950">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Exam End Reason: {attempt.submit_reason.replace(/_/g, ' ')}
            </h3>
            <p className="text-xs text-amber-900 leading-relaxed">
              This attempt was terminated with reason "{attempt.submit_reason}".
              If legitimate hardware or electrical disruption occurred, use "Issue Fresh Copy" to allow a clean retake.
            </p>
          </div>
        </div>
      )}

      {/* Score Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Final Score</span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono mt-1">
            {attempt.score ?? 0} <span className="text-sm font-normal text-gray-500">/ {attempt.total_marks ?? exam.max_marks}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tab Switches / Focus Loss</span>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono mt-1">
            {telemetryEvents.filter(e => e.event_type === 'tab_switch' || e.event_type === 'fullscreen_exit').length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Accuracy</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono mt-1">
            {correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Outcome</span>
          <div className="text-sm font-extrabold text-gray-800 mt-2 space-y-0.5">
            <div className="text-emerald-700">{correctCount} Correct (+4)</div>
            <div className="text-rose-700">{wrongCount} Incorrect ({exam.marks_wrong_mcq})</div>
            <div className="text-gray-500">{unattemptedCount} Unattempted</div>
          </div>
        </div>
      </div>

      {/* Module E5: Advanced Exam Analytics (Quadrants, Navigation Strategy, What-If) */}
      {settings.flag_e5_advanced_exam_analytics && advAnalytics && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Advanced Exam Analytics (Module E5)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Speed vs accuracy quadrants, student attempt navigation flow, and avoidable slip simulations.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              Monitor Only
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Speed / Accuracy Quadrants */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Speed &amp; Accuracy Quadrants
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Fast &amp; Accurate</span>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">
                    {advAnalytics.speed_accuracy_quadrants.efficient_mastery_count}
                  </div>
                  <span className="text-[10px] text-gray-400">Mastery</span>
                </div>

                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-800 uppercase">Fast &amp; Inaccurate</span>
                  <div className="text-lg font-black text-rose-700 mt-0.5">
                    {advAnalytics.speed_accuracy_quadrants.rushed_error_count}
                  </div>
                  <span className="text-[10px] text-gray-400">Rush Error</span>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-800 uppercase">Slow &amp; Accurate</span>
                  <div className="text-lg font-black text-amber-700 mt-0.5">
                    {advAnalytics.speed_accuracy_quadrants.time_sink_count}
                  </div>
                  <span className="text-[10px] text-gray-400">Time Sink</span>
                </div>

                <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-800 uppercase">Slow &amp; Inaccurate</span>
                  <div className="text-lg font-black text-slate-700 mt-0.5">
                    {advAnalytics.speed_accuracy_quadrants.stuck_bottleneck_count}
                  </div>
                  <span className="text-[10px] text-gray-400">Bottleneck</span>
                </div>
              </div>
            </div>

            {/* Attempt Order Strategy */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Attempt Navigation Flow
              </h3>
              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Strategy</span>
                  <span className="font-bold text-indigo-700">
                    {advAnalytics.attempt_order_strategy.strategy_classification}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">First-Pass Questions</span>
                  <span className="font-mono font-bold text-gray-800">
                    {advAnalytics.attempt_order_strategy.round1_attempts_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Second-Pass Re-visits</span>
                  <span className="font-mono font-bold text-gray-800">
                    {advAnalytics.attempt_order_strategy.round2_attempts_count}
                  </span>
                </div>
              </div>
            </div>

            {/* What-If Unforced Slips Simulation */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                What-If Slip Avoidance
              </h3>
              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Actual Score</span>
                  <span className="font-mono font-bold text-gray-800">
                    {advAnalytics.what_if_simulation.actual_score}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">If Slips Avoided</span>
                  <span className="font-mono font-black text-emerald-700">
                    {advAnalytics.what_if_simulation.potential_score_if_slips_avoided}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Est. Percentile Gain</span>
                  <span className="font-mono font-bold text-indigo-600">
                    +{advAnalytics.what_if_simulation.estimated_percentile_gain}%ile
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Breakdown Table */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Question-by-Question Telemetry
        </h2>
        <p className="text-xs text-gray-500">
          Monitor view: Question visit order, answer revisions, and time taken (never visible to student).
        </p>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Q#</th>
                <th className="p-3">Section</th>
                <th className="p-3">Difficulty</th>
                <th className="p-3">Answer</th>
                <th className="p-3">Correct Key</th>
                <th className="p-3 text-center">Changes</th>
                <th className="p-3 text-right">Result</th>
                <th className="p-3 text-right">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {examQuestions.map((eq, idx) => {
                const q = qMap.get(eq.question_id);
                if (!q) return null;
                const resp = responses.find(r => r.question_id === q.id);
                const qa = aMap.get(q.id);

                return (
                  <tr key={eq.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-500">
                      {resp?.visit_order ? `#${resp.visit_order}` : '-'}
                    </td>
                    <td className="p-3 font-bold text-gray-900">Q{idx + 1}</td>
                    <td className="p-3 text-gray-600">Sec {eq.section} ({q.type})</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        q.difficulty === 'Basic'
                          ? 'bg-blue-50 text-blue-700'
                          : q.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="p-3 font-bold">
                      {resp?.answer ? resp.answer : <span className="text-gray-400 font-normal italic">Unattempted</span>}
                    </td>
                    <td className="p-3 font-bold text-emerald-700 font-mono">
                      {qa?.answer_text || qa?.correct_answer}
                    </td>
                    <td className="p-3 text-center font-mono text-gray-600">
                      {resp?.answer_changes_count ?? 0}
                    </td>
                    <td className="p-3 text-right">
                      {resp?.is_correct === true ? (
                        <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : resp?.answer ? (
                        <span className="text-rose-700 font-bold inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Wrong
                        </span>
                      ) : (
                        <span className="text-gray-400">Skipped</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-black">
                      {resp?.marks !== null && resp?.marks !== undefined
                        ? resp.marks > 0 ? `+${resp.marks}` : resp.marks
                        : 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
