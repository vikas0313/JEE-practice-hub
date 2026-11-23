// ============================================================
// Try-the-Shortcut Mode (Phase 3: SRD 4.3 FR-3.10)
// Re-solve questions with shortcuts. Only returns 'faster' | 'slower'.
// Zero time-per-question disclosure to the student.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getAllQuestions, getPracticedQuestions, getQuestionAnswerMonitor,
  getSolution, recordShortcutRetry, getQuestionSubject, getQuestionChapter,
} from '../../lib/db';
import type { Question, QuestionAnswer, Solution, ShortcutVerdict } from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';

export default function ShortcutRetryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [eligibleQuestions, setEligibleQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [verdict, setVerdict] = useState<ShortcutVerdict | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [currentQA, setCurrentQA] = useState<QuestionAnswer | null>(null);
  const [currentSolution, setCurrentSolution] = useState<Solution | null>(null);

  // Active time tracking for retry (kept strictly internal)
  const [activeSeconds, setActiveSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const allQ = getAllQuestions();
    const practiced = getPracticedQuestions(user.id);
    const practicedQIds = new Set(practiced.filter(pq => pq.first_answer).map(pq => pq.question_id));

    // Eligible: has a real shortcut and already practiced
    const eligible = allQ.filter(q => {
      const sol = getSolution(q.id, user.id);
      const hasShortcut = (sol && sol.shortcut && sol.shortcut.trim().length > 0) || ((q as any).shortcut && (q as any).shortcut.trim().length > 0);
      return hasShortcut && practicedQIds.has(q.id);
    });

    setEligibleQuestions(eligible);
  }, [user]);

  const currentQ = eligibleQuestions[currentIndex];

  useEffect(() => {
    if (!currentQ || isSubmitted) return;

    setActiveSeconds(0);
    const interval = setInterval(() => {
      if (!document.hidden) {
        setActiveSeconds(s => s + 1);
      }
    }, 1000);
    timerRef.current = interval;

    return () => clearInterval(interval);
  }, [currentIndex, isSubmitted, currentQ]);

  if (!user) return null;

  if (eligibleQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center mt-12">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ⚡
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Shortcut Questions Practiced Yet</h2>
        <p className="text-gray-600 mb-6">
          Practice questions in regular Practice Mode first. Questions that have verified shortcuts will become available here for speed-retry drills!
        </p>
        <button
          onClick={() => navigate('/practice')}
          className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          Go to Practice
        </button>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!selectedAnswer.trim() || !currentQ || !user) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const qa = getQuestionAnswerMonitor(currentQ.id);
    const sol = getSolution(currentQ.id, user.id);
    setCurrentQA(qa);
    setCurrentSolution(sol);

    let correct = false;
    if (qa) {
      if (currentQ.type === 'NVQ') {
        const cVal = parseFloat(qa.correct_answer);
        const sVal = parseFloat(selectedAnswer);
        correct = !isNaN(cVal) && !isNaN(sVal) && Math.abs(cVal - sVal) < 0.01;
      } else {
        correct = selectedAnswer.trim().toUpperCase() === qa.correct_answer.trim().toUpperCase();
      }
    }

    // Call server evaluation: returns verdict ('faster' | 'slower')
    const result = recordShortcutRetry(user.id, currentQ.id, selectedAnswer, correct, activeSeconds);
    setVerdict(result.verdict);
    setIsCorrect(result.is_correct);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    setIsSubmitted(false);
    setSelectedAnswer('');
    setVerdict(null);
    setIsCorrect(null);
    setCurrentQA(null);
    setCurrentSolution(null);
    if (currentIndex < eligibleQuestions.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      navigate('/practice');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Top Header Pill */}
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-full px-5 py-2.5 mb-6">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs sm:text-sm font-semibold text-emerald-900 tracking-wide uppercase">
            ⚡ Try the Shortcut • Question {currentIndex + 1} of {eligibleQuestions.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/practice')}
          className="text-xs text-emerald-800 hover:text-emerald-950 font-medium underline"
        >
          Exit Drill
        </button>
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pb-3 border-b border-gray-100">
          <span>{getQuestionSubject(currentQ)} &gt; {getQuestionChapter(currentQ)}</span>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
            {currentQ.difficulty}
          </span>
        </div>

        <div className="text-base sm:text-lg text-gray-900 font-medium leading-relaxed mb-6">
          <KaTeXText text={currentQ.question_text} />
        </div>

        {/* Options / Input */}
        {currentQ.type === 'MCQ' && currentQ.options ? (
          <div className="space-y-3 mb-6">
            {currentQ.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedAnswer === letter;
              let btnClass = 'w-full text-left p-4 rounded-xl border transition flex items-start space-x-3 ';

              if (isSubmitted) {
                const isThisCorrect = currentQA?.correct_answer.toUpperCase() === letter;
                if (isThisCorrect) {
                  btnClass += 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium';
                } else if (isSelected) {
                  btnClass += 'bg-rose-50 border-rose-300 text-rose-900';
                } else {
                  btnClass += 'bg-gray-50 border-gray-200 opacity-60';
                }
              } else {
                btnClass += isSelected
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-medium shadow-sm'
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800';
              }

              return (
                <button
                  key={idx}
                  disabled={isSubmitted}
                  onClick={() => setSelectedAnswer(letter)}
                  className={btnClass}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {letter}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <KaTeXText text={opt} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Numerical Answer</label>
            <input
              type="number"
              step="any"
              disabled={isSubmitted}
              value={selectedAnswer}
              onChange={e => setSelectedAnswer(e.target.value)}
              placeholder="Enter numerical value..."
              className="w-full sm:w-64 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}

        {/* Submit or Next */}
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer.trim()}
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            Submit with Shortcut
          </button>
        ) : (
          <div className="space-y-6 pt-4 border-t border-gray-100">
            {/* Verdict Banner */}
            <div className={`p-4 rounded-xl flex items-center justify-between ${
              verdict === 'faster' ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' : 'bg-amber-50 border border-amber-300 text-amber-900'
            }`}>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{verdict === 'faster' ? '🚀' : '⏱️'}</span>
                <div>
                  <h4 className="font-bold text-sm sm:text-base">
                    {verdict === 'faster' ? 'Faster than your baseline!' : 'Slower than your baseline'}
                  </h4>
                  <p className="text-xs opacity-90">
                    {verdict === 'faster'
                      ? 'The shortcut successfully shaved off solving time!'
                      : 'Keep practicing this shortcut to internalize the pattern.'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wider ${
                verdict === 'faster' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}>
                {verdict}
              </span>
            </div>

            {/* Shortcut Explanation */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm mb-2">
                <span>⚡ Shortcut ({currentSolution?.shortcut_type || (currentQ as any).shortcut_type || 'formula trick'})</span>
              </div>
              <div className="text-sm text-indigo-950 leading-relaxed">
                <KaTeXText text={currentSolution?.shortcut || currentSolution?.shortcut_note || (currentQ as any).shortcut || 'Apply elimination / direct formula.'} />
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-black transition shadow-sm"
            >
              {currentIndex < eligibleQuestions.length - 1 ? 'Next Question →' : 'Complete Drill →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
