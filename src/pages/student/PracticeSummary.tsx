import React, { useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getAttempt,
  getResponsesByAttempt,
  getAllQuestions,
  getAllQuestionAnswers,
  getTopics,
  getChapters,
  getSubjects,
  getSyllabusTopics,
  getSyllabusChapters,
  getSyllabusSubjects,
  getQuestionTopic,
  getQuestionChapter,
  getQuestionSubject,
} from '../../lib/db';
import { Award, ArrowRight, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { KaTeXText } from '../../lib/katex-render';

export default function PracticeSummary() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const attempt = useMemo(() => (attemptId ? getAttempt(attemptId) : null), [attemptId]);

  // Authorization guard: Student can only access their own practice summary
  useEffect(() => {
    if (attempt && user && attempt.student_id !== user.id) {
      navigate('/practice', { replace: true });
    }
  }, [attempt, user, navigate]);

  const responses = useMemo(() => (attemptId ? getResponsesByAttempt(attemptId) : []), [attemptId]);
  const allQuestions = useMemo(() => getAllQuestions(), []);
  const allAnswers = useMemo(() => getAllQuestionAnswers(), []);
  const topics = useMemo(() => getTopics(), []);
  const chapters = useMemo(() => getChapters(), []);
  const subjects = useMemo(() => getSubjects(), []);

  const totalQuestions = responses.length;
  const correctCount = responses.filter(r => r.is_correct).length;
  const wrongCount = responses.filter(r => r.submitted_at && !r.is_correct).length;
  const score = responses.reduce((acc, r) => acc + (r.marks || 0), 0);
  const maxScore = totalQuestions * 4;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const firstQ = responses[0] ? allQuestions.find(item => item.id === responses[0].question_id) : null;
  const topic = topics.find(t => t.id === attempt?.topic_id) || getSyllabusTopics().find(t => t.id === attempt?.topic_id);
  const chapter = chapters.find(c => c.id === attempt?.chapter_id) || getSyllabusChapters().find(c => c.id === attempt?.chapter_id);
  const subject = subjects.find(s => s.id === attempt?.subject_id) || getSyllabusSubjects().find(s => s.id === attempt?.subject_id);

  const topicName = topic?.name || (firstQ ? getQuestionTopic(firstQ) : '') || (firstQ as any)?.topic || (firstQ as any)?.subtopic || 'Practice Set';
  const chapterName = chapter?.name || (firstQ ? getQuestionChapter(firstQ) : '') || (firstQ as any)?.chapter || 'General';
  const subjectName = subject?.name || (firstQ ? getQuestionSubject(firstQ) : '') || (firstQ as any)?.subject || 'Physics';

  if (!attempt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Attempt summary not found.</p>
        <Link to="/practice" className="mt-4 inline-block text-blue-600 font-semibold">
          Return to Practice
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-6 sm:p-8 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <Award size={28} className="text-amber-300" />
          <span className="text-xs uppercase font-bold tracking-widest text-blue-200">
            Practice Set Completed
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{topicName}</h1>
        <p className="text-blue-100 text-sm mt-1">{subjectName}{chapterName ? ` · ${chapterName}` : ''}</p>

        {/* Score cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/20">
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm">
            <span className="text-xs text-blue-200 uppercase font-medium">Score</span>
            <p className="text-2xl font-bold mt-0.5">{score} <span className="text-sm font-normal text-blue-200">/ {maxScore}</span></p>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm">
            <span className="text-xs text-blue-200 uppercase font-medium">Accuracy</span>
            <p className="text-2xl font-bold mt-0.5">{accuracy}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm">
            <span className="text-xs text-blue-200 uppercase font-medium">Correct</span>
            <p className="text-2xl font-bold mt-0.5 text-green-300">{correctCount}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm">
            <span className="text-xs text-blue-200 uppercase font-medium">Incorrect</span>
            <p className="text-2xl font-bold mt-0.5 text-red-300">{wrongCount}</p>
          </div>
        </div>
      </div>

      {/* Question by Question Review (Notice: NO time per question is shown!) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Question Review</h2>

        {responses.map((resp, i) => {
          const q = allQuestions.find(item => item.id === resp.question_id);
          const qa = allAnswers.find(item => item.question_id === resp.question_id);
          if (!q) return null;

          return (
            <div key={resp.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 uppercase">Question {i + 1} ({q.difficulty})</span>
                  <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded select-all">
                    ID: {q.id}
                  </span>
                </div>
                {resp.is_correct ? (
                  <span className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    <CheckCircle size={13} /> Correct (+4)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    <XCircle size={13} /> Incorrect ({resp.marks || -1})
                  </span>
                )}
              </div>

              <div className="text-gray-800 text-sm">
                <KaTeXText text={q.question_text} />
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-4 text-xs font-semibold">
                <div>
                  <span className="text-gray-400 block font-normal">Your Answer</span>
                  <span className={resp.is_correct ? 'text-green-700' : 'text-red-600'}>
                    {resp.answer || 'Unattempted'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-normal">Correct Answer</span>
                  <span className="text-gray-900">{qa?.answer_text || qa?.correct_answer || 'N/A'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <Link
          to="/practice"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm hover:bg-blue-800 transition-colors shadow-sm"
        >
          <RotateCcw size={16} />
          <span>Practice Another Topic</span>
        </Link>
        <Link
          to="/results"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 font-bold text-sm hover:bg-gray-50 transition-colors"
        >
          <span>View All Results</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

