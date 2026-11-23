import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllQuestions,
  getAllSolutions,
  getFlagReports,
  updateFlagReport,
  getSubjects,
  getChapters,
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  updateQuestion,
  insertAuditLog,
} from '../../lib/db';
import { v4 as uuid } from 'uuid';
import {
  AlertCircle,
  ImageOff,
  Flag,
  CheckCircle,
  Edit3,
  Tag,
  RotateCcw,
  CheckSquare,
  Square,
} from 'lucide-react';
import { KaTeXText } from '../../lib/katex-render';

interface UndoSnapshot {
  questionId: string;
  prevPrimaryChapterId: string | null;
  prevPrimaryTopicId: string | null;
  prevIsActive: boolean;
}

export default function ReviewQueue() {
  const [activeTab, setActiveTab] = useState<'mismatches' | 'figures' | 'flags' | 'unmapped'>('mismatches');

  const [questions, setQuestions] = useState(getAllQuestions());
  const solutions = useMemo(() => getAllSolutions(), []);
  const flagReports = useMemo(() => getFlagReports(), []);
  const subjects = useMemo(() => getSubjects(), []);
  const chapters = useMemo(() => getChapters(), []);

  // Controlled Syllabus state
  const syllabusSubjects = useMemo(() => getSyllabusSubjects(), []);
  const [bulkSubjectId, setBulkSubjectId] = useState<string>(syllabusSubjects[0]?.id || '');
  const [bulkChapterId, setBulkChapterId] = useState<string>('');
  const [bulkTopicId, setBulkTopicId] = useState<string>('');

  const controlledChapters = useMemo(() => {
    if (!bulkSubjectId) return [];
    return getSyllabusChapters({ subjectId: bulkSubjectId, status: 'active' });
  }, [bulkSubjectId]);

  const controlledTopics = useMemo(() => {
    if (!bulkChapterId) return [];
    return getSyllabusTopics(bulkChapterId);
  }, [bulkChapterId]);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<UndoSnapshot[] | null>(null);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  // 1. Key mismatches
  const keyMismatches = useMemo(() => {
    return questions.filter(q => {
      const sol = solutions.find(s => s.question_id === q.id);
      return sol && (sol.matches_key === false || sol.verification_status === 'Flagged');
    });
  }, [questions, solutions]);

  // 2. Questions waiting for a figure
  const figureNeeded = useMemo(() => {
    return questions.filter(q => q.figure_required && q.figure_status === 'needed');
  }, [questions]);

  // 3. Open student flags
  const openFlags = useMemo(() => {
    return flagReports.filter(f => f.status === 'open');
  }, [flagReports]);

  // 4. Unmapped questions
  const unmappedQuestions = useMemo(() => {
    return questions.filter(q => !q.primary_chapter_id);
  }, [questions]);

  const handleDismissFlag = (flagId: string) => {
    updateFlagReport(flagId, { status: 'dismissed' });
    setQuestions(getAllQuestions());
  };

  const handleResolveFlag = (flagId: string) => {
    updateFlagReport(flagId, { status: 'reviewed' });
    setQuestions(getAllQuestions());
  };

  const handleToggleSelect = (qId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const handleSelectAllUnmapped = () => {
    if (selectedIds.size === unmappedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unmappedQuestions.map(q => q.id)));
    }
  };

  const handleBulkAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0 || !bulkChapterId) return;

    const snapshot: UndoSnapshot[] = [];
    const now = new Date().toISOString();

    selectedIds.forEach(qId => {
      const q = questions.find(item => item.id === qId);
      if (!q) return;

      snapshot.push({
        questionId: q.id,
        prevPrimaryChapterId: q.primary_chapter_id ?? null,
        prevPrimaryTopicId: q.primary_topic_id ?? null,
        prevIsActive: q.is_active ?? true,
      });

      updateQuestion(q.id, {
        primary_chapter_id: bulkChapterId,
        primary_topic_id: bulkTopicId || null,
        is_active: true,
        updated_at: now,
      });
    });

    insertAuditLog({
      id: uuid(),
      user_id: 'monitor',
      action: 'questions_bulk_tagged',
      entity_type: 'question',
      entity_id: null,
      details: {
        count: selectedIds.size,
        chapter_id: bulkChapterId,
        topic_id: bulkTopicId || null,
      },
      created_at: now,
    });

    setUndoStack(snapshot);
    setUndoMessage(`Successfully tagged ${selectedIds.size} questions.`);
    setSelectedIds(new Set());
    setQuestions(getAllQuestions());
  };

  const handleUndo = () => {
    if (!undoStack) return;

    const now = new Date().toISOString();
    undoStack.forEach(item => {
      updateQuestion(item.questionId, {
        primary_chapter_id: item.prevPrimaryChapterId,
        primary_topic_id: item.prevPrimaryTopicId,
        is_active: item.prevIsActive,
        updated_at: now,
      });
    });

    insertAuditLog({
      id: uuid(),
      user_id: 'monitor',
      action: 'questions_bulk_tagging_undone',
      entity_type: 'question',
      entity_id: null,
      details: { revertedCount: undoStack.length },
      created_at: now,
    });

    setUndoMessage(`Reverted tagging for ${undoStack.length} questions.`);
    setUndoStack(null);
    setQuestions(getAllQuestions());
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review &amp; Quality Queue</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Priority verification queue for answer-key mismatches, missing diagrams, student flags, and controlled syllabus tagging.
        </p>
      </div>

      {/* Undo Banner */}
      {undoMessage && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-indigo-900 font-medium">
            <CheckCircle size={18} className="text-indigo-600" />
            <span>{undoMessage}</span>
          </div>
          <div className="flex items-center gap-3">
            {undoStack && (
              <button
                type="button"
                onClick={handleUndo}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-300 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50 shadow-sm"
              >
                <RotateCcw size={14} />
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setUndoMessage(null);
                setUndoStack(null);
              }}
              className="text-xs text-indigo-500 hover:text-indigo-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('mismatches')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'mismatches'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <AlertCircle size={16} />
          Key Mismatches ({keyMismatches.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('figures')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'figures'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ImageOff size={16} />
          Figures Needed ({figureNeeded.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('flags')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'flags'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Flag size={16} />
          Student Flags ({openFlags.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unmapped')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'unmapped'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Tag size={16} />
          Unmapped Tags ({unmappedQuestions.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'mismatches' && (
          <div>
            {keyMismatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
                <p className="font-semibold text-gray-800">No key mismatches detected.</p>
                <p className="text-xs text-gray-400 mt-1">All verified solutions match the official NTA answer keys.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keyMismatches.map(q => {
                  const sub = subjects.find(s => s.id === q.subject_id);
                  const ch = chapters.find(c => c.id === q.chapter_id);
                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-amber-700 uppercase">
                          Question #{q.number} · {sub?.name} · {ch?.name}
                        </span>
                        <div className="text-sm text-gray-900 mt-1 line-clamp-2">
                          <KaTeXText text={q.question_text} />
                        </div>
                      </div>
                      <Link
                        to={`/monitor/questions/${q.id}`}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 whitespace-nowrap"
                      >
                        Review Solution
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'figures' && (
          <div>
            {figureNeeded.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
                <p className="font-semibold text-gray-800">No missing diagrams.</p>
                <p className="text-xs text-gray-400 mt-1">All questions requiring diagrams have figures attached.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {figureNeeded.map(q => {
                  const sub = subjects.find(s => s.id === q.subject_id);
                  const ch = chapters.find(c => c.id === q.chapter_id);
                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase">
                          Question #{q.number} · {sub?.name} · {ch?.name}
                        </span>
                        <div className="text-sm text-gray-900 mt-1 line-clamp-2">
                          <KaTeXText text={q.question_text} />
                        </div>
                        <span className="text-xs text-amber-600 font-medium mt-1 block">
                          Figure status: {q.figure_status} (Currently hidden from Practice)
                        </span>
                      </div>
                      <Link
                        to={`/monitor/questions/${q.id}`}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 whitespace-nowrap"
                      >
                        Attach Diagram
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'flags' && (
          <div>
            {openFlags.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
                <p className="font-semibold text-gray-800">No student flags.</p>
                <p className="text-xs text-gray-400 mt-1">The student has not reported any issues.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openFlags.map(f => {
                  const q = questions.find(item => item.id === f.question_id);
                  return (
                    <div key={f.id} className="bg-white rounded-xl border border-red-200 p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-600 uppercase">
                          Flagged Question #{q?.number || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-red-900 font-medium">
                        Student Note: "{f.reason}"
                      </div>

                      {q && (
                        <div className="text-xs text-gray-700 line-clamp-2">
                          <KaTeXText text={q.question_text} />
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDismissFlag(f.id)}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveFlag(f.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Mark Resolved
                        </button>
                        {q && (
                          <Link
                            to={`/monitor/questions/${q.id}`}
                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-1"
                          >
                            <Edit3 size={12} /> Edit Solution
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Unmapped Questions with Bulk Tagging & 1-click Undo */}
        {activeTab === 'unmapped' && (
          <div className="space-y-4">
            {/* Bulk Tagging Control Bar */}
            <form
              onSubmit={handleBulkAssign}
              className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleSelectAllUnmapped}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
                >
                  {selectedIds.size === unmappedQuestions.length && unmappedQuestions.length > 0 ? (
                    <CheckSquare size={14} className="text-indigo-600" />
                  ) : (
                    <Square size={14} />
                  )}
                  Select All ({selectedIds.size}/{unmappedQuestions.length})
                </button>
                <span className="text-xs text-gray-400">|</span>
              </div>

              {/* Dependent dropdowns (free text strictly disabled) */}
              <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full text-xs">
                {/* Subject */}
                <select
                  value={bulkSubjectId}
                  onChange={e => {
                    setBulkSubjectId(e.target.value);
                    setBulkChapterId('');
                    setBulkTopicId('');
                  }}
                  className="p-2 border border-gray-300 rounded-lg w-full sm:w-auto"
                >
                  {syllabusSubjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {/* Chapter */}
                <select
                  value={bulkChapterId}
                  onChange={e => {
                    setBulkChapterId(e.target.value);
                    setBulkTopicId('');
                  }}
                  className="p-2 border border-indigo-300 rounded-lg font-medium w-full sm:w-auto flex-1"
                  required
                >
                  <option value="">-- Select Canonical Chapter --</option>
                  {controlledChapters.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.external_id} — {c.name}
                    </option>
                  ))}
                </select>

                {/* Topic */}
                <select
                  value={bulkTopicId}
                  onChange={e => setBulkTopicId(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg w-full sm:w-auto flex-1"
                >
                  <option value="">
                    {controlledTopics.length === 0
                      ? '-- No topics defined --'
                      : '-- Select Topic (Optional) --'}
                  </option>
                  {controlledTopics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={selectedIds.size === 0 || !bulkChapterId}
                  className="px-4 py-2 bg-indigo-600 disabled:bg-gray-300 text-white rounded-lg font-bold hover:bg-indigo-700 whitespace-nowrap shadow-sm"
                >
                  Bulk Assign Tags
                </button>
              </div>
            </form>

            {unmappedQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
                <p className="font-semibold text-gray-800">All questions are canonically tagged!</p>
                <p className="text-xs text-gray-400 mt-1">
                  100% of questions in the bank have verified <code>primary_chapter_id</code> tags.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unmappedQuestions.map(q => {
                  const isSelected = selectedIds.has(q.id);
                  const legacySub = subjects.find(s => s.id === q.subject_id);
                  const legacyCh = chapters.find(c => c.id === q.chapter_id);

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleSelect(q.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(q.id);
                          }}
                          className="text-gray-400 hover:text-indigo-600"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-indigo-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">
                              Question #{q.number}
                            </span>
                            <span className="text-xs text-gray-500">[{legacySub?.name || 'Unknown'}]</span>
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                              Raw: "{legacyCh?.name || q.chapter_id}"
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 mt-1 line-clamp-1">
                            <KaTeXText text={q.question_text} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Link
                          to={`/monitor/questions/${q.id}`}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
                        >
                          Edit &amp; Tag
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
