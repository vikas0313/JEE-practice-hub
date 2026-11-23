import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getPublishedExams,
  getAttempts,
} from '../../lib/db';
import type { Exam, Attempt } from '../../lib/types';
import {
  FileText,
  Clock,
  CheckCircle,
  Play,
  BarChart3,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export default function StudentExams() {
  const { user } = useAuth();
  const exams = useMemo(() => getPublishedExams(user?.id), [user?.id]);
  const myAttempts = useMemo(() => {
    return user ? getAttempts().filter(a => a.student_id === user.id && a.mode === 'exam') : [];
  }, [user]);

  const attemptMap = useMemo(() => {
    const map = new Map<string, Attempt>();
    myAttempts.forEach(a => {
      if (a.exam_id) map.set(a.exam_id, a);
    });
    return map;
  }, [myAttempts]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          NTA-style Official Exam Tests
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Exam mode runs on desktop/laptop in a locked full-screen environment matching the official NTA portal.
        </p>
      </div>

      {exams.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">No Exams Published Yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Your guardian/monitor will design and publish targeted mock exams based on questions you have practised.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {exams.map(exam => {
            const attempt = attemptMap.get(exam.id);
            const isCompleted = attempt && attempt.ended_at !== null;
            const isOpen = attempt && attempt.ended_at === null;

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-lg leading-snug">{exam.name}</h3>
                    {isCompleted ? (
                      <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Completed
                      </span>
                    ) : isOpen ? (
                      <span className="bg-amber-50 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1 shrink-0 animate-pulse">
                        In Progress
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                        Available
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-gray-500 block">Duration</span>
                      <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {exam.duration_minutes} Mins
                      </span>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-gray-500 block">Total Marks</span>
                      <span className="font-bold text-gray-800 mt-0.5 block">
                        {exam.total_questions} Questions ({exam.max_marks} Marks)
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>MCQ: +{exam.marks_correct_mcq} / {exam.marks_wrong_mcq} · NVQ: +{exam.marks_correct_nvq} / {exam.marks_wrong_nvq}</div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Lock className="w-3 h-3 text-gray-400" /> Full-screen lock required · 1 attempt allowed
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  {isCompleted ? (
                    <Link
                      to={`/exam/${exam.id}/result`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" /> View Revision Score
                    </Link>
                  ) : isOpen ? (
                    <Link
                      to={`/exam/${exam.id}/session`}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
                    >
                      Resume Exam &rarr;
                    </Link>
                  ) : (
                    <Link
                      to={`/exam/${exam.id}/instructions`}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Take Exam
                    </Link>
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
