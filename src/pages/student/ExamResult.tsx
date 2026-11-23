import React, { useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getExam,
  getAttempts,
  getResponsesByAttempt,
  getExamQuestions,
  getAllQuestions,
  getAllQuestionAnswers,
  getAllSolutions,
} from '../../lib/db';
import type { Exam, Attempt, Question } from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';
import { SolutionTabs } from '../../components/SolutionTabs';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';

export default function ExamResult() {
  const { id: examId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const reasonParam = searchParams.get('reason');

  const { user } = useAuth();
  const studentId = user?.id || '';

  const exam = useMemo(() => (examId ? getExam(examId) : null), [examId]);
  const attempts = useMemo(() => {
    return user ? getAttempts().filter(a => a.exam_id === examId && a.student_id === user.id) : [];
  }, [examId, user]);

  const attempt = attempts[0] || null;

  const responses = useMemo(() => {
    return attempt ? getResponsesByAttempt(attempt.id) : [];
  }, [attempt]);

  const examQuestions = useMemo(() => (examId ? getExamQuestions(examId) : []), [examId]);
  const allQs = useMemo(() => getAllQuestions(), []);
  const allAnswers = useMemo(() => getAllQuestionAnswers(), []);
  const allSolutions = useMemo(() => getAllSolutions(), []);

  const qMap = useMemo(() => new Map(allQs.map(q => [q.id, q])), [allQs]);
  const aMap = useMemo(() => new Map(allAnswers.map(a => [a.question_id, a])), [allAnswers]);
  const sMap = useMemo(() => new Map(allSolutions.map(s => [s.question_id, s])), [allSolutions]);

  if (!exam || !attempt) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Result not found</h2>
        <Link to="/exams" className="text-blue-600 font-semibold text-sm">
          &larr; Return to Exams
        </Link>
      </div>
    );
  }

  // Score statistics
  const score = attempt.score ?? 0;
  const maxMarks = attempt.total_marks ?? exam.max_marks;
  const correctCount = responses.filter(r => r.is_correct === true).length;
  const wrongCount = responses.filter(r => r.is_correct === false && r.answer !== null).length;
  const unattemptedCount = responses.filter(r => r.answer === null || r.answer === '').length;
  const accuracy = correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;

  const submitReason = attempt.submit_reason || reasonParam;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <Link
        to="/exams"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Exams
      </Link>

      {/* Auto-Submit Notice if abnormal termination */}
      {submitReason && submitReason !== 'submitted' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 flex items-start gap-3.5 text-amber-950">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Exam Auto-Submitted: {submitReason.replace(/_/g, ' ')}
            </h3>
            <p className="text-xs text-amber-900 leading-relaxed">
              {submitReason === 'left_full_screen'
                ? 'The examination environment was exited (or browser was reloaded). All answers saved prior to exit have been recorded and scored.'
                : submitReason === 'time_up'
                ? 'The official test duration ended. Your examination was submitted automatically.'
                : 'The exam was safely closed.'}
            </p>
          </div>
        </div>
      )}

      {/* Score Summary Card */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Examination Performance
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">{exam.name}</h1>
            <p className="text-xs text-blue-200 mt-1">
              Revision Score (Exam questions test previously practised concepts).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-6 py-4 rounded-2xl text-center shrink-0">
            <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block">Revision Score</span>
            <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono mt-0.5 block">
              {score} <span className="text-lg text-white/80 font-normal">/ {maxMarks}</span>
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/15 text-center">
          <div className="bg-white/10 p-3 rounded-xl">
            <span className="text-xs text-blue-200 block">Correct</span>
            <span className="text-xl font-bold text-emerald-300 font-mono mt-0.5 block">
              {correctCount} Qs
            </span>
          </div>
          <div className="bg-white/10 p-3 rounded-xl">
            <span className="text-xs text-blue-200 block">Incorrect</span>
            <span className="text-xl font-bold text-rose-300 font-mono mt-0.5 block">
              {wrongCount} Qs
            </span>
          </div>
          <div className="bg-white/10 p-3 rounded-xl">
            <span className="text-xs text-blue-200 block">Unattempted</span>
            <span className="text-xl font-bold text-gray-300 font-mono mt-0.5 block">
              {unattemptedCount} Qs
            </span>
          </div>
          <div className="bg-white/10 p-3 rounded-xl">
            <span className="text-xs text-blue-200 block">Accuracy</span>
            <span className="text-xl font-bold text-amber-300 font-mono mt-0.5 block">
              {accuracy}%
            </span>
          </div>
        </div>
      </div>

      {/* Solutions and Question Review */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          Question Review & Solutions
        </h2>
        <p className="text-xs text-gray-500">
          Now that the exam is submitted, official answers, step-by-step solutions, and shortcut methods are released.
        </p>

        <div className="space-y-4 pt-2">
          {examQuestions.map((eq, idx) => {
            const q = qMap.get(eq.question_id);
            if (!q) return null;
            const resp = responses.find(r => r.question_id === q.id);
            const qa = aMap.get(q.id);
            const sol = sMap.get(q.id);

            const isCorrect = resp?.is_correct === true;
            const isUnattempted = !resp?.answer;

            return (
              <div
                key={eq.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4"
              >
                {/* Question Status Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-gray-900">
                      Q{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      Section {eq.section} ({q.type})
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {q.difficulty}
                    </span>
                  </div>

                  <div>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Correct (+{resp?.marks} Marks)
                      </span>
                    ) : isUnattempted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        Unattempted (0 Marks)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incorrect ({resp?.marks} Marks)
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-gray-900 font-medium text-base leading-relaxed">
                  <KaTeXText text={q.question_text} />
                </div>

                {/* Response vs Correct */}
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-gray-500 mr-1.5">Your Response:</span>
                    <strong className={isCorrect ? 'text-emerald-700' : resp?.answer ? 'text-rose-700' : 'text-gray-600'}>
                      {resp?.answer ? resp.answer : 'None (Unattempted)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 mr-1.5">Correct Answer:</span>
                    <strong className="text-emerald-700">
                      {qa?.answer_text || qa?.correct_answer}
                    </strong>
                  </div>
                </div>

                {/* Solutions Component */}
                {sol && (
                  <div className="pt-2">
                    <SolutionTabs
                      solution={sol}
                      questionId={q.id}
                      studentId={studentId}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
