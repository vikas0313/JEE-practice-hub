// ============================================================
// JEE Practice Hub — Topic CSV Importer (Step 7)
// Dry-run diff, conflict detection, and idempotent batch import
// ============================================================

import React, { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import {
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
  getSyllabusSubtopics,
  insertSyllabusTopic,
  insertSyllabusSubtopic,
  insertAuditLog,
} from '../../lib/db';
import { normalizeSyllabusName, generateSlug, generateTopicImportTemplateCsv } from '../../lib/syllabusSeed';
import { resolveSyllabusChapter } from '../../lib/syllabusImportValidation';
import type { SyllabusChapter, SyllabusTopic } from '../../lib/types';
import { Upload, Download, CheckCircle, AlertTriangle, ArrowLeft, Layers, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ParsedCsvRow {
  rowNum: number;
  subject: string;
  chapter: string;
  topic: string;
  subtopic?: string;
  resolvedSubjectId?: string;
  resolvedChapter?: SyllabusChapter;
  status: 'new_topic' | 'existing_topic_new_subtopic' | 'already_exists' | 'invalid_chapter' | 'invalid_subject';
  message: string;
}

export default function ImportTopics() {
  const [csvContent, setCsvContent] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [applyResult, setApplyResult] = useState<{ topicsAdded: number; subtopicsAdded: number } | null>(null);

  const handleDownloadTemplate = () => {
    const csv = generateTopicImportTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topic_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeCsv = (rawText: string) => {
    setCsvContent(rawText);
    setApplyResult(null);

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length === 0) {
      setParsedRows([]);
      setAnalyzed(false);
      return;
    }

    const subjects = getSyllabusSubjects();
    const allChapters = getSyllabusChapters();
    const allTopics = getSyllabusTopics();
    const allSubtopics = getSyllabusSubtopics();

    // Check header
    let startIndex = 0;
    const header = lines[0].toLowerCase();
    if (header.includes('subject') && header.includes('chapter')) {
      startIndex = 1;
    }

    const rows: ParsedCsvRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 3) continue;

      const [subStr, chStr, topStr, subtopStr] = parts;
      const rowNum = i + 1;

      // 1. Resolve Subject
      const normSub = normalizeSyllabusName(subStr);
      const sylSub = subjects.find(s => normalizeSyllabusName(s.name) === normSub);
      if (!sylSub) {
        rows.push({
          rowNum,
          subject: subStr,
          chapter: chStr,
          topic: topStr,
          subtopic: subtopStr,
          status: 'invalid_subject',
          message: `Subject "${subStr}" not recognized.`,
        });
        continue;
      }

      // 2. Resolve Chapter
      const chRes = resolveSyllabusChapter(sylSub.id, chStr);
      if (!chRes) {
        rows.push({
          rowNum,
          subject: subStr,
          chapter: chStr,
          topic: topStr,
          subtopic: subtopStr,
          status: 'invalid_chapter',
          message: `Chapter "${chStr}" not recognized or inactive.`,
        });
        continue;
      }

      const chapter = chRes.chapter;

      // 3. Check Topic
      const existingTopic = allTopics.find(
        t => t.chapter_id === chapter.id && normalizeSyllabusName(t.name) === normalizeSyllabusName(topStr)
      );

      if (!existingTopic) {
        rows.push({
          rowNum,
          subject: subStr,
          chapter: chStr,
          topic: topStr,
          subtopic: subtopStr,
          resolvedSubjectId: sylSub.id,
          resolvedChapter: chapter,
          status: 'new_topic',
          message: `New topic to add under "${chapter.name}".`,
        });
      } else {
        // Topic exists, check subtopic
        if (subtopStr && subtopStr.trim()) {
          const normSubtop = normalizeSyllabusName(subtopStr);
          const existingSubtop = allSubtopics.find(
            st => st.topic_id === existingTopic.id && normalizeSyllabusName(st.name) === normSubtop
          );
          if (!existingSubtop) {
            rows.push({
              rowNum,
              subject: subStr,
              chapter: chStr,
              topic: topStr,
              subtopic: subtopStr,
              resolvedSubjectId: sylSub.id,
              resolvedChapter: chapter,
              status: 'existing_topic_new_subtopic',
              message: `Topic exists; adding new subtopic "${subtopStr}".`,
            });
          } else {
            rows.push({
              rowNum,
              subject: subStr,
              chapter: chStr,
              topic: topStr,
              subtopic: subtopStr,
              resolvedSubjectId: sylSub.id,
              resolvedChapter: chapter,
              status: 'already_exists',
              message: 'Topic and subtopic already exist. Will skip.',
            });
          }
        } else {
          rows.push({
            rowNum,
            subject: subStr,
            chapter: chStr,
            topic: topStr,
            subtopic: subtopStr,
            resolvedSubjectId: sylSub.id,
            resolvedChapter: chapter,
            status: 'already_exists',
            message: 'Topic already exists. Will skip.',
          });
        }
      }
    }

    setParsedRows(rows);
    setAnalyzed(true);
  };

  const handleApplyImport = () => {
    let topicsAdded = 0;
    let subtopicsAdded = 0;

    const topicCache = new Map<string, string>(); // `${chapterId}:${normalizedTopicName}` -> topicId

    for (const r of parsedRows) {
      if (r.status === 'invalid_chapter' || r.status === 'invalid_subject' || r.status === 'already_exists') {
        continue;
      }

      if (!r.resolvedChapter) continue;

      let topicId: string | null = null;
      const cacheKey = `${r.resolvedChapter.id}:${normalizeSyllabusName(r.topic)}`;

      if (r.status === 'new_topic') {
        if (topicCache.has(cacheKey)) {
          topicId = topicCache.get(cacheKey)!;
        } else {
          const newTopic = insertSyllabusTopic({
            id: uuid(),
            chapter_id: r.resolvedChapter.id,
            name: r.topic.trim(),
            slug: generateSlug(r.topic.trim()),
            sort_order: 1,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          topicId = newTopic.id;
          topicCache.set(cacheKey, topicId);
          topicsAdded++;
        }
      } else if (r.status === 'existing_topic_new_subtopic') {
        const existingTopic = getSyllabusTopics(r.resolvedChapter.id).find(
          t => normalizeSyllabusName(t.name) === normalizeSyllabusName(r.topic)
        );
        topicId = existingTopic ? existingTopic.id : null;
      }

      // Add subtopic if specified
      if (topicId && r.subtopic && r.subtopic.trim()) {
        const existingSubtops = getSyllabusSubtopics(topicId);
        if (!existingSubtops.some(st => normalizeSyllabusName(st.name) === normalizeSyllabusName(r.subtopic!))) {
          insertSyllabusSubtopic({
            id: uuid(),
            topic_id: topicId,
            name: r.subtopic.trim(),
            slug: generateSlug(r.subtopic.trim()),
            sort_order: existingSubtops.length + 1,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          subtopicsAdded++;
        }
      }
    }

    insertAuditLog({
      id: uuid(),
      user_id: 'monitor',
      action: 'syllabus_topics_batch_imported',
      entity_type: 'syllabus_topic',
      entity_id: null,
      details: { topicsAdded, subtopicsAdded, totalRows: parsedRows.length },
      created_at: new Date().toISOString(),
    });

    setApplyResult({ topicsAdded, subtopicsAdded });
    // Re-analyze
    handleAnalyzeCsv(csvContent);
  };

  const newTopicsCount = parsedRows.filter(r => r.status === 'new_topic').length;
  const newSubtopicsCount = parsedRows.filter(r => r.status === 'existing_topic_new_subtopic').length;
  const errorCount = parsedRows.filter(r => r.status === 'invalid_chapter' || r.status === 'invalid_subject').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <Link
          to="/monitor/syllabus"
          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Syllabus Tree
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
          <Upload className="text-indigo-600" size={24} />
          Batch Topic &amp; Subtopic Importer
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Populate granular topics under the 92 canonical chapters via CSV. Dry-run diff shows additions and prevents conflicts.
        </p>
      </div>

      {/* Action card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-gray-900">Upload or Paste CSV</span>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
          >
            <Download size={14} />
            Download Blank Template CSV
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            CSV Format: <code>subject,chapter,topic,subtopic</code>
          </label>
          <textarea
            value={csvContent}
            onChange={e => handleAnalyzeCsv(e.target.value)}
            placeholder="Physics,PHY-004,Kinematics Graphs,Displacement-time graphs&#10;Chemistry,CHE-040,Integrated Rate Law,First order kinetics"
            rows={6}
            className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* File input fallback */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800">
            <span>Or upload .csv file</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = ev => handleAnalyzeCsv(ev.target?.result as string);
                r.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* Apply Result Banner */}
      {applyResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-900 text-sm flex items-center gap-2">
          <CheckCircle size={18} className="text-green-600" />
          <span>
            Import applied successfully: <strong>{applyResult.topicsAdded}</strong> topics added,{' '}
            <strong>{applyResult.subtopicsAdded}</strong> subtopics added.
          </span>
        </div>
      )}

      {/* Dry Run Diff */}
      {analyzed && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <span className="font-bold text-sm text-gray-900">Dry-Run Diff Preview</span>
              <div className="flex items-center gap-3 text-xs mt-1 text-gray-500">
                <span className="text-green-700 font-semibold">{newTopicsCount} New Topics</span>
                <span className="text-blue-700 font-semibold">{newSubtopicsCount} New Subtopics</span>
                {errorCount > 0 && <span className="text-red-700 font-semibold">{errorCount} Errors</span>}
              </div>
            </div>

            <button
              type="button"
              disabled={newTopicsCount === 0 && newSubtopicsCount === 0}
              onClick={handleApplyImport}
              className="px-4 py-2 bg-indigo-600 disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
            >
              Apply Changes ({newTopicsCount + newSubtopicsCount})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Chapter</th>
                  <th className="p-3">Topic</th>
                  <th className="p-3">Subtopic</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{r.rowNum}</td>
                    <td className="p-3 font-medium text-gray-900">{r.subject}</td>
                    <td className="p-3 font-mono">{r.chapter}</td>
                    <td className="p-3">{r.topic}</td>
                    <td className="p-3 text-gray-500">{r.subtopic || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                          r.status === 'new_topic'
                            ? 'bg-green-100 text-green-800'
                            : r.status === 'existing_topic_new_subtopic'
                            ? 'bg-blue-100 text-blue-800'
                            : r.status === 'already_exists'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.message}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

