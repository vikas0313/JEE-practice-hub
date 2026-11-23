import React, { useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import {
  getResponsesByStudent,
  getAllQuestions,
  getTopics,
  getChapters,
  getSubjects,
  getAttemptsByStudent,
} from '../../lib/db';
import { BarChart3, CheckCircle2, BookOpen, Layers } from 'lucide-react';

export default function StudentResults() {
  const { user } = useAuth();

  const responses = useMemo(() => (user ? getResponsesByStudent(user.id) : []), [user]);
  const attempts = useMemo(() => (user ? getAttemptsByStudent(user.id) : []), [user]);
  const allQuestions = useMemo(() => getAllQuestions(), []);
  const topics = useMemo(() => getTopics(), []);
  const chapters = useMemo(() => getChapters(), []);
  const subjects = useMemo(() => getSubjects(), []);

  const totalAttempted = responses.filter(r => r.submitted_at !== null).length;
  const totalCorrect = responses.filter(r => r.is_correct).length;
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalScore = responses.reduce((acc, r) => acc + (r.marks || 0), 0);

  // Group accuracy by Subject -> Chapter -> Topic
  const chapterAccuracies = useMemo(() => {
    const list: {
      chapterId: string;
      chapterName: string;
      subjectName: string;
      attempted: number;
      correct: number;
      accuracy: number;
    }[] = [];

    for (const c of chapters) {
      const qInChapter = allQuestions.filter(q => q.chapter_id === c.id);
      const qIds = new Set(qInChapter.map(q => q.id));
      const respInChapter = responses.filter(r => qIds.has(r.question_id) && r.submitted_at !== null);

      if (respInChapter.length > 0) {
        const sub = subjects.find(s => s.id === c.subject_id);
        const correct = respInChapter.filter(r => r.is_correct).length;
        list.push({
          chapterId: c.id,
          chapterName: c.name,
          subjectName: sub?.name || '',
          attempted: respInChapter.length,
          correct,
          accuracy: Math.round((correct / respInChapter.length) * 100),
        });
      }
    }

    return list;
  }, [chapters, subjects, allQuestions, responses]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your Practice Performance</h1>
        <p className="text-sm text-gray-600 mt-1">Review your accuracy, marks, and topic-level mastery.</p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase">Questions Solved</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalAttempted}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase">Overall Accuracy</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{overallAccuracy}%</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase">Correct Answers</span>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalCorrect}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase">Net Practice Marks</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalScore}</p>
        </div>
      </div>

      {/* Accuracy by Chapter */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Layers size={18} className="text-blue-600" />
          Accuracy by Chapter
        </h2>

        {chapterAccuracies.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No practice attempts recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {chapterAccuracies.map((item) => (
              <div key={item.chapterId} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">{item.subjectName}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.chapterName}</h3>
                  <span className="text-xs text-gray-500 mt-0.5 block">
                    {item.correct} / {item.attempted} correct
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${
                    item.accuracy >= 80 ? 'text-green-600' : item.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {item.accuracy}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Practice Sets */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <BookOpen size={18} className="text-blue-600" />
          Recent Practice Sessions
        </h2>

        {attempts.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No past sessions yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {attempts.slice().reverse().map(a => {
              const topic = topics.find(t => t.id === a.topic_id);
              const chapter = chapters.find(c => c.id === a.chapter_id);
              const dateStr = new Date(a.started_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={a.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400">{dateStr}</span>
                    <h3 className="text-sm font-semibold text-gray-900">{topic?.name || 'Practice Set'}</h3>
                    <span className="text-xs text-gray-500">{chapter?.name} · Difficulty: {a.difficulty}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-800">
                      Score: {a.score ?? 0} / {a.total_marks ?? 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

