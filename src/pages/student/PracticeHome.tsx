import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import {
  getSubjects,
  getChaptersBySubject,
  getTopicsByChapter,
  getVisibleQuestions,
  getResponsesByStudent,
  getTargets,
  getStudentEstimates,
  getAssignments,
  getAssignmentProgress,
  getSettings,
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  getQuestionSubject,
  getQuestionChapter,
  getQuestionTopic,
  insertAttempt,
} from '../../lib/db';
import { getStudentVisibleSyllabus, StudentVisibleSyllabusItem } from '../../lib/syllabusSecurity';
import { getTodayRecommendations } from '../../lib/adaptivePractice';
import { calculateStreakAndGoal } from '../../lib/streak';
import { useAuth } from '../../lib/auth';
import type { Question, Attempt } from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';
import {
  BookOpen,
  Layers,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
  Flame,
  Clock,
  Eye,
  EyeOff,
  ArrowUpDown,
  Award,
  FolderTree,
  Tag,
  Search,
  Hash,
  Play,
  Copy,
  Check,
  X,
} from 'lucide-react';

export default function PracticeHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [hideStreak, setHideStreak] = useState(false);

  // Targets and Projections
  const targets = useMemo(() => (user ? getTargets().filter(t => t.student_id === user.id) : []), [user]);
  const estimates = useMemo(() => (user ? getStudentEstimates(user.id) : []), [user]);
  const activeAssignments = useMemo(() => {
    if (!user) return [];
    return getAssignments(user.id).filter(a => a.status === 'active');
  }, [user]);

  // Streak & Goal
  const streakStats = useMemo(() => {
    return calculateStreakAndGoal({ studentId: user?.id });
  }, [user]);

  const settings = useMemo(() => getSettings(), [loading]);
  const todayFocus = useMemo(() => {
    if (!user || !settings.flag_e1_adaptive_repetition) return [];
    return getTodayRecommendations(user.id, 3);
  }, [user, settings.flag_e1_adaptive_repetition]);

  const subjects = useMemo(() => {
    const syl = getSyllabusSubjects();
    if (syl.length > 0) return syl;
    return getSubjects();
  }, [loading]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [sortOption, setSortOption] = useState<'accuracy_asc' | 'accuracy_desc' | 'canonical'>('accuracy_asc');

  React.useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  const allVisibleQuestions = useMemo(() => getVisibleQuestions(), [loading, user?.id, settings.flag_imported_mocks_enabled]);
  const studentResponses = useMemo(() => (user ? getResponsesByStudent(user.id) : []), [user]);

  // Load active controlled chapters visible to student
  const studentSyllabus = useMemo(() => {
    if (!selectedSubjectId) return [];
    return getStudentVisibleSyllabus(selectedSubjectId);
  }, [selectedSubjectId]);

  // Compute question counts and student accuracy for each chapter
  const chaptersWithStats = useMemo(() => {
    return studentSyllabus.map(ch => {
      const qInChapter = allVisibleQuestions.filter(
        q => q.primary_chapter_id === ch.chapter_id || q.chapter_id === ch.chapter_id
      );

      const qIds = new Set(qInChapter.map(q => q.id));
      const respInChapter = studentResponses.filter(
        r => qIds.has(r.question_id) && r.submitted_at !== null
      );

      const attempted = respInChapter.length;
      const correct = respInChapter.filter(r => r.is_correct).length;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

      const basicCount = qInChapter.filter(q => q.difficulty === 'Basic').length;
      const mediumCount = qInChapter.filter(q => q.difficulty === 'Medium').length;
      const advancedCount = qInChapter.filter(q => q.difficulty === 'Advanced').length;

      return {
        ...ch,
        totalQuestions: qInChapter.length,
        basicCount,
        mediumCount,
        advancedCount,
        attempted,
        correct,
        accuracy,
      };
    });
  }, [studentSyllabus, allVisibleQuestions, studentResponses]);

  const [showAllSyllabus, setShowAllSyllabus] = useState<boolean>(true);
  const [viewGroupByUnit, setViewGroupByUnit] = useState<boolean>(true);

  // CHAPTER FILTERING & SORTING
  const sortedChapters = useMemo(() => {
    const list = showAllSyllabus
      ? [...chaptersWithStats]
      : [...chaptersWithStats.filter(c => c.totalQuestions > 0)];
    if (sortOption === 'accuracy_asc') {
      // Unattempted first, then lowest accuracy to highest
      return list.sort((a, b) => {
        if (a.accuracy === null && b.accuracy === null) return a.chapter_sort_order - b.chapter_sort_order;
        if (a.accuracy === null) return -1;
        if (b.accuracy === null) return 1;
        return a.accuracy - b.accuracy;
      });
    } else if (sortOption === 'accuracy_desc') {
      return list.sort((a, b) => {
        if (a.accuracy === null && b.accuracy === null) return a.chapter_sort_order - b.chapter_sort_order;
        if (a.accuracy === null) return 1;
        if (b.accuracy === null) return -1;
        return b.accuracy - a.accuracy;
      });
    } else {
      // Canonical order
      return list.sort((a, b) => a.chapter_sort_order - b.chapter_sort_order);
    }
  }, [chaptersWithStats, showAllSyllabus, sortOption]);

  // Group chapters by syllabus group
  const groupedChapters = useMemo(() => {
    const map = new Map<string, typeof sortedChapters>();
    for (const c of sortedChapters) {
      const g = c.group_name || 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return Array.from(map.entries()).map(([groupName, chs]) => ({
      groupName,
      chapters: chs,
      totalQuestions: chs.reduce((sum, ch) => sum + ch.totalQuestions, 0),
    }));
  }, [sortedChapters]);

  // Auto select first chapter if none selected (prefer chapter with questions)
  React.useEffect(() => {
    if (sortedChapters.length > 0 && (!selectedChapterId || !sortedChapters.some(c => c.chapter_id === selectedChapterId))) {
      const withQ = sortedChapters.find(c => c.totalQuestions > 0);
      setSelectedChapterId(withQ ? withQ.chapter_id : sortedChapters[0].chapter_id);
    }
  }, [sortedChapters, selectedChapterId]);

  const activeChapter = useMemo(() => {
    return sortedChapters.find(c => c.chapter_id === selectedChapterId) || sortedChapters[0] || null;
  }, [sortedChapters, selectedChapterId]);

  const chapterTopics = useMemo(() => {
    return activeChapter?.topics || [];
  }, [activeChapter]);

  // Topic metrics
  const topicStats = useMemo(() => {
    const stats: Record<string, { total: number; basic: number; medium: number; advanced: number; attempted: number; correct: number }> = {};
    for (const t of chapterTopics) {
      const qInTopic = allVisibleQuestions.filter(
        q => q.primary_topic_id === t.topic_id || q.topic_id === t.topic_id
      );
      const qIds = new Set(qInTopic.map(q => q.id));
      const respInTopic = studentResponses.filter(r => qIds.has(r.question_id) && r.submitted_at !== null);

      stats[t.topic_id] = {
        total: qInTopic.length,
        basic: qInTopic.filter(q => q.difficulty === 'Basic').length,
        medium: qInTopic.filter(q => q.difficulty === 'Medium').length,
        advanced: qInTopic.filter(q => q.difficulty === 'Advanced').length,
        attempted: respInTopic.length,
        correct: respInTopic.filter(r => r.is_correct).length,
      };
    }
    return stats;
  }, [chapterTopics, allVisibleQuestions, studentResponses]);

  const handleSelectTopic = (topicId: string) => {
    navigate(`/practice/config?topicId=${topicId}&subjectId=${selectedSubjectId}&chapterId=${selectedChapterId}`);
  };

  const handleSelectChapterDirect = (chId: string) => {
    navigate(`/practice/config?chapterId=${chId}&subjectId=${selectedSubjectId}`);
  };

  // Question ID Search State
  const [questionIdQuery, setQuestionIdQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchedQuestions = useMemo(() => {
    if (!questionIdQuery.trim()) return [];
    const qLower = questionIdQuery.trim().toLowerCase();
    return allVisibleQuestions
      .filter(item => item.id.toLowerCase().includes(qLower) || item.number.toString() === qLower)
      .slice(0, 10);
  }, [questionIdQuery, allVisibleQuestions]);

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePracticeSingleQuestion = (question: Question) => {
    if (!user) return;
    const attemptId = uuid();
    const newAttempt: Attempt = {
      id: attemptId,
      student_id: user.id,
      mode: 'practice',
      subject_id: question.subject_id,
      chapter_id: question.primary_chapter_id || question.chapter_id,
      topic_id: question.primary_topic_id || question.topic_id || question.id,
      difficulty: question.difficulty,
      set_size: 1,
      started_at: new Date().toISOString(),
      ended_at: null,
      score: null,
      total_marks: 4,
      submit_reason: null,
      created_at: new Date().toISOString(),
    };
    (newAttempt as any).question_id = question.id;
    insertAttempt(newAttempt);
    navigate(`/practice/session/${attemptId}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Topic-wise PYQ Practice</h1>
        <p className="text-sm text-gray-600 mt-1">
          Select Subject, Chapter, and Topic to begin targeted JEE Main practice.
        </p>
      </div>

      {/* Question ID Direct Search Section */}
      <div className="bg-white rounded-2xl border border-indigo-100 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Hash size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Question ID Search</h2>
              <p className="text-xs text-gray-500">
                Directly jump to and practice any JEE question by typing its Question ID or code.
              </p>
            </div>
          </div>
          {questionIdQuery && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              {searchedQuestions.length} match{searchedQuestions.length === 1 ? '' : 'es'} found
            </span>
          )}
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            value={questionIdQuery}
            onChange={(e) => setQuestionIdQuery(e.target.value)}
            placeholder="Enter Question ID (e.g. JEE_MAIN_2026_JAN_PHY_01, Q_001, 1001)..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50/60 hover:bg-white focus:bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
          {questionIdQuery && (
            <button
              type="button"
              onClick={() => setQuestionIdQuery('')}
              className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Search Results Display */}
        {questionIdQuery.trim() !== '' && (
          <div className="space-y-3 pt-1">
            {searchedQuestions.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-sm font-medium text-gray-600">
                  No questions found matching ID &ldquo;{questionIdQuery}&rdquo;
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Try searching with partial keywords like &ldquo;2026&rdquo;, &ldquo;PHY&rdquo;, or &ldquo;Q_&rdquo;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-1">
                {searchedQuestions.map(q => {
                  const subName = getQuestionSubject(q);
                  const chapName = getQuestionChapter(q);
                  const topName = getQuestionTopic(q);

                  return (
                    <div
                      key={q.id}
                      className="p-4 bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shadow-2xs space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md select-all">
                            ID: {q.id}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(q.id, e)}
                            className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition"
                            title="Copy ID"
                          >
                            {copiedId === q.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {subName} • {chapName}
                          </span>
                          {topName && (
                            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                              {topName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            q.difficulty === 'Basic'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : q.difficulty === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {q.difficulty}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {q.type}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-800 line-clamp-2 leading-relaxed">
                        <KaTeXText text={q.question_text} />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handlePracticeSingleQuestion(q)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition"
                        >
                          <Play size={13} />
                          Practice This Question
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module E1: Today's Focus (Recommended - Capped strictly at 3 items) */}
      {settings.flag_e1_adaptive_repetition && todayFocus.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">Today&rsquo;s Focus (Recommended)</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
              {todayFocus.length} questions
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Selected from your scheduled spaced reviews, mistakes, and syllabus weightage. Solve at your own pace.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {todayFocus.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-indigo-700 uppercase text-[10px] tracking-wider">
                      {item.subject_name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.reason_badge === 'Review due'
                          ? 'bg-amber-100 text-amber-800'
                          : item.reason_badge === 'Mistake review'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.reason_badge}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-800 line-clamp-1">{item.chapter_name}</h4>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/practice/config?questionId=${item.question_id}`)}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
                >
                  Practice Question
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 3: Goals, Projections & Streak Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target Goal & Projection */}
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-200 flex items-center gap-1.5">
              <Target size={14} /> Target Goal
            </span>
            {streakStats.nearestTarget && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-indigo-100 flex items-center gap-1">
                <Clock size={12} /> {streakStats.nearestTarget.daysRemaining} days left
              </span>
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold">
              {targets[0]?.name || '99th Percentile Target'}
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Target: {targets[0]?.target_value ?? 99.0} {targets[0]?.target_type === 'percentile' ? '%ile' : ''}
            </p>
          </div>

          <div className="pt-2 border-t border-indigo-700/60">
            <span className="text-[11px] text-indigo-200 block">Projected Chance:</span>
            {(() => {
              const est = estimates.find(e => targets[0] && e.target_id === targets[0].id);
              if (!est || (est.projected_range_low === null && !est.coarse_band)) {
                return <span className="text-sm font-semibold text-indigo-100">Not enough data yet</span>;
              }
              if (est.display_mode === 'band' || est.projected_range_low === null) {
                return (
                  <span className="text-base font-extrabold text-white">
                    {est.coarse_band || 'Not enough data yet'}
                  </span>
                );
              }
              return (
                <span className="text-base font-extrabold text-white">
                  {est.projected_range_low} – {est.projected_range_high} %ile
                </span>
              );
            })()}
          </div>
        </div>

        {/* Daily Goal & Streak */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">Daily Target</span>
            <button
              onClick={() => setHideStreak(!hideStreak)}
              className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1"
              title="Toggle streak visibility"
            >
              {hideStreak ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold text-gray-900">{streakStats.todayCount}</span>
              <span className="text-sm text-gray-500 font-medium"> / {streakStats.dailyGoal} questions</span>
            </div>
            {!hideStreak && (
              <div className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Flame size={15} /> {streakStats.currentStreakDays}-day streak
              </div>
            )}
          </div>

          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${streakStats.todayGoalMet ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(100, Math.round((streakStats.todayCount / streakStats.dailyGoal) * 100))}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            {streakStats.todayGoalMet ? '🎉 Daily goal reached today!' : `${streakStats.dailyGoal - streakStats.todayCount} more questions to maintain streak.`}
          </p>
        </div>

        {/* Shortcut Retry Launcher */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <Zap size={15} className="text-emerald-600" /> Speed Reinforcement
            </div>
            <h3 className="text-base font-bold text-emerald-950 mt-1">Try the Shortcut</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Re-solve questions with verified shortcuts to test if you solve faster than your baseline.
            </p>
          </div>

          <button
            onClick={() => navigate('/practice/shortcut-retry')}
            className="w-full mt-3 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition flex items-center justify-center gap-1"
          >
            Launch Shortcut Drill →
          </button>
        </div>
      </div>

      {/* Active Assignments Widget */}
      {activeAssignments.length > 0 && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-blue-600" /> Active Assignments ({activeAssignments.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeAssignments.map(a => {
              const prog = getAssignmentProgress(a.id);
              const pct = Math.min(100, Math.round((prog.completedCount / a.target_count) * 100));

              return (
                <div key={a.id} className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-gray-900 text-sm">{a.title}</span>
                    <span className="text-[11px] font-semibold text-blue-700">
                      {prog.completedCount} / {a.target_count}
                    </span>
                  </div>
                  <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 flex justify-between">
                    <span>Due: {new Date(a.due_date).toLocaleDateString()}</span>
                    <span>{a.subject || 'All Subjects'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subject Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-1">
        {subjects.map(s => {
          const active = s.id === selectedSubjectId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSubjectId(s.id)}
              className={`px-5 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                active
                  ? 'border-blue-700 text-blue-700 bg-white shadow-sm'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Chapter Selection & Sort Controls */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                Syllabus Chapters ({sortedChapters.length} {showAllSyllabus ? 'total in curriculum' : 'with questions'})
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                {chaptersWithStats.reduce((sum, c) => sum + c.totalQuestions, 0)} verified PYQs
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Official NTA JEE Main chapter structure. Select any chapter to inspect topics and practice.
            </p>
          </div>

          {/* Controls: Filter All vs With Questions, Grouping, and Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowAllSyllabus(true)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  showAllSyllabus ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Chapters ({chaptersWithStats.length})
              </button>
              <button
                type="button"
                onClick={() => setShowAllSyllabus(false)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  !showAllSyllabus ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                With Questions ({chaptersWithStats.filter(c => c.totalQuestions > 0).length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewGroupByUnit(!viewGroupByUnit)}
              className={`p-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewGroupByUnit ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
              }`}
              title="Toggle Grouped by Unit"
            >
              <Layers size={13} />
              <span>{viewGroupByUnit ? 'Grouped' : 'Flat'}</span>
            </button>

            <div className="flex items-center gap-1">
              <ArrowUpDown size={13} className="text-gray-400" />
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as any)}
                className="p-1 border border-gray-300 rounded-lg bg-gray-50 text-xs font-medium"
              >
                <option value="accuracy_asc">Weak Areas First</option>
                <option value="accuracy_desc">Accuracy: High to Low</option>
                <option value="canonical">Syllabus Canonical</option>
              </select>
            </div>

            <Link
              to="/syllabus"
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 ml-1"
            >
              <FolderTree size={13} /> Full Syllabus Tree →
            </Link>
          </div>
        </div>

        {/* Chapters list: Grouped or Flat */}
        {sortedChapters.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-3">
            No chapters match current filter. Switch to "All Chapters" to browse the complete syllabus.
          </p>
        ) : viewGroupByUnit ? (
          <div className="space-y-3 pt-1">
            {groupedChapters.map(({ groupName, chapters: chs, totalQuestions }) => (
              <div key={groupName} className="p-3 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={12} className="text-blue-600" />
                    {groupName} ({chs.length} chapters)
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {totalQuestions} questions
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chs.map(c => {
                    const active = c.chapter_id === selectedChapterId;
                    return (
                      <button
                        key={c.chapter_id}
                        type="button"
                        onClick={() => setSelectedChapterId(c.chapter_id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                            : c.totalQuestions > 0
                            ? 'bg-white border border-blue-200 text-blue-900 hover:bg-blue-50'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{c.external_id ? `${c.external_id} ` : ''}{c.chapter_name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-white/20 text-white'
                              : c.totalQuestions > 0
                              ? 'bg-blue-100 text-blue-800 font-bold'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {c.totalQuestions}Q
                          {c.accuracy !== null ? ` · ${c.accuracy}%` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedChapters.map(c => {
              const active = c.chapter_id === selectedChapterId;
              return (
                <button
                  key={c.chapter_id}
                  type="button"
                  onClick={() => setSelectedChapterId(c.chapter_id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : c.totalQuestions > 0
                      ? 'bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{c.external_id ? `${c.external_id} ` : ''}{c.chapter_name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : c.totalQuestions > 0 ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {c.totalQuestions}Q
                    {c.accuracy !== null ? ` · ${c.accuracy}%` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Topics List or Direct Chapter Practice */}
      {activeChapter && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              {activeChapter.chapter_name}
              {activeChapter.accuracy !== null && (
                <span className="ml-2 font-normal text-xs text-green-700">
                  (Overall Accuracy: {activeChapter.accuracy}%)
                </span>
              )}
            </h2>

            {/* Launch Whole Chapter Practice button */}
            {activeChapter.totalQuestions > 0 ? (
              <button
                type="button"
                onClick={() => handleSelectChapterDirect(activeChapter.chapter_id)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <BookOpen size={13} />
                Practice Full Chapter ({activeChapter.totalQuestions}Q)
              </button>
            ) : (
              <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-400 font-medium rounded-lg border border-gray-200 flex items-center gap-1.5">
                <BookOpen size={13} />
                0 Questions in Chapter
              </span>
            )}
          </div>

          {activeChapter.totalQuestions === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {activeChapter.external_id && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {activeChapter.external_id}
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 text-base">{activeChapter.chapter_name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Group: <span className="font-semibold text-gray-700">{activeChapter.group_name}</span> · Status: <span className="font-semibold text-emerald-700">Official NTA JEE Main Syllabus</span>
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  Verification in progress
                </span>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-2">
                <p className="font-semibold">
                  This chapter is part of the official NTA JEE Main curriculum. 0 questions are loaded in this chapter yet.
                </p>
                <p className="text-blue-700">
                  Ready chapters with verified PYQs include:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {chaptersWithStats.filter(c => c.totalQuestions > 0).map(c => (
                    <button
                      key={c.chapter_id}
                      type="button"
                      onClick={() => setSelectedChapterId(c.chapter_id)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 font-bold rounded-lg border border-blue-200 transition-colors text-[11px]"
                    >
                      {c.chapter_name} ({c.totalQuestions}Q) →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : chapterTopics.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{activeChapter.chapter_name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  General practice set across all questions in this canonical chapter.
                </p>
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium border border-blue-100">
                    Total: {activeChapter.totalQuestions}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-medium">
                    Basic: {activeChapter.basicCount}
                  </span>
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                    Medium: {activeChapter.mediumCount}
                  </span>
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">
                    Advanced: {activeChapter.advancedCount}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectChapterDirect(activeChapter.chapter_id)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 whitespace-nowrap"
              >
                Start Chapter Practice <ChevronRight size={15} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapterTopics.map(t => {
                const stat = topicStats[t.topic_id] || {
                  total: 0,
                  basic: 0,
                  medium: 0,
                  advanced: 0,
                  attempted: 0,
                  correct: 0,
                };
                const accuracy = stat.attempted > 0 ? Math.round((stat.correct / stat.attempted) * 100) : null;

                return (
                  <div
                    key={t.topic_id}
                    onClick={() => stat.total > 0 && handleSelectTopic(t.topic_id)}
                    className={`bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                      stat.total > 0
                        ? 'hover:border-blue-400 hover:shadow-md cursor-pointer'
                        : 'opacity-60 cursor-not-allowed bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-gray-900 text-base">{t.topic_name}</h3>
                        {accuracy !== null && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 size={12} />
                            {accuracy}% accuracy
                          </span>
                        )}
                      </div>

                      {/* Breakdown */}
                      <div className="flex flex-wrap gap-2 mt-3 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium border border-blue-100">
                          Total: {stat.total}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-medium">
                          Basic: {stat.basic}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                          Medium: {stat.medium}
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">
                          Advanced: {stat.advanced}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                      <span className="text-xs text-gray-500">
                        {stat.attempted} attempted
                      </span>
                      {stat.total > 0 ? (
                        <span className="text-blue-600 font-semibold flex items-center gap-1 text-xs hover:translate-x-0.5 transition-transform">
                          Start practice <ChevronRight size={14} />
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No questions available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

