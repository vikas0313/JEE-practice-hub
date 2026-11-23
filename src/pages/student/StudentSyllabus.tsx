import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getSyllabusSubjects,
  getSyllabusGroups,
  getSyllabusChapters,
  getSyllabusTopics,
  getVisibleQuestions,
  getSubjects,
} from '../../lib/db';
import { getStudentVisibleSyllabus } from '../../lib/syllabusSecurity';
import {
  FolderTree,
  BookOpen,
  Search,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  HelpCircle,
  Tag,
  ArrowRight,
} from 'lucide-react';

export default function StudentSyllabus() {
  const navigate = useNavigate();
  const { loading } = useAuth();

  const subjects = useMemo(() => {
    const syl = getSyllabusSubjects();
    return syl.length > 0 ? syl : getSubjects();
  }, [loading]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allVisibleQuestions = useMemo(() => getVisibleQuestions(), [loading]);

  // Fetch student visible syllabus
  const studentChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    return getStudentVisibleSyllabus(selectedSubjectId);
  }, [selectedSubjectId]);

  // Compute question counts for each chapter
  const chaptersWithStats = useMemo(() => {
    return studentChapters.map(ch => {
      const qInChapter = allVisibleQuestions.filter(
        q => q.primary_chapter_id === ch.chapter_id || q.chapter_id === ch.chapter_id
      );

      const topicCounts: Record<string, number> = {};
      for (const t of ch.topics) {
        topicCounts[t.topic_id] = allVisibleQuestions.filter(
          q => q.primary_topic_id === t.topic_id || q.topic_id === t.topic_id
        ).length;
      }

      return {
        ...ch,
        totalQuestions: qInChapter.length,
        topicCounts,
      };
    });
  }, [studentChapters, allVisibleQuestions]);

  // Filter by search query
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chaptersWithStats;
    const q = searchQuery.toLowerCase().trim();
    return chaptersWithStats.filter(c => {
      if (c.chapter_name.toLowerCase().includes(q)) return true;
      if (c.external_id && c.external_id.toLowerCase().includes(q)) return true;
      if (c.group_name.toLowerCase().includes(q)) return true;
      return c.topics.some(t => t.topic_name.toLowerCase().includes(q));
    });
  }, [chaptersWithStats, searchQuery]);

  // Group chapters by group_name
  const groupedChapters = useMemo(() => {
    const map = new Map<string, typeof filteredChapters>();
    for (const ch of filteredChapters) {
      const g = ch.group_name || 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(ch);
    }
    return Array.from(map.entries()).map(([groupName, chList]) => ({
      groupName,
      chapters: chList,
      totalQuestions: chList.reduce((sum, c) => sum + c.totalQuestions, 0),
    }));
  }, [filteredChapters]);

  const activeSubject = useMemo(
    () => subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const totalQuestionsInSubject = useMemo(
    () => chaptersWithStats.reduce((sum, c) => sum + c.totalQuestions, 0),
    [chaptersWithStats]
  );

  const chaptersWithQuestionsCount = useMemo(
    () => chaptersWithStats.filter(c => c.totalQuestions > 0).length,
    [chaptersWithStats]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Official Chapter-wise Syllabus</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Complete 92-chapter official NTA JEE Main syllabus with verified PYQ question bank coverage.
          </p>
        </div>

        <button
          onClick={() => navigate('/practice')}
          className="self-start sm:self-center px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-blue-200"
        >
          <BookOpen size={14} /> Go to Practice Mode
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
            {chaptersWithStats.length}
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-semibold">Total Chapters</span>
            <p className="text-base font-bold text-gray-900">in {activeSubject?.name || 'Subject'}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
            {chaptersWithQuestionsCount}
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-semibold">Chapters with PYQs</span>
            <p className="text-base font-bold text-gray-900">Ready for Practice</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
            {totalQuestionsInSubject}
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-semibold">Verified Questions</span>
            <p className="text-base font-bold text-gray-900">Loaded in Bank</p>
          </div>
        </div>
      </div>

      {/* Subject Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-1">
        {subjects.map(s => {
          const active = s.id === selectedSubjectId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedSubjectId(s.id);
                setSearchQuery('');
              }}
              className={`px-5 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 whitespace-nowrap ${active
                  ? 'border-blue-700 text-blue-700 bg-white shadow-sm'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search chapters or topics in ${activeSubject?.name || 'Syllabus'} (e.g. Rotational, Integration, Vectors)...`}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 font-semibold"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chapter Groups List */}
      <div className="space-y-6">
        {groupedChapters.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-2">
            <HelpCircle className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-gray-700 font-medium text-sm">No chapters match your search.</p>
            <p className="text-xs text-gray-400">Try clearing the search query or selecting a different subject.</p>
          </div>
        ) : (
          groupedChapters.map(({ groupName, chapters: chs, totalQuestions }) => (
            <div key={groupName} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Group Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    {groupName}
                  </h2>
                  <span className="text-[11px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {chs.length} {chs.length === 1 ? 'chapter' : 'chapters'}
                  </span>
                </div>

                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {totalQuestions} questions
                </span>
              </div>

              {/* Chapters in this group */}
              <div className="divide-y divide-gray-100">
                {chs.map(ch => (
                  <div
                    key={ch.chapter_id}
                    className="p-4 sm:p-5 hover:bg-gray-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2">
                        {ch.external_id && (
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            {ch.external_id}
                          </span>
                        )}
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                          {ch.chapter_name}
                        </h3>
                        {ch.totalQuestions > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                            {ch.totalQuestions} PYQs Available
                          </span>
                        )}
                      </div>

                      {/* Topics pills */}
                      {ch.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ch.topics.map(t => {
                            const count = ch.topicCounts[t.topic_id] || 0;
                            return (
                              <span
                                key={t.topic_id}
                                className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${count > 0
                                    ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-medium'
                                    : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                              >
                                <Tag size={10} className={count > 0 ? 'text-blue-500' : 'text-gray-400'} />
                                {t.topic_name}
                                {count > 0 && (
                                  <span className="ml-0.5 font-bold text-blue-700">({count}Q)</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          Official chapter in guide. Topic classification in verification pipeline.
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                      {ch.totalQuestions > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/practice/config?chapterId=${ch.chapter_id}&subjectId=${selectedSubjectId}`)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1 transition-all"
                        >
                          Practice ({ch.totalQuestions}Q) <ArrowRight size={13} />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                          0 questions loaded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

