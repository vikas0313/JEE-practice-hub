// ============================================================
// JEE Practice Hub — Controlled Syllabus Alias Manager (Step 6)
// Map alternate and legacy spellings to canonical chapters/topics
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import {
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  getSyllabusAliases,
  insertSyllabusAlias,
  deleteSyllabusAlias,
} from '../../lib/db';
import type {
  SyllabusSubject,
  SyllabusChapter,
  SyllabusTopic,
  SyllabusAlias,
  SyllabusAliasTargetType,
} from '../../lib/types';
import { ArrowRightLeft, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SyllabusAliases() {
  const [subjects, setSubjects] = useState<SyllabusSubject[]>([]);
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [aliases, setAliases] = useState<SyllabusAlias[]>([]);

  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');

  // New Alias Form
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newTargetType, setNewTargetType] = useState<SyllabusAliasTargetType>('chapter');
  const [newTargetId, setNewTargetId] = useState('');
  const [newAliasText, setNewAliasText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    const s = getSyllabusSubjects();
    setSubjects(s);
    if (s.length > 0 && !newSubjectId) {
      setNewSubjectId(s[0].id);
    }
    setChapters(getSyllabusChapters());
    setTopics(getSyllabusTopics());
    setAliases(getSyllabusAliases());
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAliases = useMemo(() => {
    if (filterSubjectId === 'all') return aliases;
    return aliases.filter(a => a.subject_id === filterSubjectId);
  }, [aliases, filterSubjectId]);

  const candidateTargets = useMemo(() => {
    if (newTargetType === 'chapter') {
      return chapters.filter(c => c.subject_id === newSubjectId);
    } else {
      const subjectChapters = chapters.filter(c => c.subject_id === newSubjectId).map(c => c.id);
      return topics.filter(t => subjectChapters.includes(t.chapter_id));
    }
  }, [newTargetType, newSubjectId, chapters, topics]);

  const handleCreateAlias = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newAliasText.trim() || !newTargetId || !newSubjectId) {
      setError('Please fill all fields.');
      return;
    }

    try {
      insertSyllabusAlias({
        id: uuid(),
        alias: newAliasText.trim(),
        target_type: newTargetType,
        target_id: newTargetId,
        subject_id: newSubjectId,
        created_by: 'monitor',
        created_at: new Date().toISOString(),
      });
      setNewAliasText('');
      setNewTargetId('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create alias.');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this alias?')) {
      deleteSyllabusAlias(id);
      loadData();
    }
  };

  const getTargetName = (alias: SyllabusAlias) => {
    if (alias.target_type === 'chapter') {
      const ch = chapters.find(c => c.id === alias.target_id);
      return ch ? `${ch.external_id || ''} ${ch.name}` : 'Unknown Chapter';
    } else {
      const t = topics.find(top => top.id === alias.target_id);
      return t ? t.name : 'Unknown Topic';
    }
  };

  const getSubjectName = (subjectId: string) => {
    const s = subjects.find(sub => sub.id === subjectId);
    return s ? s.name : 'Unknown';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/monitor/syllabus"
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to Syllabus Tree
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
            <ArrowRightLeft className="text-indigo-600" size={24} />
            Syllabus Alias Registry
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Resolve alternate, abbreviated, or historical spelling variants during content import.
          </p>
        </div>
      </div>

      {/* Add Alias Card */}
      <form
        onSubmit={handleCreateAlias}
        className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4"
      >
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <Plus size={16} className="text-indigo-600" />
          Register New Alias Mapping
        </h3>

        {error && (
          <div className="p-2 text-xs bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Subject</label>
            <select
              value={newSubjectId}
              onChange={e => {
                setNewSubjectId(e.target.value);
                setNewTargetId('');
              }}
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Target Type</label>
            <select
              value={newTargetType}
              onChange={e => {
                setNewTargetType(e.target.value as SyllabusAliasTargetType);
                setNewTargetId('');
              }}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="chapter">Chapter</option>
              <option value="topic">Topic</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Canonical Target</label>
            <select
              value={newTargetId}
              onChange={e => setNewTargetId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">-- Select Target --</option>
              {candidateTargets.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.external_id ? `${c.external_id} — ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Alias String</label>
            <input
              type="text"
              value={newAliasText}
              onChange={e => setNewAliasText(e.target.value)}
              placeholder="e.g. Laws of Motion"
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
          >
            Create Alias Mapping
          </button>
        </div>
      </form>

      {/* Aliases List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="font-bold text-sm text-gray-900">
            Registered Aliases ({filteredAliases.length})
          </span>
          <select
            value={filterSubjectId}
            onChange={e => setFilterSubjectId(e.target.value)}
            className="text-xs p-1.5 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {filteredAliases.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No aliases registered. Aliases are created automatically during chapter merges or added manually above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAliases.map(alias => (
              <div
                key={alias.id}
                className="p-3.5 flex items-center justify-between hover:bg-gray-50 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    "{alias.alias}"
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="font-semibold text-gray-900">{getTargetName(alias)}</span>
                  <span className="text-gray-400 capitalize">({alias.target_type})</span>
                  <span className="text-gray-400">[{getSubjectName(alias.subject_id)}]</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(alias.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded"
                  title="Delete alias"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

