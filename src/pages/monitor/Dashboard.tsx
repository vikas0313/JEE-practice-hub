import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getStudentProfile,
  getResponsesByStudent,
  getAllVisits,
  getAllQuestions,
  getTopics,
  getChapters,
  getSubjects,
  getSettings,
  getAllQuestionAnswers,
  getMonitorNotices,
  markNoticeRead,
  getQuestionSubject,
  getQuestionChapter,
  getQuestionTopic,
  getSyllabusTopics,
  getSyllabusChapters,
  getSyllabusSubjects,
  getActiveSelectedStudentId,
  setActiveSelectedStudentId,
  getApprovedStudents,
} from '../../lib/db';
import { getIdealTime } from '../../lib/types';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  Calendar,
  Layers,
  BarChart2,
  ArrowUpDown,
  Bell,
  ShieldAlert,
  X,
  Search,
  Users,
  User,
} from 'lucide-react';

export default function MonitorDashboard() {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(() => getActiveSelectedStudentId());

  useEffect(() => {
    const handleActiveChange = () => {
      setActiveStudentId(getActiveSelectedStudentId());
    };
    window.addEventListener('active-student-changed', handleActiveChange);
    window.addEventListener('storage', handleActiveChange);
    return () => {
      window.removeEventListener('active-student-changed', handleActiveChange);
      window.removeEventListener('storage', handleActiveChange);
    };
  }, []);

  const student = useMemo(() => getStudentProfile(activeStudentId || undefined), [activeStudentId]);
  const settings = useMemo(() => getSettings(), []);
  const [notices, setNotices] = useState(() => getMonitorNotices().filter(n => !n.read));

  const handleDismissNotice = (id: string) => {
    markNoticeRead(id);
    setNotices(prev => prev.filter(n => n.id !== id));
  };

  const studentResponses = useMemo(() => (student ? getResponsesByStudent(student.id) : []), [student]);
  const visits = useMemo(() => (student ? getAllVisits().filter(v => v.student_id === student.id) : []), [student]);
  const allQuestions = useMemo(() => getAllQuestions(), []);
  const allAnswers = useMemo(() => getAllQuestionAnswers(), []);
  const topics = useMemo(() => getTopics(), []);
  const chapters = useMemo(() => getChapters(), []);
  const subjects = useMemo(() => getSubjects(), []);
  const sylTopics = useMemo(() => getSyllabusTopics(), []);
  const sylChapters = useMemo(() => getSyllabusChapters(), []);
  const sylSubjects = useMemo(() => getSyllabusSubjects(), []);

  // Total Hours Practised
  const totalSeconds = visits.reduce((acc, v) => acc + (v.active_seconds || 0), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  // Questions Attempted & Accuracy
  const submittedResponses = studentResponses.filter(r => r.submitted_at !== null);
  const totalAttempted = submittedResponses.length;
  const totalCorrect = submittedResponses.filter(r => r.is_correct).length;
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Hours Practised Per Day
  const dailyPractice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const day = v.started_at ? v.started_at.slice(0, 10) : 'Unknown';
      map[day] = (map[day] || 0) + (v.active_seconds || 0);
    }
    return Object.entries(map).map(([day, secs]) => ({
      day,
      hours: +(secs / 3600).toFixed(2),
      minutes: Math.round(secs / 60),
    })).sort((a, b) => b.day.localeCompare(a.day));
  }, [visits]);

  // Time Per Question (Sortable table with ideal time and fast/slow flags)
  const [sortField, setSortField] = useState<'date' | 'time' | 'accuracy'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [telemetrySearch, setTelemetrySearch] = useState('');

  const questionLog = useMemo(() => {
    return submittedResponses.map(r => {
      const q = allQuestions.find(item => item.id === r.question_id);
      const qa = allAnswers.find(item => item.question_id === r.question_id);
      const tId = q?.primary_topic_id || q?.topic_id;
      const cId = q?.primary_chapter_id || q?.chapter_id;
      const sId = q?.subject_id;

      const t = topics.find(item => item.id === tId) || sylTopics.find(item => item.id === tId);
      const c = chapters.find(item => item.id === cId) || sylChapters.find(item => item.id === cId);
      const s = subjects.find(item => item.id === sId) || sylSubjects.find(item => item.id === sId);

      const resolvedSubj = (s?.name && s.name.trim() !== '.') ? s.name.trim() : (q ? getQuestionSubject(q) : 'Physics');
      const resolvedChap = (c?.name && c.name.trim() !== '.') ? c.name.trim() : (q ? getQuestionChapter(q) : 'General Practice');
      const resolvedTop = (t?.name && t.name.trim() !== '.') ? t.name.trim() : (q ? getQuestionTopic(q) : resolvedChap);

      const topicName = resolvedTop && resolvedTop.trim() !== '.' ? resolvedTop.trim() : (resolvedChap && resolvedChap.trim() !== '.' ? resolvedChap.trim() : 'General Practice');
      const chapterName = resolvedChap && resolvedChap.trim() !== '.' ? resolvedChap.trim() : 'General Practice';
      const subjectName = resolvedSubj && resolvedSubj.trim() !== '.' ? resolvedSubj.trim() : 'Physics';

      // Total active time across all visits for this response
      const relatedVisits = visits.filter(v => v.response_id === r.id);
      const activeSecs = relatedVisits.reduce((sum, v) => sum + (v.active_seconds || 0), 0);

      const ideal = q ? getIdealTime(settings, q.difficulty) : 60;
      const isSlow = activeSecs > ideal * 1.5;
      const isFast = activeSecs < ideal * 0.2; // fast guess alert

      return {
        responseId: r.id,
        questionId: r.question_id,
        date: r.submitted_at || r.created_at,
        subject: subjectName,
        chapter: chapterName,
        topic: topicName,
        difficulty: q?.difficulty || 'Medium',
        type: q?.type || 'MCQ',
        studentAnswer: r.answer || '',
        correctAnswer: qa?.answer_text || qa?.correct_answer || '',
        isCorrect: r.is_correct ?? false,
        marks: r.marks ?? 0,
        activeSeconds: activeSecs,
        idealSeconds: ideal,
        isSlow,
        isFast,
      };
    });
  }, [submittedResponses, allQuestions, allAnswers, topics, chapters, subjects, sylTopics, sylChapters, sylSubjects, visits, settings]);

  const sortedQuestionLog = useMemo(() => {
    let list = [...questionLog];
    if (telemetrySearch.trim()) {
      const qLower = telemetrySearch.trim().toLowerCase();
      list = list.filter(item =>
        item.questionId.toLowerCase().includes(qLower) ||
        item.topic.toLowerCase().includes(qLower) ||
        item.chapter.toLowerCase().includes(qLower) ||
        item.subject.toLowerCase().includes(qLower)
      );
    }

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'time') cmp = a.activeSeconds - b.activeSeconds;
      else if (sortField === 'accuracy') cmp = (a.isCorrect ? 1 : 0) - (b.isCorrect ? 1 : 0);
      return sortAsc ? cmp : -cmp;
    });
  }, [questionLog, telemetrySearch, sortField, sortAsc]);

  const toggleSort = (field: 'date' | 'time' | 'accuracy') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Time & Accuracy per Topic
  const topicBreakdown = useMemo(() => {
    const map: Record<string, {
      topicName: string;
      chapterName: string;
      subjectName: string;
      attempted: number;
      correct: number;
      totalActiveSeconds: number;
      basicAttempted: number;
      basicCorrect: number;
      mediumAttempted: number;
      mediumCorrect: number;
      advancedAttempted: number;
      advancedCorrect: number;
    }> = {};

    for (const item of questionLog) {
      const topicKey = (item.topic && item.topic.trim() !== '.')
        ? item.topic.trim()
        : ((item.chapter && item.chapter.trim() !== '.') ? item.chapter.trim() : 'General Practice');
      if (!map[topicKey]) {
        map[topicKey] = {
          topicName: topicKey,
          chapterName: (item.chapter && item.chapter.trim() !== '.') ? item.chapter.trim() : 'General Practice',
          subjectName: (item.subject && item.subject.trim() !== '.') ? item.subject.trim() : 'Physics',
          attempted: 0,
          correct: 0,
          totalActiveSeconds: 0,
          basicAttempted: 0,
          basicCorrect: 0,
          mediumAttempted: 0,
          mediumCorrect: 0,
          advancedAttempted: 0,
          advancedCorrect: 0,
        };
      }
      const entry = map[topicKey];
      entry.attempted += 1;
      if (item.isCorrect) entry.correct += 1;
      entry.totalActiveSeconds += item.activeSeconds;

      if (item.difficulty === 'Basic') {
        entry.basicAttempted += 1;
        if (item.isCorrect) entry.basicCorrect += 1;
      } else if (item.difficulty === 'Medium') {
        entry.mediumAttempted += 1;
        if (item.isCorrect) entry.mediumCorrect += 1;
      } else if (item.difficulty === 'Advanced') {
        entry.advancedAttempted += 1;
        if (item.isCorrect) entry.advancedCorrect += 1;
      }
    }

    return Object.values(map);
  }, [questionLog]);

  const allStudents = useMemo(() => getApprovedStudents(), [activeStudentId]);
  const allVisits = useMemo(() => getAllVisits(), [activeStudentId]);

  const nowMs = Date.now();
  const oneWeekAgoMs = nowMs - 7 * 24 * 3600 * 1000;

  const studentOverviewData = useMemo(() => {
    return allStudents.map(s => {
      const sVisits = allVisits.filter(v => v.student_id === s.id);
      const weekVisits = sVisits.filter(v => v.started_at && new Date(v.started_at).getTime() >= oneWeekAgoMs);
      const weekSecs = weekVisits.reduce((acc, v) => acc + (v.active_seconds || 0), 0);
      const weekHours = (weekSecs / 3600).toFixed(1);

      const sResponses = getResponsesByStudent(s.id);
      const weekResponses = sResponses.filter(r => r.submitted_at && new Date(r.submitted_at).getTime() >= oneWeekAgoMs);
      const submitted = sResponses.filter(r => r.submitted_at !== null);
      const correct = submitted.filter(r => r.is_correct).length;
      const acc = submitted.length > 0 ? Math.round((correct / submitted.length) * 100) : 0;

      return {
        id: s.id,
        name: `${s.first_name || s.name || 'Student'} ${s.last_name || ''}`.trim(),
        email: s.email,
        college: s.college_name || '—',
        status: s.status || 'approved',
        hoursThisWeek: weekHours,
        questionsThisWeek: weekResponses.length,
        totalQuestions: submitted.length,
        accuracy: acc,
      };
    });
  }, [allStudents, allVisits, oneWeekAgoMs]);

  const handleSwitchStudent = (id: string) => {
    setActiveSelectedStudentId(id);
    setActiveStudentId(id);
    window.dispatchEvent(new Event('active-student-changed'));
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Active Scoped Student Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <User className="w-6 h-6 text-indigo-200" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-indigo-200">
              Active Monitored Student
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {student ? `${student.first_name || student.name || 'Student'} ${student.last_name || ''}`.trim() : 'No Student Selected'}
            </h2>
            <div className="text-xs text-indigo-200 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <span>{student?.email}</span>
              {student?.college_name && <span>• {student.college_name}</span>}
              {student?.age && <span>• Age {student.age}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/monitor/students"
            className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/25 transition-colors"
          >
            Manage Students Directory
          </Link>
        </div>
      </div>

      {/* Top Header */}
      <div>
        <span className="text-xs uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
          Guardian & Content Portal
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">Monitor Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Detailed real-time telemetry, active solving duration per question, and topic pacing analytics for {student?.name || 'Student'}.
        </p>
      </div>

      {/* Unread Monitor Alerts / In-App Notices */}
      {notices.length > 0 && (
        <div className="space-y-3">
          {notices.map(notice => (
            <div
              key={notice.id}
              className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start justify-between gap-4 text-amber-950 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Exam Event Alert: {notice.reason.replace(/_/g, ' ')}
                  </div>
                  <p className="text-xs text-amber-800 font-medium">
                    {notice.message}
                  </p>
                  <span className="text-[10px] text-amber-600 block mt-1">
                    {new Date(notice.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismissNotice(notice.id)}
                className="text-amber-600 hover:text-amber-800 p-1 rounded-lg hover:bg-amber-100/60"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Total Hours Practised</span>
            <Clock size={18} className="text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalHours} <span className="text-sm font-normal text-gray-400">hrs</span></p>
          <span className="text-xs text-gray-500 mt-1 block">Active solving time</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Questions Solved</span>
            <Layers size={18} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalAttempted}</p>
          <span className="text-xs text-gray-500 mt-1 block">{totalCorrect} answered correctly</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Overall Accuracy</span>
            <TrendingUp size={18} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700 mt-2">{overallAccuracy}%</p>
          <span className="text-xs text-gray-500 mt-1 block">Net JEE Marks: {questionLog.reduce((s, q) => s + q.marks, 0)}</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Pacing Alerts</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            {questionLog.filter(q => q.isSlow).length}
          </p>
          <span className="text-xs text-gray-500 mt-1 block">
            {questionLog.filter(q => q.isFast).length} fast guesses flagged
          </span>
        </div>
      </div>

      {/* Daily Practice Activity */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          Daily Practice Breakdown
        </h2>
        {dailyPractice.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No activity recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {dailyPractice.map(d => (
              <div key={d.day} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-400 font-mono block">{d.day}</span>
                <span className="text-lg font-bold text-gray-900 mt-0.5 block">{d.minutes} <span className="text-xs font-normal text-gray-500">min</span></span>
                <span className="text-xs text-indigo-600 font-semibold">{d.hours} hrs</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time per Question Table (FR-11.2) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" />
              Time Per Question Telemetry
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Active time measured while solving. Amber flag = exceeded 1.5x ideal time; Zap = fast guess (&lt;20% ideal).
            </p>
          </div>

          {/* Question ID / Topic search filter */}
          <div className="relative min-w-[260px]">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={telemetrySearch}
              onChange={(e) => setTelemetrySearch(e.target.value)}
              placeholder="Search by Question ID, Subject, or Topic..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {telemetrySearch && (
              <button
                type="button"
                onClick={() => setTelemetrySearch('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3.5 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('date')}>
                  <span className="inline-flex items-center gap-1">Date/Time <ArrowUpDown size={12} /></span>
                </th>
                <th className="py-3.5 px-4">Question ID</th>
                <th className="py-3.5 px-4">Subject & Topic</th>
                <th className="py-3.5 px-4">Level</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('time')}>
                  <span className="inline-flex items-center gap-1">Active Time <ArrowUpDown size={12} /></span>
                </th>
                <th className="py-3.5 px-4">Ideal Time</th>
                <th className="py-3.5 px-4">Pacing Flag</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('accuracy')}>
                  <span className="inline-flex items-center gap-1">Result <ArrowUpDown size={12} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedQuestionLog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 italic">
                    {telemetrySearch ? 'No questions matching search filter.' : 'No questions answered yet.'}
                  </td>
                </tr>
              ) : (
                sortedQuestionLog.map(item => {
                  const mins = Math.floor(item.activeSeconds / 60);
                  const secs = Math.round(item.activeSeconds % 60);
                  const timeFormatted = `${mins}m ${secs}s`;

                  return (
                    <tr key={item.responseId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-500 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded select-all inline-block">
                          {item.questionId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-gray-900 block text-xs">
                          {item.topic && item.topic !== '.' ? item.topic : item.chapter && item.chapter !== '.' ? item.chapter : 'General Practice'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.subject && item.subject !== '.' ? item.subject : 'Physics'}
                          {item.chapter && item.chapter !== '.' && item.chapter !== item.topic ? ` · ${item.chapter}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.difficulty === 'Basic'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.difficulty === 'Medium'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {timeFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-500">
                        {Math.floor(item.idealSeconds / 60)}m 00s
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isSlow ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle size={12} /> Slow
                          </span>
                        ) : item.isFast ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <Zap size={12} /> Fast
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Normal</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            <CheckCircle size={12} /> +4
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Wrong ({item.marks})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Time & Accuracy Per Topic (FR-11.3, FR-11.4) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 size={18} className="text-indigo-600" />
          Time & Accuracy by Topic
        </h2>

        {topicBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No topic statistics available.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {topicBreakdown.map(tb => {
              const avgSeconds = Math.round(tb.totalActiveSeconds / (tb.attempted || 1));
              const avgFormatted = `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`;
              const acc = Math.round((tb.correct / tb.attempted) * 100);

              return (
                <div key={tb.topicName} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase font-bold text-gray-400">
                      {tb.subjectName && tb.subjectName !== '.' ? tb.subjectName : 'Physics'}
                      {tb.chapterName && tb.chapterName !== '.' && tb.chapterName !== tb.topicName ? ` · ${tb.chapterName}` : ''}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base">
                      {tb.topicName && tb.topicName.trim() !== '.' ? tb.topicName : 'General Practice'}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs font-medium">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        Basic: {tb.basicCorrect}/{tb.basicAttempted}
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        Medium: {tb.mediumCorrect}/{tb.mediumAttempted}
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        Advanced: {tb.advancedCorrect}/{tb.advancedAttempted}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 uppercase font-semibold block">Avg Time/Q</span>
                      <span className="font-mono font-bold text-gray-900 text-base">{avgFormatted}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 uppercase font-semibold block">Accuracy</span>
                      <span className={`text-lg font-bold ${
                        acc >= 80 ? 'text-green-600' : acc >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {acc}%
                      </span>
                      <span className="text-xs text-gray-400 block">{tb.correct} of {tb.attempted}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Students Performance Overview Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              All Students Overview
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              High-level comparative performance metrics across all approved students.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {allStudents.length} Approved {allStudents.length === 1 ? 'Student' : 'Students'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-5">Student</th>
                <th className="py-3 px-5">College</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Hours (Past 7 Days)</th>
                <th className="py-3 px-5 text-right">Questions (Past 7 Days)</th>
                <th className="py-3 px-5 text-right">Overall Accuracy</th>
                <th className="py-3 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {studentOverviewData.map(s => {
                const isSelected = activeStudentId === s.id;
                return (
                  <tr key={s.id} className={`hover:bg-gray-50/75 transition-colors ${isSelected ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-5 text-gray-700">{s.college}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-medium text-gray-900">{s.hoursThisWeek} hrs</td>
                    <td className="py-3.5 px-5 text-right text-gray-700">{s.questionsThisWeek}</td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={`font-semibold ${s.accuracy >= 70 ? 'text-emerald-700' : s.accuracy >= 40 ? 'text-indigo-700' : 'text-rose-700'}`}>
                        {s.accuracy}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleSwitchStudent(s.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-indigo-700 text-white shadow-xs'
                            : 'bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-800'
                        }`}
                      >
                        {isSelected ? '✓ Active' : 'Switch'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

