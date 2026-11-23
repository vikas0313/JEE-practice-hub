import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getExam,
  insertExam,
  updateExam,
  setExamQuestions,
  getExamQuestions,
  getPatternProfiles,
  getSubjects,
  getChapters,
  getPracticedQuestionsForExam,
  getEligibleQuestionsForExam,
  getExamQuestionFreshFlags,
  setExamQuestionFreshFlags,
  getStudentProfile,
  getAllQuestions,
  getSettings,
} from '../../lib/db';
import type { Exam, Question, PatternProfile } from '../../lib/types';
import { autoComposeExamDraft } from '../../lib/examAutoComposer';
import { v4 as uuid } from 'uuid';
import { KaTeXText } from '../../lib/katex-render';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Sparkles,
  Lock,
  Bookmark,
} from 'lucide-react';

export default function TestBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const student = useMemo(() => getStudentProfile(), []);
  const studentId = student?.id || '';

  const patternProfiles = useMemo(() => getPatternProfiles(), []);
  const subjects = useMemo(() => getSubjects(), []);
  const chapters = useMemo(() => getChapters(), []);

  // Existing exam if editing
  const existingExam = useMemo(() => (id ? getExam(id) : null), [id]);

  // Form states
  const settings = useMemo(() => getSettings(), []);
  const [name, setName] = useState('');
  const [autoComposeNotices, setAutoComposeNotices] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(0);
  const [marksCorrectMcq, setMarksCorrectMcq] = useState(4);
  const [marksWrongMcq, setMarksWrongMcq] = useState(-1);
  const [marksCorrectNvq, setMarksCorrectNvq] = useState(4);
  const [marksWrongNvq, setMarksWrongNvq] = useState(0);
  const [marksUnattempted, setMarksUnattempted] = useState(0);
  const [isTemplate, setIsTemplate] = useState(false);
  const [allowFreshQuestions, setAllowFreshQuestions] = useState(false);
  const [freshQuestionSharePct, setFreshQuestionSharePct] = useState(30);

  // Selected questions: array of { questionId, subjectId, chapterId, section: 'A' | 'B' }
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Filter UI for question selection
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterChapterId, setFilterChapterId] = useState<string>('');

  // Questions pool for this student (supports fresh questions when allowed)
  const practisedPool = useMemo(() => {
    return getEligibleQuestionsForExam(studentId, allowFreshQuestions);
  }, [studentId, allowFreshQuestions]);

  // Map of question ID to fresh status
  const freshMap = useMemo(() => {
    const map = new Map<string, boolean>();
    practisedPool.forEach(q => map.set(q.id, q.is_fresh));
    return map;
  }, [practisedPool]);

  // Count of fresh questions currently selected
  const freshSelectedCount = useMemo(() => {
    let count = 0;
    selectedQuestionIds.forEach(qid => {
      if (freshMap.get(qid)) count++;
    });
    return count;
  }, [selectedQuestionIds, freshMap]);

  // Maximum allowed fresh questions based on quota
  const maxFreshAllowed = useMemo(() => {
    if (!allowFreshQuestions) return 0;
    return Math.floor(selectedQuestionIds.size * (freshQuestionSharePct / 100));
  }, [selectedQuestionIds.size, allowFreshQuestions, freshQuestionSharePct]);

  // Filtered pool based on subject and chapter
  const displayPool = useMemo(() => {
    return practisedPool.filter(q => {
      if (filterSubjectId && q.subject_id !== filterSubjectId) return false;
      if (filterChapterId && q.chapter_id !== filterChapterId) return false;
      return true;
    });
  }, [practisedPool, filterSubjectId, filterChapterId]);

  // Map of chapter ID to question count (quota capping)
  const chapterPractisedCounts = useMemo(() => {
    const counts: Record<string, { total: number; mcq: number; nvq: number }> = {};
    practisedPool.forEach(q => {
      if (!counts[q.chapter_id]) counts[q.chapter_id] = { total: 0, mcq: 0, nvq: 0 };
      counts[q.chapter_id].total++;
      if (q.type === 'MCQ') counts[q.chapter_id].mcq++;
      else counts[q.chapter_id].nvq++;
    });
    return counts;
  }, [practisedPool]);

  // Populate from existing exam if editing
  useEffect(() => {
    if (existingExam) {
      setName(existingExam.name);
      setSelectedProfileId(existingExam.pattern_profile_id || '');
      setDurationMinutes(existingExam.duration_minutes);
      setGracePeriodSeconds(existingExam.grace_period_seconds);
      setMarksCorrectMcq(existingExam.marks_correct_mcq);
      setMarksWrongMcq(existingExam.marks_wrong_mcq);
      setMarksCorrectNvq(existingExam.marks_correct_nvq);
      setMarksWrongNvq(existingExam.marks_wrong_nvq);
      setMarksUnattempted(existingExam.marks_unattempted);
      setIsTemplate(existingExam.is_template);
      setAllowFreshQuestions(existingExam.allow_fresh_questions ?? false);
      setFreshQuestionSharePct(existingExam.fresh_question_share_pct ?? 30);

      const existingEqs = getExamQuestions(existingExam.id);
      setSelectedQuestionIds(new Set(existingEqs.map(eq => eq.question_id)));
    } else if (patternProfiles.length > 0) {
      const p = patternProfiles[0];
      setSelectedProfileId(p.id);
      setDurationMinutes(p.duration_minutes);
      setMarksCorrectMcq(p.marks_correct_mcq);
      setMarksWrongMcq(p.marks_wrong_mcq);
      setMarksCorrectNvq(p.marks_correct_nvq);
      setMarksWrongNvq(p.marks_wrong_nvq);
      setMarksUnattempted(p.marks_unattempted);
    }
  }, [existingExam, patternProfiles]);

  const handleProfileChange = (pId: string) => {
    setSelectedProfileId(pId);
    const p = patternProfiles.find(x => x.id === pId);
    if (p) {
      setDurationMinutes(p.duration_minutes);
      setMarksCorrectMcq(p.marks_correct_mcq);
      setMarksWrongMcq(p.marks_wrong_mcq);
      setMarksCorrectNvq(p.marks_correct_nvq);
      setMarksWrongNvq(p.marks_wrong_nvq);
      setMarksUnattempted(p.marks_unattempted);
    }
  };

  const toggleQuestionSelection = (qid: string) => {
    if (existingExam?.status === 'published') return;
    const next = new Set(selectedQuestionIds);
    if (next.has(qid)) {
      next.delete(qid);
    } else {
      next.add(qid);
    }
    setSelectedQuestionIds(next);
  };

  const handleSelectAllInChapter = (chapId: string) => {
    if (existingExam?.status === 'published') return;
    const next = new Set(selectedQuestionIds);
    const qsInChap = practisedPool.filter(q => q.chapter_id === chapId);
    qsInChap.forEach(q => next.add(q.id));
    setSelectedQuestionIds(next);
  };

  const handleDeselectAllInChapter = (chapId: string) => {
    if (existingExam?.status === 'published') return;
    const next = new Set(selectedQuestionIds);
    const qsInChap = practisedPool.filter(q => q.chapter_id === chapId);
    qsInChap.forEach(q => next.delete(q.id));
    setSelectedQuestionIds(next);
  };

  const handleAutoComposeDraft = () => {
    const allQuestions = getAllQuestions();
    const result = autoComposeExamDraft(
      {
        exam_name: name.trim() || `JEE Main Balanced Mock Draft ${new Date().toLocaleDateString()}`,
        duration_minutes: durationMinutes,
        allow_fresh_questions: allowFreshQuestions,
        fresh_question_share_pct: freshQuestionSharePct,
      },
      allQuestions,
      subjects,
      chapters
    );

    if (!name.trim()) {
      setName(result.exam.name);
    }
    const qIds = new Set(result.exam_questions.map((eq) => eq.question_id));
    setSelectedQuestionIds(qIds);
    setAutoComposeNotices(result.unfulfilled_notices);
  };

  const handleSave = (publish = false) => {
    if (!name.trim()) {
      alert('Please enter an exam name.');
      return;
    }
    if (selectedQuestionIds.size === 0) {
      alert('Please select at least one question from the pool.');
      return;
    }

    if (allowFreshQuestions && freshSelectedCount > maxFreshAllowed) {
      alert(`Selected fresh questions (${freshSelectedCount}) exceed the configured maximum share of ${freshQuestionSharePct}% (${maxFreshAllowed} allowed for ${selectedQuestionIds.size} total questions).`);
      return;
    }

    const examId = existingExam ? existingExam.id : uuid();
    const qMap = new Map(getAllQuestions().map(q => [q.id, q]));

    // Format exam questions list: Section A for MCQs, Section B for NVQs
    const questionsList = Array.from(selectedQuestionIds).map(qid => {
      const q = qMap.get(qid)!;
      return {
        questionId: qid,
        subjectId: q.subject_id,
        chapterId: q.chapter_id,
        section: (q.type === 'NVQ' ? 'B' : 'A') as 'A' | 'B',
      };
    });

    const examData: Exam = {
      id: examId,
      name: name.trim(),
      pattern_profile_id: selectedProfileId || null,
      duration_minutes: Number(durationMinutes),
      grace_period_seconds: Math.min(10, Math.max(0, Number(gracePeriodSeconds))),
      start_window_start: null,
      start_window_end: null,
      status: publish ? 'published' : 'draft',
      is_template: isTemplate,
      copy_of_id: existingExam?.copy_of_id || null,
      marks_correct_mcq: Number(marksCorrectMcq),
      marks_wrong_mcq: Number(marksWrongMcq),
      marks_correct_nvq: Number(marksCorrectNvq),
      marks_wrong_nvq: Number(marksWrongNvq),
      marks_unattempted: Number(marksUnattempted),
      total_questions: questionsList.length,
      max_marks: questionsList.length * 4,
      allow_fresh_questions: allowFreshQuestions,
      fresh_question_share_pct: Number(freshQuestionSharePct),
      created_by: null,
      created_at: existingExam?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingExam) {
      setExamQuestions(examId, questionsList);
      updateExam(examId, examData);
    } else {
      insertExam(examData);
      setExamQuestions(examId, questionsList);
    }

    // Update monitor fresh question flags
    const freshIds = Array.from(selectedQuestionIds).filter(qid => freshMap.get(qid));
    setExamQuestionFreshFlags(examId, freshIds);

    navigate('/monitor/exams');
  };

  const selectedCount = selectedQuestionIds.size;
  const isPublished = existingExam?.status === 'published';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/monitor/exams"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Exam List
        </Link>
        {isPublished && (
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Published Exam (Immutable)</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            {isPublished ? 'View Exam' : existingExam ? 'Edit Exam Draft' : 'Build Custom Exam'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Questions are strictly selected from questions the student has already practised.
          </p>
        </div>

        {/* Module E7: Auto-Compose Exam Draft Card */}
        {settings.flag_e7_exam_auto_composer && !isPublished && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-md tracking-wider uppercase">
                    Module E7
                  </span>
                  <h3 className="text-sm font-bold text-indigo-950">Auto-Compose Balanced Exam Draft</h3>
                </div>
                <p className="text-xs text-indigo-800/80 mt-1">
                  Automatically pulls 75 questions matching official NTA distribution (20 MCQ Section A + 5 NVQ Section B for Physics, Chemistry, and Math).
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoComposeDraft}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
              >
                <Sparkles size={14} />
                <span>Auto-Compose Draft</span>
              </button>
            </div>

            {autoComposeNotices.length > 0 && (
              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-xs space-y-1 text-amber-800">
                <span className="font-bold flex items-center gap-1">
                  <AlertCircle size={13} className="text-amber-600" />
                  Composition Notices:
                </span>
                {autoComposeNotices.map((n, idx) => (
                  <p key={idx} className="pl-4 text-[11px] text-gray-700">
                    • {n}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 1: Basic Settings & Pattern Profile */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. Exam Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Exam Name *
              </label>
              <input
                type="text"
                required
                disabled={isPublished}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Mechanics & Calculus Full Mock 1"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Base Pattern Profile
              </label>
              <select
                disabled={isPublished}
                value={selectedProfileId}
                onChange={e => handleProfileChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
              >
                <option value="">Custom Pattern</option>
                {patternProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.duration_minutes} Mins · {p.marks_correct_mcq}/{p.marks_wrong_mcq})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Duration (Mins)</label>
              <input
                type="number"
                min="1"
                disabled={isPublished}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Grace Period (Sec)</label>
              <input
                type="number"
                min="0"
                max="10"
                disabled={isPublished}
                value={gracePeriodSeconds}
                onChange={e => setGracePeriodSeconds(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
              <span className="text-[10px] text-gray-400">0s = instant auto-submit</span>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">MCQ Marking</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={isPublished}
                  value={marksCorrectMcq}
                  onChange={e => setMarksCorrectMcq(Number(e.target.value))}
                  className="w-1/2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-emerald-700 font-bold"
                />
                <input
                  type="number"
                  disabled={isPublished}
                  value={marksWrongMcq}
                  onChange={e => setMarksWrongMcq(Number(e.target.value))}
                  className="w-1/2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-rose-700 font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">NVQ Marking</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={isPublished}
                  value={marksCorrectNvq}
                  onChange={e => setMarksCorrectNvq(Number(e.target.value))}
                  className="w-1/2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-emerald-700 font-bold"
                />
                <input
                  type="number"
                  disabled={isPublished}
                  value={marksWrongNvq}
                  onChange={e => setMarksWrongNvq(Number(e.target.value))}
                  className="w-1/2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-rose-700 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Phase 6 M1: Fresh Questions Configuration */}
          <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-purple-950">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={allowFreshQuestions}
                    onChange={e => setAllowFreshQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Allow Unpractised (Fresh) Questions</span>
                </label>
                <p className="text-xs text-purple-800 mt-0.5">
                  Include published questions the student has never answered. Student sees no fresh indicator.
                </p>
              </div>
              {allowFreshQuestions && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-purple-900">Max Share:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={isPublished}
                    value={freshQuestionSharePct}
                    onChange={e => setFreshQuestionSharePct(Math.min(100, Math.max(1, Number(e.target.value))))}
                    className="w-16 px-2.5 py-1 border border-purple-300 rounded-lg text-xs font-bold text-center bg-white"
                  />
                  <span className="text-xs font-bold text-purple-900">%</span>
                </div>
              )}
            </div>

            {allowFreshQuestions && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-purple-900 border-t border-purple-200/60 pt-2 gap-1">
                <span>
                  Fresh Questions Selected: <strong>{freshSelectedCount}</strong> / <strong>{maxFreshAllowed}</strong> max ({freshQuestionSharePct}% of {selectedCount} questions)
                </span>
                {freshSelectedCount > maxFreshAllowed && (
                  <span className="text-rose-600 font-bold">Quota exceeded! Reduce fresh questions.</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Practised Question Selector & Quota Capping */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                2. Select From Practised Questions ({selectedCount} Selected)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Total Practised Questions Available in Bank: <strong>{practisedPool.length}</strong>
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <select
                value={filterSubjectId}
                onChange={e => { setFilterSubjectId(e.target.value); setFilterChapterId(''); }}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs bg-white"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select
                value={filterChapterId}
                onChange={e => setFilterChapterId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs bg-white"
              >
                <option value="">All Chapters</option>
                {chapters
                  .filter(c => !filterSubjectId || c.subject_id === filterSubjectId)
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Chapter Quota Overview Pills */}
          <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 block">
              Chapter Practised Pool Quotas (Cannot exceed practised questions)
            </span>
            <div className="flex flex-wrap gap-2">
              {chapters
                .filter(c => chapterPractisedCounts[c.id]?.total > 0)
                .map(c => {
                  const quota = chapterPractisedCounts[c.id];
                  const qsInChap = practisedPool.filter(q => q.chapter_id === c.id);
                  const selectedInChap = qsInChap.filter(q => selectedQuestionIds.has(q.id)).length;
                  const isAllSelected = selectedInChap === quota.total;

                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-xs"
                    >
                      <span className="font-semibold text-gray-800">{c.name}:</span>
                      <span className={`font-bold ${selectedInChap > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {selectedInChap} / {quota.total}
                      </span>
                      {!isPublished && (
                        <button
                          type="button"
                          onClick={() => isAllSelected ? handleDeselectAllInChapter(c.id) : handleSelectAllInChapter(c.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
                        >
                          {isAllSelected ? 'Clear' : 'Select All'}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Questions Selection Grid */}
          {displayPool.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center text-gray-500 text-sm">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No practised questions found matching this filter.</p>
              <p className="text-xs text-gray-400 mt-1">
                The student must first practice questions in Practice mode before they appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {displayPool.map((q, idx) => {
                const isSelected = selectedQuestionIds.has(q.id);

                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestionSelection(q.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      disabled={isPublished}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {q.type} · Section {q.type === 'NVQ' ? 'B' : 'A'}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          q.difficulty === 'Basic'
                            ? 'bg-blue-100 text-blue-800'
                            : q.difficulty === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {q.difficulty}
                        </span>
                        <span className="text-xs text-gray-500">
                          {chapters.find(c => c.id === q.chapter_id)?.name}
                        </span>
                        {q.is_fresh && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            Fresh (Unpractised)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-900 font-medium">
                        <KaTeXText text={q.question_text} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isPublished && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={e => setIsTemplate(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Save also as re-usable Template
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-bold transition-colors"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
              >
                <Check className="w-4 h-4" /> Publish Exam ({selectedCount} Qs)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
