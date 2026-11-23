import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTopics,
  getChapters,
  getSubjects,
  getSyllabusTopics,
  getSyllabusChapters,
  getSyllabusSubjects,
  getQuestionsForPractice,
  insertAttempt,
  calculateMasteryStats,
} from '../../lib/db';
import { useAuth } from '../../lib/auth';
import type { DifficultyFilter, Attempt } from '../../lib/types';
import { v4 as uuid } from 'uuid';
import { ArrowLeft, Play, AlertCircle, Award, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';

export default function PracticeConfig() {
  const [params] = useSearchParams();
  const topicId = params.get('topicId') || '';
  const subjectId = params.get('subjectId') || '';
  const chapterId = params.get('chapterId') || '';

  const { user } = useAuth();
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState<DifficultyFilter>('Basic');
  const [setSize, setSetSize] = useState<number>(5);

  const topic = useMemo(() => {
    if (!topicId) return null;
    return getSyllabusTopics().find(t => t.id === topicId) || getTopics().find(t => t.id === topicId) || null;
  }, [topicId]);

  const chapter = useMemo(() => {
    if (!chapterId) return null;
    return getSyllabusChapters().find(c => c.id === chapterId) || getChapters().find(c => c.id === chapterId) || null;
  }, [chapterId]);

  const subject = useMemo(() => {
    if (!subjectId) return null;
    return getSyllabusSubjects().find(s => s.id === subjectId) || getSubjects().find(s => s.id === subjectId) || null;
  }, [subjectId]);

  // Real question counts per difficulty
  const counts = useMemo(() => {
    const targetId = topicId || chapterId;
    if (!targetId) return { Basic: 0, Medium: 0, Advanced: 0, Mixed: 0 };
    const basic = getQuestionsForPractice(targetId, 'Basic').length;
    const medium = getQuestionsForPractice(targetId, 'Medium').length;
    const advanced = getQuestionsForPractice(targetId, 'Advanced').length;
    const mixed = basic + medium + advanced;
    return { Basic: basic, Medium: medium, Advanced: advanced, Mixed: mixed };
  }, [topicId, chapterId]);

  const masteryStats = useMemo(() => {
    return user ? calculateMasteryStats(user.id, topicId || chapterId) : null;
  }, [user, topicId, chapterId]);

  // Auto switch difficulty if selected difficulty has 0 questions but others do
  React.useEffect(() => {
    if (counts[difficulty] === 0 && counts.Mixed > 0) {
      if (counts.Medium > 0) setDifficulty('Medium');
      else if (counts.Basic > 0) setDifficulty('Basic');
      else if (counts.Advanced > 0) setDifficulty('Advanced');
      else setDifficulty('Mixed');
    }
  }, [counts, difficulty]);

  const availableCount = counts[difficulty];
  const effectiveSetSize = Math.min(setSize, availableCount);

  const handleStart = () => {
    if (!user || availableCount === 0) return;

    // Create attempt
    const attempt: Attempt = {
      id: uuid(),
      student_id: user.id,
      mode: 'practice',
      subject_id: subjectId,
      chapter_id: chapterId,
      topic_id: topicId || chapterId,
      difficulty,
      set_size: effectiveSetSize,
      started_at: new Date().toISOString(),
      ended_at: null,
      score: null,
      total_marks: null,
      submit_reason: null,
      created_at: new Date().toISOString(),
    };

    insertAttempt(attempt);
    navigate(`/practice/session/${attempt.id}`);
  };

  if (!topic && !chapter) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Chapter or Topic not found.</p>
        <button
          onClick={() => navigate('/practice')}
          className="mt-4 text-blue-600 font-semibold"
        >
          Return to Practice
        </button>
      </div>
    );
  }

  const difficulties: { key: DifficultyFilter; label: string; ideal: string; desc: string }[] = [
    { key: 'Basic', label: 'Basic', ideal: '1 min', desc: 'Direct formulas, concept checks, 1-2 steps' },
    { key: 'Medium', label: 'Medium', ideal: '2 min', desc: 'Standard JEE Main level, 2-4 steps' },
    { key: 'Advanced', label: 'Advanced', ideal: '3 min', desc: 'Multi-concept, tricky traps, 4+ steps' },
    { key: 'Mixed', label: 'Mixed', ideal: 'Varies', desc: 'Balanced combination of all difficulty tiers' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/practice')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={16} /> Back to topics
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {subject?.name} · {chapter?.name}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{topic?.name || chapter?.name}</h1>
          <p className="text-sm text-gray-600 mt-1">Configure your practice session parameters.</p>
        </div>

        {/* Informational Mastery Ladder */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              Topic Mastery Ladder
            </span>
            <span className="text-xs font-extrabold text-emerald-700 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
              {masteryStats?.stepAchieved === 3
                ? 'Step 3: Advanced Mastered'
                : masteryStats?.stepAchieved === 2
                ? 'Step 2: Medium Mastered'
                : masteryStats?.stepAchieved === 1
                ? 'Step 1: Basic Mastered'
                : 'Starting Foundation'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { step: 1, label: 'Step 1: Basic', req: '>= 80% accuracy', achieved: (masteryStats?.stepAchieved ?? 0) >= 1, acc: masteryStats?.basic.accuracy },
              { step: 2, label: 'Step 2: Medium', req: '>= 80% accuracy', achieved: (masteryStats?.stepAchieved ?? 0) >= 2, acc: masteryStats?.medium.accuracy },
              { step: 3, label: 'Step 3: Advanced', req: '>= 80% accuracy', achieved: (masteryStats?.stepAchieved ?? 0) >= 3, acc: masteryStats?.advanced.accuracy },
            ].map(item => (
              <div
                key={item.step}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  item.achieved
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <div className="font-extrabold text-xs">{item.label}</div>
                <div className={`text-[10px] mt-0.5 ${item.achieved ? 'text-emerald-100' : 'text-gray-400'}`}>
                  {item.acc !== null ? `${item.acc}% achieved` : 'Not attempted'}
                </div>
              </div>
            ))}
          </div>

          {/* Advisory recommendation note */}
          {masteryStats?.advisoryMessage && (
            <div className="flex items-center gap-2 p-2.5 bg-white/90 border border-emerald-300 rounded-xl text-xs text-emerald-950">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Coach Tip:</strong> {masteryStats.advisoryMessage}
              </span>
            </div>
          )}
        </div>

        {/* Difficulty Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-800 uppercase tracking-wide">
            Select Difficulty Level
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {difficulties.map(d => {
              const count = counts[d.key];
              const selected = difficulty === d.key;
              const acc =
                d.key === 'Basic'
                  ? masteryStats?.basic.accuracy
                  : d.key === 'Medium'
                  ? masteryStats?.medium.accuracy
                  : d.key === 'Advanced'
                  ? masteryStats?.advanced.accuracy
                  : null;

              return (
                <div
                  key={d.key}
                  onClick={() => count > 0 && setDifficulty(d.key)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    count === 0
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                      : selected
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-gray-900">{d.label}</span>
                      {acc !== null && (
                        <span className="ml-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {acc}% acc
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {count} available
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">{d.desc}</p>
                  <span className="text-xs font-mono text-gray-400 mt-2 block">Ideal time: {d.ideal}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Set Size */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-800 uppercase tracking-wide">
            Practice Set Size
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => setSetSize(size)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                  setSize === size
                    ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {size} questions
              </button>
            ))}
          </div>

          {availableCount < setSize && availableCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle size={16} className="shrink-0 text-amber-600" />
              <span>
                Only {availableCount} questions available in <strong>{difficulty}</strong>. Set size will be adjusted to {availableCount}.
                (Questions are never silently filled from other levels).
              </span>
            </div>
          )}
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={availableCount === 0}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all"
        >
          <Play size={16} className="fill-current" />
          <span>Start Practice Set ({effectiveSetSize} questions)</span>
        </button>
      </div>
    </div>
  );
}

