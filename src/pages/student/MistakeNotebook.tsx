import React, { useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import {
  getRevisionItems,
  clearRevisionItem,
  getAllQuestions,
  getAllSolutions,
  getAllQuestionAnswers,
  getSubjects,
  getChapters,
  getSolution,
  getQuestionAnswer,
  getResponsesByStudent,
  scoreResponse,
  recordPracticedQuestion,
} from '../../lib/db';
import type { RevisionItem, Question, ErrorReason } from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';
import { SolutionTabs } from '../../components/SolutionTabs';
import {
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function MistakeNotebook() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'due' | 'all' | 'confident_wrong' | 'cleared'>('due');
  const [reAttemptingQid, setReAttemptingQid] = useState<string | null>(null);
  const [reAttemptAnswer, setReAttemptAnswer] = useState<string>('');
  const [reAttemptFeedback, setReAttemptFeedback] = useState<{ isCorrect: boolean; msg: string } | null>(null);
  const [openSolutionQid, setOpenSolutionQid] = useState<string | null>(null);

  const studentId = user?.id || '';

  const revisionItems = useMemo(() => getRevisionItems(studentId), [studentId]);
  const questions = useMemo(() => getAllQuestions(), []);
  const subjects = useMemo(() => getSubjects(), []);
  const chapters = useMemo(() => getChapters(), []);
  const studentResponses = useMemo(() => getResponsesByStudent(studentId), [studentId]);

  const qMap = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const sMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);
  const cMap = useMemo(() => new Map(chapters.map(c => [c.id, c.name])), [chapters]);
  const solutionsMap = useMemo(() => new Map(getAllSolutions().map(s => [s.question_id, s])), []);
  const answersMap = useMemo(() => new Map(getAllQuestionAnswers().map(a => [a.question_id, a])), []);

  // Map each question to its last error reason and confidence
  const qMetaMap = useMemo(() => {
    const map = new Map<string, { lastErrorReason: ErrorReason | null; wasConfidentWrong: boolean }>();
    studentResponses.forEach(r => {
      const existing = map.get(r.question_id);
      const isWrong = r.is_correct === false;
      const isSure = r.confidence === 'Sure';
      if (!existing || r.submitted_at) {
        map.set(r.question_id, {
          lastErrorReason: r.error_reason || existing?.lastErrorReason || null,
          wasConfidentWrong: (isWrong && isSure) || (existing?.wasConfidentWrong ?? false),
        });
      }
    });
    return map;
  }, [studentResponses]);

  // Filter items
  const now = new Date().toISOString();
  const filteredItems = useMemo(() => {
    return revisionItems.filter(item => {
      if (activeTab === 'cleared') return item.cleared;
      if (item.cleared) return false;

      if (activeTab === 'due') {
        return item.due_at <= now;
      }
      if (activeTab === 'confident_wrong') {
        const meta = qMetaMap.get(item.question_id);
        return meta?.wasConfidentWrong === true;
      }
      return true; // 'all' active
    }).sort((a, b) => {
      // Sorting rule: Basic first, then Medium, then Advanced (foundations first)
      const diffOrder: Record<string, number> = { Basic: 1, Medium: 2, Advanced: 3 };
      const qA = qMap.get(a.question_id);
      const qB = qMap.get(b.question_id);
      const orderA = qA ? (diffOrder[qA.difficulty] || 2) : 2;
      const orderB = qB ? (diffOrder[qB.difficulty] || 2) : 2;
      if (orderA !== orderB) return orderA - orderB;
      return a.due_at.localeCompare(b.due_at);
    });
  }, [revisionItems, activeTab, now, qMetaMap, qMap]);

  const handleStartReattempt = (qid: string) => {
    setReAttemptingQid(qid);
    setReAttemptAnswer('');
    setReAttemptFeedback(null);
  };

  const handleReattemptSubmit = (q: Question) => {
    if (!reAttemptAnswer.trim()) return;
    const { is_correct } = scoreResponse(q.id, reAttemptAnswer.trim(), q.type);
    recordPracticedQuestion(studentId, q.id, reAttemptAnswer.trim(), is_correct);

    if (is_correct) {
      clearRevisionItem(studentId, q.id);
      setReAttemptFeedback({
        isCorrect: true,
        msg: 'Awesome! Question answered correctly and cleared from revision.',
      });
      setTimeout(() => {
        setReAttemptingQid(null);
        window.location.reload();
      }, 1500);
    } else {
      setReAttemptFeedback({
        isCorrect: false,
        msg: 'Still incorrect. Review the step-by-step solution to master this concept.',
      });
    }
  };

  const dueCount = useMemo(() => revisionItems.filter(i => !i.cleared && i.due_at <= now).length, [revisionItems, now]);
  const activeCount = useMemo(() => revisionItems.filter(i => !i.cleared).length, [revisionItems]);
  const confidentWrongCount = useMemo(() => {
    return revisionItems.filter(i => !i.cleared && qMetaMap.get(i.question_id)?.wasConfidentWrong).length;
  }, [revisionItems, qMetaMap]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold text-emerald-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Spaced Repetition System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mistake Notebook</h1>
          <p className="text-emerald-100/90 text-sm mt-1 leading-relaxed">
            Every incorrect answer is scheduled for targeted spaced reviews at 3, 7, and 21 days.
            Solve them again to clear them from your revision queue.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveTab('due')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'due'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Due for Revision</span>
          {dueCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${activeTab === 'due' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'}`}>
              {dueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>All Mistakes</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'all' ? 'bg-white text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('confident_wrong')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'confident_wrong'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>Confidently Wrong</span>
          {confidentWrongCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${activeTab === 'confident_wrong' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'}`}>
              {confidentWrongCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cleared')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'cleared'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Cleared</span>
        </button>
      </div>

      {/* Question List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">
            {activeTab === 'due' ? 'All caught up!' : 'No questions in this section'}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {activeTab === 'due'
              ? 'No questions are due for revision right now. Keep practicing!'
              : 'Great job maintaining zero unaddressed mistakes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => {
            const q = qMap.get(item.question_id);
            if (!q) return null;
            const meta = qMetaMap.get(item.question_id);
            const isDueNow = item.due_at <= now && !item.cleared;
            const isReattempting = reAttemptingQid === q.id;
            const isSolutionOpen = openSolutionQid === q.id;
            const sol = isSolutionOpen ? (solutionsMap.get(q.id) || null) : null;
            const ans = isSolutionOpen ? (answersMap.get(q.id) || null) : null;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      {sMap.get(q.subject_id) || 'Subject'}
                    </span>
                    <span className="text-xs text-gray-600 font-medium">
                      {cMap.get(q.chapter_id) || 'Chapter'}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        q.difficulty === 'Basic'
                          ? 'bg-blue-50 text-blue-700'
                          : q.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      Stage {item.stage} of 3
                    </span>
                    {isDueNow && (
                      <span className="bg-rose-100 text-rose-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full animate-pulse">
                        Due Now
                      </span>
                    )}
                    {meta?.wasConfidentWrong && (
                      <span className="bg-red-100 text-red-800 text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Confidently Wrong
                      </span>
                    )}
                  </div>

                  {meta?.lastErrorReason && (
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      Reason: {meta.lastErrorReason}
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <div className="text-gray-900 font-medium text-base leading-relaxed">
                  <KaTeXText text={q.question_text} />
                </div>

                {/* Options (MCQ) preview if not re-attempting */}
                {q.type === 'MCQ' && q.options && !isReattempting && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      return (
                        <div key={letter} className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                          <span className="font-bold text-gray-700 shrink-0">{letter}.</span>
                          <span className="text-gray-800"><KaTeXText text={opt} /></span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Re-attempt Panel */}
                {isReattempting ? (
                  <div className="bg-emerald-50/70 border-2 border-emerald-400 rounded-2xl p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Re-attempt Question
                      </span>
                      <button
                        onClick={() => setReAttemptingQid(null)}
                        className="text-xs text-gray-500 hover:text-gray-800 font-bold"
                      >
                        Cancel
                      </button>
                    </div>

                    {q.type === 'MCQ' && q.options ? (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => setReAttemptAnswer(letter)}
                              className={`p-3 rounded-xl border-2 text-left flex items-center gap-2 font-bold text-sm transition-all ${
                                reAttemptAnswer === letter
                                  ? 'border-emerald-600 bg-white ring-2 ring-emerald-400'
                                  : 'border-gray-200 bg-white hover:border-emerald-300'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center shrink-0">
                                {letter}
                              </span>
                              <KaTeXText text={opt} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={reAttemptAnswer}
                          onChange={e => setReAttemptAnswer(e.target.value)}
                          placeholder="Enter numerical answer..."
                          className="px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono w-48 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {reAttemptFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs font-bold ${
                          reAttemptFeedback.isCorrect
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {reAttemptFeedback.msg}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleReattemptSubmit(q)}
                        disabled={!reAttemptAnswer.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
                      >
                        Submit Re-attempt
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartReattempt(q.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revise Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpenSolutionQid(isSolutionOpen ? null : q.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-colors"
                      >
                        <span>{isSolutionOpen ? 'Hide Solution' : 'View Solution'}</span>
                        {isSolutionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <span className="text-[11px] font-medium text-gray-400">
                      Next Due: {new Date(item.due_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Solution Dropdown */}
                {isSolutionOpen && sol && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="mb-2 text-xs font-bold text-gray-700">
                      Correct Answer: <strong className="text-emerald-700">{ans?.answer_text || ans?.correct_answer}</strong>
                    </div>
                    <SolutionTabs
                      solution={sol}
                      questionId={item.question_id}
                      studentId={studentId}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
