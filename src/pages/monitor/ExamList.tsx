import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getExams,
  updateExam,
  copyExam,
  getAttempts,
} from '../../lib/db';
import type { Exam } from '../../lib/types';
import {
  FileText,
  Plus,
  Copy,
  Archive,
  BarChart3,
  Clock,
  CheckCircle,
  HelpCircle,
  Lock,
} from 'lucide-react';

export default function ExamList() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>(() => getExams());
  const [activeTab, setActiveTab] = useState<'published' | 'draft' | 'templates' | 'archived'>('published');

  const attempts = useMemo(() => getAttempts(), []);

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (activeTab === 'templates') return e.is_template;
      if (e.is_template) return false;
      return e.status === activeTab;
    });
  }, [exams, activeTab]);

  const handleCopy = (id: string) => {
    const copy = copyExam(id);
    setExams(getExams());
    navigate(`/monitor/exams/${copy.id}`);
  };

  const handleArchive = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'archived' ? 'published' : 'archived';
    updateExam(id, { status: newStatus as any });
    setExams(getExams());
  };

  const getAttemptCount = (examId: string) => {
    return attempts.filter(a => a.exam_id === examId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Exams & Test Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Build custom exams from the student's practised question bank, configure timers and full-screen constraints.
          </p>
        </div>
        <Link
          to="/monitor/exams/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Build New Exam
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {(['published', 'draft', 'templates', 'archived'] as const).map(tab => {
          const count = exams.filter(e => {
            if (tab === 'templates') return e.is_template;
            if (e.is_template) return false;
            return e.status === tab;
          }).length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-bold capitalize transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-xs px-1.5 py-0.2 rounded-full ${activeTab === tab ? 'bg-indigo-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Exam Cards */}
      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
          <HelpCircle className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="font-bold text-gray-800 text-base">No {activeTab} exams found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {activeTab === 'published'
              ? 'No exams have been published yet. Create one using the Test Builder.'
              : 'Nothing to display in this view.'}
          </p>
          {activeTab !== 'published' && (
            <Link
              to="/monitor/exams/new"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 mt-2"
            >
              <Plus className="w-4 h-4" /> Create an Exam
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map(exam => {
            const attemptCount = getAttemptCount(exam.id);

            return (
              <div
                key={exam.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug">{exam.name}</h3>
                      <span className={`inline-block mt-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        exam.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : exam.status === 'draft'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {exam.is_template ? 'Template' : exam.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {exam.status === 'published' && (
                        <span title="Published exam is immutable" className="text-gray-400 p-1">
                          <Lock className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        onClick={() => handleCopy(exam.id)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Create copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(exam.id, exam.status)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                        title={exam.status === 'archived' ? 'Unarchive' : 'Archive'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block font-medium">Duration</span>
                      <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {exam.duration_minutes} Mins
                      </span>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block font-medium">Questions / Marks</span>
                      <span className="font-bold text-gray-800 mt-0.5 block">
                        {exam.total_questions} Qs · {exam.max_marks} Marks
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Marking: +{exam.marks_correct_mcq} / {exam.marks_wrong_mcq} (MCQ)</div>
                    <div>Grace Period: {exam.grace_period_seconds}s (Lock active)</div>
                    {attemptCount > 0 && (
                      <div className="font-semibold text-emerald-700 flex items-center gap-1 pt-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {attemptCount} student attempt(s)
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {exam.status === 'draft' ? (
                    <Link
                      to={`/monitor/exams/${exam.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Edit Questions & Publish &rarr;
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <Link
                        to={`/monitor/exams/${exam.id}/results`}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> View Results
                      </Link>
                      <button
                        onClick={() => handleCopy(exam.id)}
                        className="text-xs font-semibold text-gray-500 hover:text-indigo-600"
                      >
                        Make Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
