// ============================================================
// Assignments Manager (Phase 3: SRD 4.14)
// Monitor creates and monitors structured practice tasks
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  getAssignments, createAssignment, updateAssignment, deleteAssignment,
  getAssignmentProgress, getStudentProfile, getSubjects, getChapters,
} from '../../lib/db';
import type { Assignment, DifficultyFilter, Subject, Chapter } from '../../lib/types';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [chapter, setChapter] = useState<string>('');
  const [level, setLevel] = useState<DifficultyFilter>('Medium');
  const [targetCount, setTargetCount] = useState<number>(20);
  const [dueDate, setDueDate] = useState<string>('');

  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);

  useEffect(() => {
    loadData();
    setSubjectsList(getSubjects());
    // Default due date to next Sunday
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (subject) {
      setChaptersList(getChapters(subject));
    } else {
      setChaptersList([]);
    }
  }, [subject]);

  const loadData = () => {
    const student = getStudentProfile();
    if (student) setStudentId(student.id);
    setAssignments(getAssignments());
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !studentId) return;

    createAssignment({
      student_id: studentId,
      title: title.trim(),
      subject: subject || null,
      chapter: chapter || null,
      topic: null,
      level: level || 'Mixed',
      target_count: Number(targetCount),
      due_date: new Date(dueDate + 'T23:59:59+05:30').toISOString(),
    });

    setIsAdding(false);
    setTitle('');
    loadData();
  };

  const handleStatusChange = (id: string, status: Assignment['status']) => {
    updateAssignment(id, { status });
    loadData();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this assignment?')) {
      deleteAssignment(id);
      loadData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Assignments</h1>
          <p className="text-sm text-gray-600">
            Assign focused question quotas by subject, chapter, or difficulty level with due dates.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          {isAdding ? 'Cancel' : '+ New Assignment'}
        </button>
      </div>

      {/* Creation Modal */}
      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Create Assignment</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assignment Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Master Thermodynamics Medium Questions"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Subject (Optional)</label>
              <select
                value={subject}
                onChange={e => { setSubject(e.target.value); setChapter(''); }}
                className="w-full p-2.5 border rounded-lg text-sm"
              >
                <option value="">All Subjects</option>
                {subjectsList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Chapter (Optional)</label>
              <select
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                disabled={!subject}
                className="w-full p-2.5 border rounded-lg text-sm disabled:opacity-50"
              >
                <option value="">All Chapters in {subject || 'Subject'}</option>
                {chaptersList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Difficulty Level</label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value as DifficultyFilter)}
                className="w-full p-2.5 border rounded-lg text-sm"
              >
                <option value="Basic">Basic</option>
                <option value="Medium">Medium</option>
                <option value="Advanced">Advanced</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Questions Count</label>
              <input
                type="number"
                min="1"
                required
                value={targetCount}
                onChange={e => setTargetCount(parseInt(e.target.value, 10))}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Assign to Student
            </button>
          </div>
        </form>
      )}

      {/* Assignments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assignments.length === 0 ? (
          <div className="col-span-2 bg-white border rounded-xl p-8 text-center text-gray-500 text-sm">
            No assignments created yet.
          </div>
        ) : (
          assignments.map(a => {
            const prog = getAssignmentProgress(a.id);
            const pct = Math.min(100, Math.round((prog.completedCount / a.target_count) * 100));

            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{a.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Scope: {[a.subject || 'All Subjects', a.chapter, a.level].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    a.status === 'completed' || prog.isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : a.status === 'cancelled'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {prog.isCompleted ? 'Completed' : a.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-indigo-600">{prog.completedCount} / {a.target_count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${prog.isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
                  <span>Due: {new Date(a.due_date).toLocaleDateString()}</span>
                  <div className="flex space-x-2">
                    {a.status === 'active' && !prog.isCompleted && (
                      <button
                        onClick={() => handleStatusChange(a.id, 'completed')}
                        className="text-emerald-600 hover:text-emerald-800 font-semibold"
                      >
                        Mark Done
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
