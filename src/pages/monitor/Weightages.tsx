// ============================================================
// Chapter Weightages Editor (Phase 3: SRD FR-10.3, Section 6.1)
// Expected questions per chapter for paper simulation
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  getPatternProfiles, getChapterWeightages, setChapterWeightage,
  deriveDefaultWeightages, getSettings, getSubtopics, getConceptPrerequisites,
} from '../../lib/db';
import type { ChapterWeightage, PatternProfile, Subtopic, ConceptPrerequisite } from '../../lib/types';
import { buildConceptMap } from '../../lib/conceptMap';
import { GitFork, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WeightagesPage() {
  const settings = useMemo(() => getSettings(), []);
  const [profiles, setProfiles] = useState<PatternProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [weightages, setWeightages] = useState<ChapterWeightage[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [prerequisites, setPrerequisites] = useState<ConceptPrerequisite[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSubtopics(getSubtopics());
    setPrerequisites(getConceptPrerequisites());
  }, []);

  useEffect(() => {
    const list = getPatternProfiles();
    setProfiles(list);
    if (list.length > 0) {
      setSelectedProfileId(list[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      loadWeightages(selectedProfileId);
    }
  }, [selectedProfileId]);

  const loadWeightages = (profileId: string) => {
    let list = getChapterWeightages(profileId);
    if (list.length === 0) {
      list = deriveDefaultWeightages(profileId);
    }
    setWeightages(list);
  };

  const handleWeightChange = (cw: ChapterWeightage, val: number) => {
    if (isNaN(val) || val < 0) return;
    setChapterWeightage({
      pattern_profile_id: cw.pattern_profile_id,
      subject: cw.subject,
      chapter: cw.chapter,
      expected_questions: Number(val.toFixed(2)),
      is_manual_override: true,
    });
    loadWeightages(cw.pattern_profile_id);
    setMessage(`Updated ${cw.chapter} weightage to ${val}`);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleResetToDerived = () => {
    if (window.confirm('Reset all chapter weightages to the derived NTA paper distribution?')) {
      deriveDefaultWeightages(selectedProfileId);
      loadWeightages(selectedProfileId);
      setMessage('Reset to derived distribution successfully!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const filtered = weightages.filter(w => filterSubject === 'All' || w.subject === filterSubject);

  // Group totals
  const totalQuestions = weightages.reduce((acc, curr) => acc + curr.expected_questions, 0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chapter Weightages Table</h1>
          <p className="text-sm text-gray-600">
            Defines the expected question allocation per chapter across a standard 75-question JEE Main paper.
          </p>
        </div>
        <button
          onClick={handleResetToDerived}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700 transition"
        >
          Reset to Derived NTA Distribution
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Filter and Profile Selector */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-gray-500 uppercase">Pattern Profile:</label>
          <select
            value={selectedProfileId}
            onChange={e => setSelectedProfileId(e.target.value)}
            className="p-2 border rounded-lg text-sm bg-gray-50 font-medium"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Physics', 'Chemistry', 'Mathematics'].map(subj => (
            <button
              key={subj}
              onClick={() => setFilterSubject(subj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterSubject === subj
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>

        <div className="text-xs text-gray-600 font-medium">
          Total Expected Questions in Paper: <strong className="text-indigo-600">{totalQuestions.toFixed(1)}</strong> / 75
        </div>
      </div>

      {/* Weightages Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
              <th className="p-3">Subject</th>
              <th className="p-3">Chapter</th>
              <th className="p-3">Expected Questions</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cw => (
              <tr key={cw.id} className="border-b hover:bg-gray-50/50">
                <td className="p-3 font-semibold text-gray-900">{cw.subject}</td>
                <td className="p-3 text-gray-800">{cw.chapter}</td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={cw.expected_questions}
                    onChange={e => handleWeightChange(cw, parseFloat(e.target.value))}
                    className="w-24 p-1.5 border rounded text-sm text-center font-bold text-gray-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="p-3">
                  {cw.is_manual_override ? (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200">
                      Manual Override
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                      Derived NTA
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Module E2: Prerequisite Concept Map */}
      {settings.flag_e2_concept_map && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-md tracking-wider uppercase">
                  Module E2
                </span>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <GitFork size={18} className="text-indigo-600" />
                  Subtopic Taxonomy &amp; Prerequisite Concept Map
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Visualizes prerequisite dependencies between subtopics to avoid conceptual deadlocks and evaluate student readiness.
              </p>
            </div>
          </div>

          {subtopics.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-4 text-center">
              No subtopics or prerequisite relationships registered yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {buildConceptMap(subtopics, prerequisites, new Set()).map((node) => (
                <div
                  key={node.subtopic.id}
                  className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900">{node.subtopic.name}</span>
                    <span className="text-[10px] font-semibold text-gray-500">
                      Step #{node.subtopic.order_index}
                    </span>
                  </div>

                  {node.prerequisites.length > 0 && (
                    <div className="text-[11px] text-gray-600 space-y-0.5">
                      <span className="font-semibold text-gray-500 block">Requires:</span>
                      {node.prerequisites.map((p) => (
                        <div key={p.id} className="flex items-center gap-1 text-indigo-700 font-medium">
                          <span>↳ {p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {node.dependents.length > 0 && (
                    <div className="text-[11px] text-gray-600 space-y-0.5 pt-1 border-t border-gray-100">
                      <span className="font-semibold text-gray-500 block">Enables:</span>
                      {node.dependents.map((d) => (
                        <div key={d.id} className="flex items-center gap-1 text-emerald-700 font-medium">
                          <span>→ {d.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
