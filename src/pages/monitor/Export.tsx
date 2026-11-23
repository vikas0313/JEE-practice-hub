import React, { useState, useEffect, useMemo } from 'react';
import { sanitizeRecordForExport } from '../../lib/csvSanitizer';
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
  getAttempts,
  getExams,
  getRevisionItems,
  getExamTelemetry,
  insertAuditLog,
  getShortcutRetries,
  getTargets,
  getLatestEstimateSnapshot,
  getQuestionSubject,
  getQuestionChapter,
  getQuestionTopic,
  getSavedReportViews,
  insertSavedReportView,
  deleteSavedReportView,
  getActiveSelectedStudentId,
} from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { getIdealTime, SavedReportView, ReportFilterCriteria } from '../../lib/types';
import {
  filterResponsesByCriteria,
  computeReportAggregates,
  generateMonthlyDigest,
  formatMonthlyDigestMarkdown,
} from '../../lib/customReporting';
import { v4 as uuid } from 'uuid';
import {
  Download,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Printer,
  FileText,
  AlertTriangle,
  Clock,
  TrendingUp,
  X,
  Filter,
  Save,
  Trash2,
  Copy,
  BookOpen,
} from 'lucide-react';

export default function Export() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [exported, setExported] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
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
  const allQuestions = useMemo(() => getAllQuestions(), []);
  const allAnswers = useMemo(() => getAllQuestionAnswers(), []);
  const topics = useMemo(() => getTopics(), []);
  const chapters = useMemo(() => getChapters(), []);
  const subjects = useMemo(() => getSubjects(), []);
  const rawAttempts = useMemo(() => getAttempts(), []);
  const attempts = useMemo(() => rawAttempts.filter(a => !student || a.student_id === student.id), [rawAttempts, student]);
  const exams = useMemo(() => getExams(), []);

  const studentResponses = useMemo(() => (student ? getResponsesByStudent(student.id) : []), [student]);
  const visits = useMemo(() => (student ? getAllVisits().filter(v => v.student_id === student.id) : []), [student]);
  const revisionItems = useMemo(() => (student ? getRevisionItems(student.id) : []), [student]);

  const qMap = useMemo(() => new Map(allQuestions.map(q => [q.id, q])), [allQuestions]);
  const aMap = useMemo(() => new Map(allAnswers.map(a => [a.question_id, a])), [allAnswers]);
  const sMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);
  const cMap = useMemo(() => new Map(chapters.map(c => [c.id, c.name])), [chapters]);
  const tMap = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics]);
  const attMap = useMemo(() => new Map(attempts.map(a => [a.id, a])), [attempts]);
  const examMap = useMemo(() => new Map(exams.map(e => [e.id, e])), [exams]);

  // E8: Custom Reporting state
  const [savedViews, setSavedViews] = useState<SavedReportView[]>(() => getSavedReportViews());
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [customFilter, setCustomFilter] = useState<ReportFilterCriteria>({
    date_range: 'all',
    subject_id: null,
    mode: 'all',
  });
  const [newViewName, setNewViewName] = useState('');
  const [digestYear, setDigestYear] = useState<number>(new Date().getFullYear());
  const [digestMonth, setDigestMonth] = useState<number>(new Date().getMonth() + 1);
  const [copiedDigest, setCopiedDigest] = useState(false);

  // E8: Filtered responses using custom criteria
  const customFilteredResponses = useMemo(() => {
    return filterResponsesByCriteria(studentResponses, customFilter, qMap, attMap);
  }, [studentResponses, customFilter, qMap, attMap]);

  // E8: Aggregates
  const customAggregates = useMemo(() => {
    return computeReportAggregates(customFilteredResponses, qMap, subjects, visits, settings);
  }, [customFilteredResponses, qMap, subjects, visits, settings]);

  // E8: Monthly digest
  const monthlyDigest = useMemo(() => {
    return generateMonthlyDigest(studentResponses, attempts, visits, qMap, subjects, settings, digestYear, digestMonth);
  }, [studentResponses, attempts, visits, qMap, subjects, settings, digestYear, digestMonth]);

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    const view: SavedReportView = {
      id: uuid(),
      name: newViewName.trim(),
      filters: { ...customFilter },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    insertSavedReportView(view);
    setSavedViews(getSavedReportViews());
    setNewViewName('');
    setSelectedViewId(view.id);
  };

  const handleSelectView = (view: SavedReportView) => {
    setSelectedViewId(view.id);
    setCustomFilter({ ...view.filters });
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSavedReportView(id);
    setSavedViews(getSavedReportViews());
    if (selectedViewId === id) {
      setSelectedViewId(null);
    }
  };

  const handleCopyDigest = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const md = formatMonthlyDigestMarkdown(monthlyDigest, monthNames[digestMonth - 1] || 'Current Month', digestYear);
    navigator.clipboard.writeText(md).then(() => {
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 2500);
    });
  };

  // Filter responses by date range
  const filteredResponses = useMemo(() => {
    const now = Date.now();
    return studentResponses.filter(r => {
      if (!r.submitted_at) return false;
      if (dateRange === 'all') return true;

      const dateMs = new Date(r.submitted_at).getTime();
      const diffDays = (now - dateMs) / (1000 * 3600 * 24);

      if (dateRange === 'today') return diffDays <= 1;
      if (dateRange === 'week') return diffDays <= 7;
      if (dateRange === 'month') return diffDays <= 30;
      return true;
    });
  }, [studentResponses, dateRange]);

  // Download 5-Sheet Excel Workbook
  const handleDownloadExcel = async () => {
    const XLSX = await import('xlsx');
    // ----------------------------------------------------
    // Sheet 1: Question Log (Includes Mode, Confidence, Error Reason)
    // ----------------------------------------------------
    const questionLogRows = filteredResponses.map(r => {
      const q = qMap.get(r.question_id);
      const qa = aMap.get(r.question_id);
      const att = attMap.get(r.attempt_id);

      const relVisits = visits.filter(v => v.response_id === r.id);
      const activeSecs = relVisits.reduce((sum, v) => sum + (v.active_seconds || 0), 0);
      const idealSecs = q ? getIdealTime(settings, q.difficulty) : 60;

      const mins = Math.floor(activeSecs / 60);
      const secs = Math.round(activeSecs % 60);

      return {
        'Date': r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '',
        'Time': r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString() : '',
        'Mode': att?.mode === 'exam' ? 'Exam' : 'Practice',
        'Question ID': r.question_id,
        'Subject': q ? getQuestionSubject(q) : 'Physics',
        'Chapter': q ? getQuestionChapter(q) : 'General',
        'Topic': q ? getQuestionTopic(q) : 'General Practice',
        'Question #': q?.number || '',
        'Type': q?.type || '',
        'Level': q?.difficulty || '',
        'Student Answer': r.answer || '',
        'Correct Answer': qa?.answer_text || qa?.correct_answer || '',
        'Result': r.is_correct ? 'Correct' : 'Incorrect',
        'Confidence': r.confidence || 'Unspecified',
        'Error Reason': r.error_reason || (r.is_correct ? 'None' : 'Unspecified'),
        'Marks': r.marks ?? 0,
        'Active Time (seconds)': activeSecs,
        'Active Time (formatted)': `${mins}m ${secs}s`,
        'Ideal Time (seconds)': idealSecs,
        'Pacing Flag': activeSecs > idealSecs * 1.5 ? 'Slow' : activeSecs < idealSecs * 0.2 ? 'Fast' : 'Normal',
      };
    });

    // ----------------------------------------------------
    // Sheet 2: Topic Summary
    // ----------------------------------------------------
    const topicAgg: Record<string, {
      subject: string;
      chapter: string;
      topic: string;
      attempted: number;
      correct: number;
      totalActiveSeconds: number;
      marks: number;
      basicAttempted: number;
      basicCorrect: number;
      mediumAttempted: number;
      mediumCorrect: number;
      advancedAttempted: number;
      advancedCorrect: number;
    }> = {};

    for (const r of filteredResponses) {
      const q = qMap.get(r.question_id);
      if (!q) continue;

      const key = q.topic_id;
      if (!topicAgg[key]) {
        topicAgg[key] = {
          subject: sMap.get(q.subject_id) || '',
          chapter: cMap.get(q.chapter_id) || '',
          topic: tMap.get(q.topic_id) || '',
          attempted: 0,
          correct: 0,
          totalActiveSeconds: 0,
          marks: 0,
          basicAttempted: 0,
          basicCorrect: 0,
          mediumAttempted: 0,
          mediumCorrect: 0,
          advancedAttempted: 0,
          advancedCorrect: 0,
        };
      }
      const item = topicAgg[key];
      item.attempted++;
      if (r.is_correct) item.correct++;
      item.marks += r.marks || 0;

      const relVisits = visits.filter(v => v.response_id === r.id);
      item.totalActiveSeconds += relVisits.reduce((s, v) => s + (v.active_seconds || 0), 0);

      if (q.difficulty === 'Basic') {
        item.basicAttempted++;
        if (r.is_correct) item.basicCorrect++;
      } else if (q.difficulty === 'Medium') {
        item.mediumAttempted++;
        if (r.is_correct) item.mediumCorrect++;
      } else if (q.difficulty === 'Advanced') {
        item.advancedAttempted++;
        if (r.is_correct) item.advancedCorrect++;
      }
    }

    const topicSummaryRows = Object.values(topicAgg).map(e => {
      const acc = e.attempted > 0 ? Math.round((e.correct / e.attempted) * 100) : 0;
      const avgSecs = Math.round(e.totalActiveSeconds / (e.attempted || 1));
      return {
        'Subject': e.subject,
        'Chapter': e.chapter,
        'Topic': e.topic,
        'Questions Attempted': e.attempted,
        'Questions Correct': e.correct,
        'Accuracy %': acc,
        'Basic Attempted': e.basicAttempted,
        'Basic Correct': e.basicCorrect,
        'Medium Attempted': e.mediumAttempted,
        'Medium Correct': e.mediumCorrect,
        'Advanced Attempted': e.advancedAttempted,
        'Advanced Correct': e.advancedCorrect,
        'Total Marks': e.marks,
        'Total Time (seconds)': e.totalActiveSeconds,
        'Avg Time Per Question (seconds)': avgSecs,
      };
    });

    // ----------------------------------------------------
    // Sheet 3: Mistake Notebook
    // ----------------------------------------------------
    const mistakeNotebookRows = revisionItems.map(item => {
      const q = qMap.get(item.question_id);
      return {
        'Question ID': item.question_id,
        'Subject': q ? getQuestionSubject(q) : 'Physics',
        'Chapter': q ? getQuestionChapter(q) : 'General',
        'Topic': q ? getQuestionTopic(q) : 'General Practice',
        'Difficulty': q?.difficulty || 'Unknown',
        'Error Reason': item.added_reason || 'wrong_answer',
        'Spaced Repetition Stage': `Stage ${item.stage}`,
        'Next Due Date': new Date(item.due_at).toLocaleDateString(),
        'Cleared Status': item.cleared ? 'Cleared' : 'Active Due',
        'Last Attempt Date': item.last_attempt_at ? new Date(item.last_attempt_at).toLocaleDateString() : '',
      };
    });

    // ----------------------------------------------------
    // Sheet 4: Progress Over Time
    // ----------------------------------------------------
    const dailyMap: Record<string, { date: string; seconds: number; attempted: number; correct: number; marks: number }> = {};
    filteredResponses.forEach(r => {
      const d = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : 'Unknown';
      if (!dailyMap[d]) dailyMap[d] = { date: d, seconds: 0, attempted: 0, correct: 0, marks: 0 };
      dailyMap[d].attempted++;
      if (r.is_correct) dailyMap[d].correct++;
      dailyMap[d].marks += r.marks || 0;

      const relVisits = visits.filter(v => v.response_id === r.id);
      dailyMap[d].seconds += relVisits.reduce((s, v) => s + (v.active_seconds || 0), 0);
    });

    const progressRows = Object.values(dailyMap).map(d => ({
      'Date': d.date,
      'Active Hours': +(d.seconds / 3600).toFixed(2),
      'Active Minutes': +(d.seconds / 60).toFixed(1),
      'Questions Attempted': d.attempted,
      'Questions Correct': d.correct,
      'Accuracy %': d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0,
      'Marks Earned': d.marks,
    }));

    // ----------------------------------------------------
    // Sheet 5: Exam Summary
    // ----------------------------------------------------
    const examAttempts = attempts.filter(a => a.mode === 'exam');
    const examSummaryRows = examAttempts.map(a => {
      const ex = a.exam_id ? examMap.get(a.exam_id) : null;
      const tele = getExamTelemetry(a.id);
      const tabSwitches = tele.filter(t => t.event_type === 'tab_switch' || t.event_type === 'fullscreen_exit').length;
      return {
        'Exam Name': ex?.name || 'Mock Exam',
        'Date': a.started_at ? new Date(a.started_at).toLocaleDateString() : '',
        'Duration (Minutes)': ex?.duration_minutes ?? a.exam_duration_minutes ?? 180,
        'Score': a.score ?? 0,
        'Max Marks': a.total_marks ?? ex?.max_marks ?? 0,
        'Percentage': a.total_marks ? `${Math.round(((a.score || 0) / a.total_marks) * 100)}%` : '0%',
        'End Reason': a.submit_reason || 'Unknown',
        'Tab Switches / Focus Loss Count': tabSwitches,
      };
    });

    // ----------------------------------------------------
    // Sheet 6: Shortcut Retries (Phase 3)
    // ----------------------------------------------------
    const retries = getShortcutRetries(student?.id);
    const shortcutRows = retries.map(r => {
      const q = qMap.get(r.question_id);
      return {
        'Date': new Date(r.created_at).toLocaleDateString(),
        'Question ID': r.question_id,
        'Subject': q ? getQuestionSubject(q) : '',
        'Chapter': q ? getQuestionChapter(q) : '',
        'Verdict': r.verdict,
        'Baseline Active Seconds': r.baseline_active_seconds,
        'Retry Active Seconds': r.retry_active_seconds,
        'Result': r.is_correct ? 'Correct' : 'Incorrect',
      };
    });

    // ----------------------------------------------------
    // Build Workbook
    // ----------------------------------------------------
    const wb = XLSX.utils.book_new();

    const studentInfoRows = [
      { 'Field': 'Student Name', 'Value': student ? `${student.first_name || student.name || 'Student'} ${student.last_name || ''}`.trim() : 'N/A' },
      { 'Field': 'Email', 'Value': student?.email || 'N/A' },
      { 'Field': 'College / School', 'Value': student?.college_name || 'N/A' },
      { 'Field': 'Age', 'Value': student?.age || 'N/A' },
      { 'Field': 'Account Status', 'Value': student?.status || 'approved' },
      { 'Field': 'Report Generated At', 'Value': new Date().toLocaleString() },
      { 'Field': 'Date Filter', 'Value': dateRange },
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentInfoRows.map(sanitizeRecordForExport)), 'Student Profile');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionLogRows.map(sanitizeRecordForExport)), 'Question Log');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topicSummaryRows.map(sanitizeRecordForExport)), 'Topic Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mistakeNotebookRows.map(sanitizeRecordForExport)), 'Mistake Notebook');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progressRows.map(sanitizeRecordForExport)), 'Progress Over Time');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(examSummaryRows.map(sanitizeRecordForExport)), 'Exam Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shortcutRows.map(sanitizeRecordForExport)), 'Shortcut Retries');

    const dateStr = new Date().toISOString().slice(0, 10);
    const studentNameSlug = student?.first_name ? `${student.first_name}_${student.last_name || ''}`.trim().replace(/\s+/g, '_') : 'Student';
    XLSX.writeFile(wb, `JEE_Practice_Hub_Report_${studentNameSlug}_${dateStr}.xlsx`);

    // Audit log
    if (user) {
      insertAuditLog({
        id: uuid(),
        user_id: user.id,
        action: 'export_excel',
        entity_type: 'report',
        entity_id: null,
        details: { dateRange, sheetsCount: 6 },
        created_at: new Date().toISOString(),
      });
    }

    setExported(true);
  };

  // PDF Report Analysis: 5 Weakest & 5 Slowest Topics
  const topicStatsList = useMemo(() => {
    const list: Array<{ name: string; chapter: string; attempted: number; correct: number; accuracy: number; avgTime: number; idealTime: number; paceRatio: number }> = [];

    for (const t of topics) {
      const qInT = allQuestions.filter(q => q.topic_id === t.id);
      const qIds = new Set(qInT.map(q => q.id));
      const rInT = studentResponses.filter(r => qIds.has(r.question_id) && r.submitted_at);
      if (rInT.length === 0) continue;

      const attempted = rInT.length;
      const correct = rInT.filter(r => r.is_correct).length;
      const accuracy = Math.round((correct / attempted) * 100);

      const respIds = new Set(rInT.map(r => r.id));
      const vInT = visits.filter(v => respIds.has(v.response_id));
      const totalSecs = vInT.reduce((s, v) => s + (v.active_seconds || 0), 0);
      const avgTime = Math.round(totalSecs / attempted);
      const idealTime = 120; // default 2 min
      const paceRatio = +(avgTime / idealTime).toFixed(2);

      const c = chapters.find(ch => ch.id === t.chapter_id);
      list.push({
        name: t.name,
        chapter: c?.name || '',
        attempted,
        correct,
        accuracy,
        avgTime,
        idealTime,
        paceRatio,
      });
    }
    return list;
  }, [topics, allQuestions, studentResponses, visits, chapters]);

  // 5 Weakest Topics (< 60% accuracy, minimum 2 attempts)
  const weakestTopics = useMemo(() => {
    return [...topicStatsList]
      .filter(t => t.attempted >= 2)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  }, [topicStatsList]);

  // 5 Slowest Topics (pace ratio > 1.0)
  const slowestTopics = useMemo(() => {
    return [...topicStatsList]
      .filter(t => t.attempted >= 2)
      .sort((a, b) => b.paceRatio - a.paceRatio)
      .slice(0, 5);
  }, [topicStatsList]);

  const totalAttempted = filteredResponses.length;
  const totalCorrect = filteredResponses.filter(r => r.is_correct).length;
  const totalSeconds = visits.reduce((acc, v) => acc + (v.active_seconds || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Telemetry Reports & Exports</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Generate an audit-grade 5-sheet Excel workbook or view and print the 1–2 page diagnostic PDF report.
        </p>
      </div>

      {/* Current Export Scope Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between text-indigo-900">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">Exporting Data For</span>
            <span className="font-bold text-sm text-indigo-950">
              {student ? `${student.first_name || student.name || 'Student'} ${student.last_name || ''}`.trim() : 'No Student Selected'}
            </span>
            {student?.college_name && <span className="text-indigo-700 ml-2">({student.college_name})</span>}
          </div>
        </div>
        <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-800">
          {student?.email}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">6-Sheet Excel Workbook</h2>
                <p className="text-xs text-gray-500">Complete, audit-grade raw telemetry data.</p>
              </div>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl space-y-1 border border-gray-100">
              <div className="font-bold text-gray-800 mb-1">Sheets Included:</div>
              <div>• <strong>Question Log:</strong> Mode, answer, confidence, error reason, active seconds</div>
              <div>• <strong>Topic Summary:</strong> Accuracy, basic/medium/advanced breakdown</div>
              <div>• <strong>Mistake Notebook:</strong> Spaced repetition stages (3, 7, 21d)</div>
              <div>• <strong>Progress Over Time:</strong> Daily active hours, marks earned</div>
              <div>• <strong>Exam Summary:</strong> Mock exam scores, duration, focus loss count</div>
              <div>• <strong>Shortcut Retries:</strong> Speed drills, baseline vs retry seconds, verdicts</div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Last 24 Hours' },
                  { key: 'week', label: 'Last 7 Days' },
                  { key: 'month', label: 'Last 30 Days' },
                ].map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setDateRange(r.key as 'all' | 'today' | 'week' | 'month');
                      setExported(false);
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-colors ${
                      dateRange === r.key
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={totalAttempted === 0}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all text-xs uppercase tracking-wider"
            >
              <Download size={16} />
              <span>Download 6-Sheet Excel (.xlsx)</span>
            </button>
            {exported && (
              <p className="text-[11px] font-bold text-emerald-700 text-center mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 size={13} /> Excel generated & downloaded successfully.
              </p>
            )}
          </div>
        </div>

        {/* PDF Diagnostic Report Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">1–2 Page Diagnostic Report</h2>
                <p className="text-xs text-gray-500">Concise executive summary for guardian review.</p>
              </div>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl space-y-1 border border-gray-100">
              <div className="font-bold text-gray-800 mb-1">Diagnostic Sections:</div>
              <div>• <strong>Performance Executive Summary:</strong> Score, accuracy, active hours</div>
              <div>• <strong>5 Weakest Topics:</strong> Lowest accuracy areas requiring concept review</div>
              <div>• <strong>5 Slowest Topics:</strong> Pacing bottlenecks (&gt; 1.5x ideal time)</div>
              <div>• <strong>Recent Exam Revision Scores:</strong> Mock test outcomes</div>
              <div className="text-gray-400 italic pt-1">• Explicitly excludes chance estimate (Phase 3 only)</div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-2xl text-xs text-indigo-900">
              <strong>Print & Save as PDF:</strong> Formatted cleanly with print stylesheet for 1–2 pages.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all text-xs uppercase tracking-wider"
          >
            <Printer size={16} />
            <span>View & Print PDF Report</span>
          </button>
        </div>
      </div>

      {/* Module E8: Custom Reporting & Saved Views */}
      {settings.flag_e8_custom_reporting && (
        <div className="space-y-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-md tracking-wider uppercase">
                  Module E8
                </span>
                <h2 className="text-xl font-bold text-gray-900">Custom Report Builder &amp; Saved Views</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Filter question responses by multifaceted criteria, inspect live aggregate metrics, and save filter views for rapid access.
              </p>
            </div>
          </div>

          {/* Saved Views Pills */}
          {savedViews.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saved Filter Presets:</span>
              <div className="flex flex-wrap gap-2">
                {savedViews.map((sv) => (
                  <div
                    key={sv.id}
                    onClick={() => handleSelectView(sv)}
                    className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      selectedViewId === sv.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <BookOpen size={13} />
                    <span>{sv.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteView(sv.id, e)}
                      className="p-0.5 hover:text-red-500 rounded transition"
                      aria-label="Delete saved view"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Criteria Controls */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Filter size={16} className="text-indigo-600" />
                Filter Parameters
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Preset view name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentView}
                  disabled={!newViewName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl transition"
                >
                  <Save size={13} />
                  <span>Save View</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date Range</label>
                <select
                  value={customFilter.date_range}
                  onChange={(e) =>
                    setCustomFilter({ ...customFilter, date_range: e.target.value as any })
                  }
                  className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Last 24 Hours</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                <select
                  value={customFilter.subject_id || ''}
                  onChange={(e) =>
                    setCustomFilter({ ...customFilter, subject_id: e.target.value || null })
                  }
                  className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mode</label>
                <select
                  value={customFilter.mode || 'all'}
                  onChange={(e) =>
                    setCustomFilter({ ...customFilter, mode: e.target.value as any })
                  }
                  className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Practice &amp; Exam</option>
                  <option value="practice">Practice Only</option>
                  <option value="exam">Exam Only</option>
                </select>
              </div>
            </div>

            {/* Live Filter Aggregates Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-center">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Filtered Questions</span>
                <p className="text-xl font-black text-indigo-900 mt-0.5">{customAggregates.totalQuestions}</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-center">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Observed Accuracy</span>
                <p className="text-xl font-black text-emerald-900 mt-0.5">{customAggregates.accuracyPct}%</p>
              </div>
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-center">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Speed Index (vs Ideal)</span>
                <p className="text-xl font-black text-amber-900 mt-0.5">{customAggregates.averageSpeedIndex}x</p>
              </div>
            </div>
          </div>

          {/* Module E8: Monthly Guardian Digest */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  Monthly Monitor Digest Generator
                </h3>
                <p className="text-xs text-gray-500">
                  Strictly Guardian-facing monthly performance summary. Complies with Zero-Student-Email policy (0 student notifications).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={digestMonth}
                  onChange={(e) => setDigestMonth(Number(e.target.value))}
                  className="text-xs p-1.5 rounded-lg border border-gray-200 bg-gray-50 font-semibold"
                >
                  {[
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                  ].map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={digestYear}
                  onChange={(e) => setDigestYear(Number(e.target.value))}
                  className="text-xs p-1.5 rounded-lg border border-gray-200 bg-gray-50 font-semibold"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
                <button
                  type="button"
                  onClick={handleCopyDigest}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition"
                >
                  <Copy size={13} />
                  <span>{copiedDigest ? 'Copied!' : 'Copy Markdown'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl text-center">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Active Days</span>
                <p className="text-lg font-bold text-gray-900">{monthlyDigest.active_days_count} days</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Questions Practiced</span>
                <p className="text-lg font-bold text-gray-900">{monthlyDigest.total_questions_attempted}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Monthly Accuracy</span>
                <p className="text-lg font-bold text-gray-900">{monthlyDigest.overall_accuracy}%</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Average Pacing</span>
                <p className="text-lg font-bold text-gray-900">{monthlyDigest.average_speed_index}x</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal / Print Preview */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-10 space-y-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-gray-900">Printable Performance Report</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl shadow-xs"
                >
                  <Printer size={14} /> Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Report Canvas */}
            <div className="p-6 border border-gray-200 rounded-2xl space-y-6 bg-white print:border-none print:p-0">
              {/* Report Header */}
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">JEE Practice Hub</h2>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    Diagnostic Performance & Projection Report (Phase 3)
                  </p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <div><strong>Student:</strong> {student?.name}</div>
                  <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Overall Summary KPI */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Total Active Study</span>
                  <span className="text-2xl font-black text-gray-900 font-mono mt-1 block">
                    {(totalSeconds / 3600).toFixed(1)} hrs
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Questions Solved</span>
                  <span className="text-2xl font-black text-gray-900 font-mono mt-1 block">
                    {totalAttempted}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Overall Accuracy</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
                    {totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                  <span className="text-xs text-indigo-700 font-semibold block">Target Chance Range</span>
                  <span className="text-lg font-black text-indigo-950 font-mono mt-2 block">
                    {(() => {
                      const tgts = student ? getTargets().filter(t => t.student_id === student.id) : [];
                      if (tgts.length === 0) return 'No targets';
                      const snap = student ? getLatestEstimateSnapshot(student.id, tgts[0].id) : null;
                      if (!snap || snap.p10_percentile === null || snap.p90_percentile === null) return 'Needs data';
                      return `${snap.p10_percentile} – ${snap.p90_percentile} %ile`;
                    })()}
                  </span>
                </div>
              </div>

              {/* 5 Weakest Topics */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Top Weak Topics (Focus Areas)
                </h4>
                {weakestTopics.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No low-accuracy topics detected.</p>
                ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-700 font-bold">
                        <tr>
                          <th className="p-2.5">Topic</th>
                          <th className="p-2.5">Chapter</th>
                          <th className="p-2.5 text-center">Attempted</th>
                          <th className="p-2.5 text-right">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {weakestTopics.map(w => (
                          <tr key={w.name}>
                            <td className="p-2.5 font-bold text-gray-900">{w.name}</td>
                            <td className="p-2.5 text-gray-600">{w.chapter}</td>
                            <td className="p-2.5 text-center">{w.attempted}</td>
                            <td className="p-2.5 text-right font-bold text-rose-700">{w.accuracy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 5 Slowest Topics */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Top Pacing Bottlenecks (Slowest Topics)
                </h4>
                {slowestTopics.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">All topics practiced within ideal pacing parameters.</p>
                ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-700 font-bold">
                        <tr>
                          <th className="p-2.5">Topic</th>
                          <th className="p-2.5">Avg Time / Q</th>
                          <th className="p-2.5">Ideal Time</th>
                          <th className="p-2.5 text-right">Pace Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {slowestTopics.map(s => (
                          <tr key={s.name}>
                            <td className="p-2.5 font-bold text-gray-900">{s.name}</td>
                            <td className="p-2.5 text-gray-700">{s.avgTime}s</td>
                            <td className="p-2.5 text-gray-500">{s.idealTime}s</td>
                            <td className="p-2.5 text-right font-bold text-amber-700">{s.paceRatio}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="border-t pt-3 flex justify-between text-[10px] text-gray-400">
                <span>JEE Practice Hub Confidential Guardian Report</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
