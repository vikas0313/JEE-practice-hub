import React, { useState } from 'react';
import {
  getPatternProfiles,
  insertPatternProfile,
  updatePatternProfile,
  deletePatternProfile,
} from '../../lib/db';
import type { PatternProfile } from '../../lib/types';
import { v4 as uuid } from 'uuid';
import { Sliders, Plus, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react';

export default function PatternProfiles() {
  const [profiles, setProfiles] = useState<PatternProfile[]>(() => getPatternProfiles());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questionsPerSubject, setQuestionsPerSubject] = useState(25);
  const [mcqPerSubject, setMcqPerSubject] = useState(20);
  const [nvqPerSubject, setNvqPerSubject] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [marksCorrectMcq, setMarksCorrectMcq] = useState(4);
  const [marksWrongMcq, setMarksWrongMcq] = useState(-1);
  const [marksCorrectNvq, setMarksCorrectNvq] = useState(4);
  const [marksWrongNvq, setMarksWrongNvq] = useState(0);
  const [marksUnattempted, setMarksUnattempted] = useState(0);
  const [nvqAttemptRule, setNvqAttemptRule] = useState<'all' | 'any_5_of_10'>('any_5_of_10');
  const [nvqCap, setNvqCap] = useState<number | ''>(5);

  const resetForm = () => {
    setName('');
    setDescription('');
    setQuestionsPerSubject(25);
    setMcqPerSubject(20);
    setNvqPerSubject(5);
    setDurationMinutes(180);
    setMarksCorrectMcq(4);
    setMarksWrongMcq(-1);
    setMarksCorrectNvq(4);
    setMarksWrongNvq(0);
    setMarksUnattempted(0);
    setNvqAttemptRule('any_5_of_10');
    setNvqCap(5);
    setEditingId(null);
    setIsCreating(false);
  };

  const handleStartEdit = (p: PatternProfile) => {
    setEditingId(p.id);
    setIsCreating(false);
    setName(p.name);
    setDescription(p.description || '');
    setQuestionsPerSubject(p.questions_per_subject);
    setMcqPerSubject(p.mcq_per_subject);
    setNvqPerSubject(p.nvq_per_subject);
    setDurationMinutes(p.duration_minutes);
    setMarksCorrectMcq(p.marks_correct_mcq);
    setMarksWrongMcq(p.marks_wrong_mcq);
    setMarksCorrectNvq(p.marks_correct_nvq);
    setMarksWrongNvq(p.marks_wrong_nvq);
    setMarksUnattempted(p.marks_unattempted);
    setNvqAttemptRule(p.nvq_attempt_rule as 'all' | 'any_5_of_10');
    setNvqCap(p.nvq_attempt_limit_per_subject ?? (p.nvq_attempt_rule === 'any_5_of_10' ? 5 : ''));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data: Partial<PatternProfile> = {
      name: name.trim(),
      description: description.trim(),
      questions_per_subject: Number(questionsPerSubject),
      mcq_per_subject: Number(mcqPerSubject),
      nvq_per_subject: Number(nvqPerSubject),
      duration_minutes: Number(durationMinutes),
      marks_correct_mcq: Number(marksCorrectMcq),
      marks_wrong_mcq: Number(marksWrongMcq),
      marks_correct_nvq: Number(marksCorrectNvq),
      marks_wrong_nvq: Number(marksWrongNvq),
      marks_unattempted: Number(marksUnattempted),
      nvq_attempt_rule: nvqAttemptRule,
      nvq_attempt_limit_per_subject: nvqCap === '' ? null : Number(nvqCap),
      language_options: ['English'],
    };

    if (editingId) {
      updatePatternProfile(editingId, data);
    } else {
      const newP: PatternProfile = {
        id: uuid(),
        name: data.name!,
        description: data.description,
        questions_per_subject: data.questions_per_subject!,
        mcq_per_subject: data.mcq_per_subject!,
        nvq_per_subject: data.nvq_per_subject!,
        duration_minutes: data.duration_minutes!,
        marks_correct_mcq: data.marks_correct_mcq!,
        marks_wrong_mcq: data.marks_wrong_mcq!,
        marks_correct_nvq: data.marks_correct_nvq!,
        marks_wrong_nvq: data.marks_wrong_nvq!,
        marks_unattempted: data.marks_unattempted!,
        nvq_attempt_rule: data.nvq_attempt_rule!,
        nvq_attempt_limit_per_subject: data.nvq_attempt_limit_per_subject,
        language_options: ['English'],
        created_at: new Date().toISOString(),
      };
      insertPatternProfile(newP);
    }

    setProfiles(getPatternProfiles());
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (profiles.length <= 1) {
      alert('Cannot delete the last remaining pattern profile.');
      return;
    }
    if (confirm('Are you sure you want to delete this pattern profile?')) {
      deletePatternProfile(id);
      setProfiles(getPatternProfiles());
      if (editingId === id) resetForm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-600" />
            Exam Pattern Profiles
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure test structures, durations, scoring rules, and numerical question attempt limits.
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Profile
          </button>
        )}
      </div>

      {/* Editor Modal / Panel */}
      {(isCreating || editingId) && (
        <div className="bg-white border-2 border-emerald-500 rounded-xl p-6 shadow-md transition-all">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? 'Edit Pattern Profile' : 'New Exam Pattern Profile'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Profile Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. JEE Main 2026 Official"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Standard 3-hour 75-question pattern"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Structure & Duration</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">MCQ / Subject</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={mcqPerSubject}
                    onChange={e => setMcqPerSubject(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">NVQ / Subject</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={nvqPerSubject}
                    onChange={e => setNvqPerSubject(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Total / Subject</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={questionsPerSubject}
                    onChange={e => setQuestionsPerSubject(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Marking Scheme</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">MCQ Correct</label>
                  <input
                    type="number"
                    required
                    value={marksCorrectMcq}
                    onChange={e => setMarksCorrectMcq(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm font-semibold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">MCQ Wrong</label>
                  <input
                    type="number"
                    required
                    value={marksWrongMcq}
                    onChange={e => setMarksWrongMcq(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm font-semibold text-red-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">NVQ Correct</label>
                  <input
                    type="number"
                    required
                    value={marksCorrectNvq}
                    onChange={e => setMarksCorrectNvq(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm font-semibold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">NVQ Wrong</label>
                  <input
                    type="number"
                    required
                    value={marksWrongNvq}
                    onChange={e => setMarksWrongNvq(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm font-semibold text-red-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unattempted</label>
                  <input
                    type="number"
                    required
                    value={marksUnattempted}
                    onChange={e => setMarksUnattempted(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm text-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Numerical Question Rule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Attempt Policy</label>
                  <select
                    value={nvqAttemptRule}
                    onChange={e => setNvqAttemptRule(e.target.value as 'all' | 'any_5_of_10')}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="any_5_of_10">Any 5 of 10 (2021–2024 Era)</option>
                    <option value="all">Attempt All (2025 onwards / Standard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Attempt Cap Per Subject (Blank = Unlimited)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="None"
                    value={nvqCap}
                    onChange={e => setNvqCap(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    When capped, answers past this limit in question number order are awarded 0 marks.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm"
              >
                <Check className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Profiles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map(p => (
          <div
            key={p.id}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                    title="Edit profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500 block">Duration</span>
                  <span className="font-semibold text-gray-800">{p.duration_minutes} Mins</span>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500 block">Total Qs</span>
                  <span className="font-semibold text-gray-800">{p.questions_per_subject * 3} Qs</span>
                </div>
                <div className="bg-emerald-50 p-2 rounded text-emerald-900">
                  <span className="text-emerald-700 block">MCQ Marking</span>
                  <span className="font-semibold">+{p.marks_correct_mcq} / {p.marks_wrong_mcq}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded text-blue-900">
                  <span className="text-blue-700 block">NVQ Marking</span>
                  <span className="font-semibold">+{p.marks_correct_nvq} / {p.marks_wrong_nvq}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-100">
                <span className="font-medium text-gray-700">NVQ Policy: </span>
                {p.nvq_attempt_rule === 'any_5_of_10' ? 'Optional 5 of 10' : 'Attempt All'}
                {p.nvq_attempt_limit_per_subject ? ` (Capped at ${p.nvq_attempt_limit_per_subject})` : ''}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Languages: {p.language_options?.join(', ') || 'English'}</span>
              <span>ID: {p.id.slice(0, 8)}...</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
