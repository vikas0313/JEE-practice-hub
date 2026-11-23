import React, { useState, useMemo, useEffect } from 'react';
import { getSubjects, getChapters, getVerifiedChapterNotes } from '../../lib/db';
import { getPrintableFormulaSheet, seedDefaultChapterNotesIfEmpty } from '../../lib/revisionNotes';
import { KaTeXText } from '../../lib/katex-render';
import { BookOpen, Printer, Sparkles, CheckCircle2 } from 'lucide-react';

export default function RevisionNotes() {
  useEffect(() => {
    seedDefaultChapterNotesIfEmpty();
  }, []);

  const subjects = useMemo(() => getSubjects(), []);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');

  const chapters = useMemo(() => {
    const all = getChapters();
    if (!selectedSubjectId) return all;
    return all.filter((c) => c.subject_id === selectedSubjectId);
  }, [selectedSubjectId]);

  const [selectedChapterId, setSelectedChapterId] = useState<string>('');

  useEffect(() => {
    if (chapters.length > 0 && (!selectedChapterId || !chapters.some((c) => c.id === selectedChapterId))) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const sheet = useMemo(() => {
    if (!selectedChapterId) return null;
    return getPrintableFormulaSheet(selectedChapterId);
  }, [selectedChapterId]);

  const notes = useMemo(() => {
    if (!selectedChapterId) return [];
    return getVerifiedChapterNotes(selectedChapterId);
  }, [selectedChapterId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Revision Notes &amp; Formula Sheets
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Curated concept summaries and verified formulas for high-yield JEE Main revision.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          <Printer size={15} /> Print Formula Sheet
        </button>
      </div>

      {/* Subject Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {subjects.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setSelectedSubjectId(sub.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedSubjectId === sub.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {sub.name}
          </button>
        ))}
      </div>

      {/* Chapter Selection Grid */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {chapters.map((chap) => (
          <button
            key={chap.id}
            type="button"
            onClick={() => setSelectedChapterId(chap.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap ${
              selectedChapterId === chap.id
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {chap.name}
          </button>
        ))}
      </div>

      {/* Content Area: Formula Sheet */}
      {sheet && sheet.formulas.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                {sheet.subject_name}
              </span>
              <h2 className="text-xl font-black text-gray-900">{sheet.chapter_name}</h2>
            </div>
            {sheet.verified && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 size={13} /> Verified by Monitor
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sheet.formulas.map((item, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>{item.title}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto text-center font-mono">
                  <KaTeXText text={`$$${item.latex}$$`} />
                </div>
                {item.explanation && (
                  <p className="text-[11px] text-gray-500 italic">{item.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : notes.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{notes[0].title}</h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            <KaTeXText text={notes[0].content_markdown} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400 text-xs">
          No revision cards or formula sheets uploaded for this chapter yet.
        </div>
      )}
    </div>
  );
}

