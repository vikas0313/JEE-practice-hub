import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllQuestions,
  getSubjects,
  getChapters,
  getTopics,
  getAllQuestionAnswers,
  getAllSolutions,
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
} from '../../lib/db';
import { VerificationBadge } from '../../components/VerificationBadge';
import { Plus, Search, Filter, Edit3, ImageOff } from 'lucide-react';
import { KaTeXText } from '../../lib/katex-render';
import { useAuth } from '../../lib/auth';

export default function QuestionList() {
  const { loading } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const questions = useMemo(() => getAllQuestions(), [loading]);
  const subjects = useMemo(() => getSubjects(), [loading]);
  const chapters = useMemo(() => getChapters(), [loading]);
  const topics = useMemo(() => getTopics(), [loading]);
  const answers = useMemo(() => getAllQuestionAnswers(), [loading]);
  const solutions = useMemo(() => getAllSolutions(), [loading]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedSubject !== 'All') {
        const sub = subjects.find(s => s.id === q.subject_id);
        if (sub?.name !== selectedSubject) return false;
      }
      if (selectedDifficulty !== 'All' && q.difficulty !== selectedDifficulty) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesText = q.question_text.toLowerCase().includes(query);
        const matchesNum = q.number.toString().includes(query);
        const matchesId = q.id.toLowerCase().includes(query);
        if (!matchesText && !matchesNum && !matchesId) return false;
      }
      return true;
    });
  }, [questions, selectedSubject, selectedDifficulty, search, subjects]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [search, selectedSubject, selectedDifficulty]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const paginatedQuestions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, page, pageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Question Bank</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Manage question texts, LaTeX formulas, answer keys, solutions, and verification tags.
          </p>
        </div>
        <Link
          to="/monitor/questions/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
        >
          <Plus size={16} />
          Add Single Question
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions by ID, text, or number..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-white"
        >
          <option value="All">All Subjects</option>
          {subjects.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-white"
        >
          <option value="All">All Difficulties</option>
          <option value="Basic">Basic</option>
          <option value="Medium">Medium</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Question Preview</th>
                <th className="py-3.5 px-4">Subject & Chapter</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Level</th>
                <th className="py-3.5 px-4">Correct Key</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 italic">
                    No questions found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedQuestions.map(q => {
                  const sub = subjects.find(s => s.id === q.subject_id) || getSyllabusSubjects().find(s => s.id === q.subject_id);
                  const ch = chapters.find(c => c.id === (q.primary_chapter_id || q.chapter_id)) || getSyllabusChapters().find(c => c.id === (q.primary_chapter_id || q.chapter_id));
                  const qa = answers.find(a => a.question_id === q.id);
                  const sol = solutions.find(s => s.question_id === q.id);

                  return (
                    <tr key={q.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-gray-700 block">#{q.number}</span>
                        <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded select-all inline-block mt-0.5" title="Question ID">
                          {q.id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="line-clamp-2 text-xs text-gray-800">
                          <KaTeXText text={q.question_text} />
                        </div>
                        {q.figure_required && q.figure_status !== 'attached' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-200">
                            <ImageOff size={11} /> Figure needed (hidden from practice)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 block text-xs">{sub?.name}</span>
                        <span className="text-xs text-gray-400">{ch?.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-700">
                        {q.type}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          q.difficulty === 'Basic'
                            ? 'bg-emerald-50 text-emerald-700'
                            : q.difficulty === 'Medium'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {qa?.correct_answer || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <VerificationBadge status={sol?.verification_status || 'Unverified'} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/monitor/questions/${q.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit3 size={13} /> Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {filteredQuestions.length > pageSize && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <span className="font-bold text-gray-900">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(page * pageSize, filteredQuestions.length)}</span> of{' '}
              <span className="font-bold text-gray-900">{filteredQuestions.length}</span> questions
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none font-medium transition-colors"
              >
                Previous
              </button>
              <span className="font-bold text-gray-700 px-1">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

