import React, { useState } from 'react';
import { getAllQuestions } from '../../lib/db';
import { importControlledQuestions } from '../../lib/syllabusImportValidation';
import { importJeeMocksDb, isJeeMocksDbImported } from '../../lib/jeeMocksImporter';
import type { PilotQuestionRecord } from '../../lib/types';
import { Upload, CheckCircle2, AlertCircle, FileText, Sparkles, ShieldCheck, Database, RefreshCw } from 'lucide-react';

export default function Import() {
  const [jsonText, setJsonText] = useState('');
  const [allowUntagged, setAllowUntagged] = useState(false);
  const [importStatus, setImportStatus] = useState<{ imported: number; updated: number; skipped: number; errors: string[]; warnings: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [jeeMocksStats, setJeeMocksStats] = useState<{
    imported: boolean;
    topicsAdded?: number;
    questionsCount?: number;
    physicsQuestions?: number;
    chemistryQuestions?: number;
    mathQuestions?: number;
  }>({
    imported: isJeeMocksDbImported(),
  });

  const existingCount = getAllQuestions().length;

  const handleImportJeeMocks = () => {
    setLoading(true);
    try {
      const res = importJeeMocksDb();
      setJeeMocksStats({
        imported: true,
        topicsAdded: res.topicsAdded,
        questionsCount: res.questionsCount,
        physicsQuestions: res.physicsQuestions,
        chemistryQuestions: res.chemistryQuestions,
        mathQuestions: res.mathQuestions,
      });
      setImportStatus({
        imported: res.questionsCount,
        updated: 0,
        skipped: 0,
        errors: [],
        warnings: [`Imported ${res.questionsCount} questions and synchronized ${res.topicsAdded} syllabus topics from skunktank69/jee_mocks_db.`],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setImportStatus({
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [`Failed to ingest jee_mocks_db: ${msg}`],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessImport = (records: PilotQuestionRecord[]) => {
    setLoading(true);
    try {
      const result = importControlledQuestions(records, { allowUntagged });
      setImportStatus(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setImportStatus({ imported: 0, updated: 0, skipped: records.length, errors: [`Import failed: ${message}`], warnings: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const records = Array.isArray(parsed) ? parsed : [parsed];
        handleProcessImport(records);
      } catch (err) {
        setImportStatus({ imported: 0, updated: 0, skipped: 0, errors: ['Invalid JSON file format.'], warnings: [] });
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSamplePilot = async () => {
    setLoading(true);
    try {
      // In Vite we can import or fetch the pilot JSON
      const response = await fetch('/data/pilot_jee_main_2026_apr02_morning.json');
      if (response.ok) {
        const records = await response.json();
        handleProcessImport(records);
      } else {
        // Fallback: load directly from the json data we seeded
        const raw = await import('../../../data/pilot_jee_main_2026_apr02_morning.json');
        handleProcessImport((raw.default || raw) as unknown as PilotQuestionRecord[]);
      }
    } catch {
      // Direct require/import fallback
      try {
        const raw = await import('../../../data/pilot_jee_main_2026_apr02_morning.json');
        handleProcessImport((raw as { default?: PilotQuestionRecord[] }).default || (raw as unknown as PilotQuestionRecord[]));
      } catch (err) {
        setImportStatus({ imported: 0, updated: 0, skipped: 0, errors: ['Failed to load pilot data file.'], warnings: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualJsonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonText.trim()) return;

    try {
      const parsed = JSON.parse(jsonText.trim());
      const records = Array.isArray(parsed) ? parsed : [parsed];
      handleProcessImport(records);
    } catch {
      setImportStatus({ imported: 0, updated: 0, skipped: 0, errors: ['Invalid JSON syntax. Please check formatting.'], warnings: [] });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Content Ingestion & Import</h1>
        <p className="text-sm text-gray-600 mt-1">
          Import JEE Main questions in the standard JSON record format. Validation strictly verifies answer, tags, and source.
        </p>
      </div>

      {/* Database status banner */}
      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-500">Controlled Syllabus Validation</span>
          <p className="font-bold text-indigo-950 text-base">{existingCount} questions currently in database</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-indigo-900 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
            <input
              type="checkbox"
              checked={allowUntagged}
              onChange={e => setAllowUntagged(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">Allow unmapped (hidden from practice)</span>
          </label>
          <button
            type="button"
            onClick={handleLoadSamplePilot}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Sparkles size={16} />
            Load 6 Pilot Questions
          </button>
        </div>
      </div>

      {/* JEE Mocks DB (skunktank69/jee_mocks_db) Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl mt-0.5">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">JEE Mocks Question Repository</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  jeeMocksStats.imported
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {jeeMocksStats.imported ? 'Active & Synced' : 'Ready to Import'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Source: <a href="https://github.com/skunktank69/jee_mocks_db" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-medium">skunktank69/jee_mocks_db</a> — 7,321 curated questions across Physics, Chemistry, and Mathematics mapped to the 92 canonical syllabus chapters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleImportJeeMocks}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold text-sm rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {jeeMocksStats.imported ? 'Re-Sync Mocks DB' : 'Import All 7,321 Questions'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500 font-medium block">Total Questions</span>
            <span className="font-bold text-gray-900 text-sm">{jeeMocksStats.questionsCount ?? 7321}</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500 font-medium block">Physics</span>
            <span className="font-bold text-blue-700 text-sm">{jeeMocksStats.physicsQuestions ?? 2485}</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500 font-medium block">Chemistry</span>
            <span className="font-bold text-emerald-700 text-sm">{jeeMocksStats.chemistryQuestions ?? 2485}</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
            <span className="text-gray-500 font-medium block">Mathematics</span>
            <span className="font-bold text-purple-700 text-sm">{jeeMocksStats.mathQuestions ?? 2351}</span>
          </div>
        </div>
      </div>

      {/* Import Result Alert */}
      {importStatus && (
        <div className={`p-4 rounded-xl border ${
          importStatus.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            {importStatus.errors.length > 0 ? (
              <AlertCircle className="text-amber-600" size={20} />
            ) : (
              <CheckCircle2 className="text-green-600" size={20} />
            )}
            <span className="font-bold text-sm text-gray-900">
              {importStatus.imported} imported, {importStatus.updated} updated, {importStatus.skipped} skipped.
            </span>
          </div>
          {importStatus.warnings.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-semibold text-amber-700">Warnings:</span>
              <ul className="mt-1 space-y-1 text-xs text-amber-800 list-disc list-inside">
                {importStatus.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {importStatus.errors.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-semibold text-red-700">Errors:</span>
              <ul className="mt-1 space-y-1 text-xs text-red-800 list-disc list-inside">
                {importStatus.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* File Upload Box */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-500 transition-colors">
        <Upload size={36} className="mx-auto text-gray-400 mb-2" />
        <h3 className="font-bold text-gray-900 text-base">Upload JSON Question File</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Select a .json file containing an array of question records matching the pilot specification.
        </p>
        <label className="mt-4 inline-block">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <span className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-semibold text-sm rounded-xl cursor-pointer shadow-sm transition-colors inline-block">
            Browse JSON File
          </span>
        </label>
      </div>

      {/* Raw JSON Paste Area */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <FileText size={18} className="text-indigo-600" />
          Or Paste Raw JSON Records
        </h2>

        <form onSubmit={handleManualJsonSubmit} className="space-y-3">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={8}
            className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder='[ { "number": 1, "type": "MCQ", "subject": "Physics", ... } ]'
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !jsonText.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
            >
              Parse and Ingest
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

