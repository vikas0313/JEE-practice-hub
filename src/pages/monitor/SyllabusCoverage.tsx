// ============================================================
// JEE Practice Hub — Syllabus Coverage Dashboard (Step 7)
// Question distribution across chapters/topics by difficulty & verification status
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  getAllQuestions,
} from '../../lib/db';
import type { SyllabusSubject, SyllabusChapter, SyllabusTopic, Question } from '../../lib/types';
import { Layers, ArrowLeft, AlertCircle, CheckCircle, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SyllabusCoverage() {
  const [subjects, setSubjects] = useState<SyllabusSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    setSubjects(getSyllabusSubjects());
    setChapters(getSyllabusChapters());
    setTopics(getSyllabusTopics());
    setQuestions(getAllQuestions());
  }, []);

  const filteredChapters = useMemo(() => {
    if (selectedSubjectId === 'all') return chapters;
    return chapters.filter(c => c.subject_id === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Compute coverage stats per chapter
  const chapterCoverage = useMemo(() => {
    return filteredChapters.map(ch => {
      const chQuestions = questions.filter(
        q => q.primary_chapter_id === ch.id || q.chapter_id === ch.id
      );

      const basicCount = chQuestions.filter(q => q.difficulty === 'Basic').length;
      const mediumCount = chQuestions.filter(q => q.difficulty === 'Medium').length;
      const advancedCount = chQuestions.filter(q => q.difficulty === 'Advanced').length;
      const verifiedCount = chQuestions.filter(q => q.verification_status === 'Reviewed').length;

      return {
        chapter: ch,
        total: chQuestions.length,
        basic: basicCount,
        medium: mediumCount,
        advanced: advancedCount,
        verified: verifiedCount,
        active: ch.status === 'active',
      };
    });
  }, [filteredChapters, questions]);

  // Unmapped questions
  const unmappedQuestions = useMemo(() => {
    return questions.filter(q => !q.primary_chapter_id);
  }, [questions]);

  const totalBankQuestions = questions.length;
  const taggedQuestionsCount = questions.filter(q => q.primary_chapter_id).length;
  const emptyChaptersCount = chapterCoverage.filter(c => c.total === 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <Link
          to="/monitor/syllabus"
          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Syllabus Tree
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
          <Layers className="text-indigo-600" size={24} />
          Syllabus Coverage &amp; Gap Analysis
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Audit question depth across canonical chapters to ensure comprehensive preparation.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Controlled Tagged Rate</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totalBankQuestions > 0 ? Math.round((taggedQuestionsCount / totalBankQuestions) * 100) : 0}%
          </p>
          <span className="text-xs text-gray-500">
            {taggedQuestionsCount} of {totalBankQuestions} questions tagged
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Empty Chapters</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{emptyChaptersCount}</p>
          <span className="text-xs text-gray-500">Chapters with zero questions</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Unmapped Questions</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{unmappedQuestions.length}</p>
          <span className="text-xs text-gray-500">Pending review or alias mapping</span>
        </div>
      </div>

      {/* Subject Filter */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-xs font-bold text-gray-700">Filter Subject:</span>
          <select
            value={selectedSubjectId}
            onChange={e => setSelectedSubjectId(e.target.value)}
            className="text-xs p-1.5 border border-gray-300 rounded-lg bg-gray-50"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-gray-500 font-medium">
          Showing {chapterCoverage.length} chapters
        </span>
      </div>

      {/* Coverage Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 font-bold text-sm text-gray-900 bg-gray-50/50">
          Chapter Question Inventory
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Chapter</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Total</th>
                <th className="p-3 text-center text-green-700">Basic</th>
                <th className="p-3 text-center text-blue-700">Medium</th>
                <th className="p-3 text-center text-purple-700">Advanced</th>
                <th className="p-3 text-center">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chapterCoverage.map(c => (
                <tr
                  key={c.chapter.id}
                  className={`hover:bg-gray-50 ${c.total === 0 ? 'bg-amber-50/20' : ''}`}
                >
                  <td className="p-3 font-mono font-bold text-gray-700">
                    {c.chapter.external_id || '—'}
                  </td>
                  <td className="p-3 font-medium text-gray-900">
                    {c.chapter.name}
                    {!c.active && (
                      <span className="ml-2 text-[10px] text-gray-500 bg-gray-200 px-1 rounded">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-[11px] font-medium text-gray-600">
                      {c.chapter.syllabus_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold">
                    {c.total === 0 ? (
                      <span className="text-amber-600 font-semibold">0</span>
                    ) : (
                      c.total
                    )}
                  </td>
                  <td className="p-3 text-center text-green-700 font-medium">{c.basic}</td>
                  <td className="p-3 text-center text-blue-700 font-medium">{c.medium}</td>
                  <td className="p-3 text-center text-purple-700 font-medium">{c.advanced}</td>
                  <td className="p-3 text-center text-gray-600">
                    {c.verified} / {c.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmapped Questions Alert */}
      {unmappedQuestions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-amber-600" size={18} />
            <h3 className="font-bold text-gray-900 text-sm">
              Unmapped Questions Requiring Tagging ({unmappedQuestions.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            These questions lack a canonical <code>primary_chapter_id</code> and remain hidden from student practice until tagged.
          </p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
            {unmappedQuestions.map(q => (
              <div key={q.id} className="p-2.5 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-800">Q#{q.number}</span>
                  <span className="text-gray-500 ml-2">Raw Chapter: "{q.chapter_id}"</span>
                </div>
                <Link
                  to="/monitor/review"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Review &amp; Tag &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
