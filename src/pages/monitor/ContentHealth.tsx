// ============================================================
// Monthly Content Health & Diagnostics Console (Phase 6 M9)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { generateContentHealthReport, ContentHealthReport } from '../../lib/contentHealth';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, Image, FileText,
  BookOpen, Link2, ArrowRight, RefreshCw, ExternalLink, ShieldCheck,
} from 'lucide-react';

export default function ContentHealthPage() {
  const [report, setReport] = useState<ContentHealthReport | null>(null);
  const [activeTab, setActiveTab] = useState<'figures' | 'solutions' | 'papers' | 'chapters' | 'links'>('figures');

  useEffect(() => {
    runReport();
  }, []);

  const runReport = () => {
    setReport(generateContentHealthReport());
  };

  if (!report) {
    return <div className="p-8 text-center text-gray-500">Loading content diagnostics...</div>;
  }

  const getStatusBadge = () => {
    switch (report.overallStatus) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Healthy Pool ({report.healthScorePct}%)
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
            <AlertTriangle size={14} className="text-amber-600" />
            Minor Issues Detected ({report.healthScorePct}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">
            <XCircle size={14} className="text-rose-600" />
            Action Required ({report.healthScorePct}%)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-indigo-600" />
            Monthly Content Health & Diagnostics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated integrity audit detecting broken figures, unverified solutions, missing answer keys, and syllabus gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            onClick={runReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <RefreshCw size={13} />
            Rerun Audit
          </button>
        </div>
      </div>

      {/* Annual Refresh Banner Link */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-indigo-950">
        <div>
          <strong className="font-semibold block text-indigo-900">Annual Refresh & Syllabus Update Procedure</strong>
          <span className="text-xs text-indigo-800">
            Adding the next year's exam session papers (e.g. 2027) or updating the syllabus? Follow the step-by-step procedure.
          </span>
        </div>
        <a
          href="/docs/annual-refresh-procedure.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shrink-0 shadow-xs"
        >
          View Refresh Playbook <ExternalLink size={12} />
        </a>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('figures')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'figures' ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">Broken Figures</span>
            <Image size={16} className={report.brokenFigures.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
          <span className={`text-2xl font-black ${report.brokenFigures.length > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
            {report.brokenFigures.length}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">Missing diagrams</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('solutions')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'solutions' ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">Unverified Sols</span>
            <ShieldCheck size={16} className={report.unverifiedSolutions.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
          </div>
          <span className={`text-2xl font-black ${report.unverifiedSolutions.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {report.unverifiedSolutions.length}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">Need peer review</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('papers')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'papers' ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">Incomplete Papers</span>
            <FileText size={16} className={report.incompletePapers.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
          <span className={`text-2xl font-black ${report.incompletePapers.length > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
            {report.incompletePapers.length}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">&lt; 75 Qs or no key</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chapters')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'chapters' ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">Empty Chapters</span>
            <BookOpen size={16} className={report.zeroQuestionChapters.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
          </div>
          <span className={`text-2xl font-black ${report.zeroQuestionChapters.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {report.zeroQuestionChapters.length}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">0 Qs in syllabus</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'links' ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold">Invalid Links</span>
            <Link2 size={16} className={report.brokenResourceLinks.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
          <span className={`text-2xl font-black ${report.brokenResourceLinks.length > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
            {report.brokenResourceLinks.length}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">Malformed URLs</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Figures Tab */}
        {activeTab === 'figures' && (
          <div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Broken or Missing Figure Attachments</h2>
                <p className="text-xs text-gray-500">Questions marked as requiring figures but missing clean SVG diagrams.</p>
              </div>
            </div>
            {report.brokenFigures.length === 0 ? (
              <div className="p-12 text-center text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="font-semibold text-gray-800">All required figures are attached cleanly!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">Q#</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.brokenFigures.map(q => (
                      <tr key={q.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-mono font-medium text-gray-900">Q#{q.number}</td>
                        <td className="py-3 px-4 text-xs">{q.type}</td>
                        <td className="py-3 px-4 text-xs">{q.difficulty}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                            {q.figure_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/monitor/questions/${q.id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                          >
                            Edit Question <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Solutions Tab */}
        {activeTab === 'solutions' && (
          <div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Unverified or Missing Solutions</h2>
                <p className="text-xs text-gray-500">Solutions pending peer review or algorithmic verification.</p>
              </div>
              <Link
                to="/monitor/review"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                Go to Review Queue <ArrowRight size={12} />
              </Link>
            </div>
            {report.unverifiedSolutions.length === 0 ? (
              <div className="p-12 text-center text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="font-semibold text-gray-800">Every question in the active pool has a verified solution!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">Q#</th>
                      <th className="py-3 px-4">Paper</th>
                      <th className="py-3 px-4">Issue Description</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.unverifiedSolutions.map(({ question: q, reason }) => (
                      <tr key={q.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-mono font-medium text-gray-900">Q#{q.number}</td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-500">{q.paper_id.slice(0, 10)}</td>
                        <td className="py-3 px-4 text-xs text-amber-700">{reason}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/monitor/questions/${q.id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                          >
                            Edit <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Papers Tab */}
        {activeTab === 'papers' && (
          <div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Incomplete Exam Papers</h2>
                <p className="text-xs text-gray-500">Papers with fewer than standard questions or missing answer keys.</p>
              </div>
              <Link
                to="/monitor/papers"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                Paper Registry <ArrowRight size={12} />
              </Link>
            </div>
            {report.incompletePapers.length === 0 ? (
              <div className="p-12 text-center text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="font-semibold text-gray-800">All registered papers have complete question pools and answer keys!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">Paper Name</th>
                      <th className="py-3 px-4">Year & Session</th>
                      <th className="py-3 px-4">Questions Loaded</th>
                      <th className="py-3 px-4">Missing Keys</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.incompletePapers.map(({ paper, questionCount, missingKeysCount }) => (
                      <tr key={paper.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-semibold text-gray-900">{paper.exam} {paper.year} {paper.shift || ''}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{paper.year} • {paper.session}</td>
                        <td className="py-3 px-4 text-xs font-mono">{questionCount} Qs (expected 75+)</td>
                        <td className="py-3 px-4 text-xs">
                          {missingKeysCount > 0 ? (
                            <span className="text-rose-600 font-bold">{missingKeysCount} missing</span>
                          ) : (
                            <span className="text-emerald-600">Complete</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to="/monitor/import"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                          >
                            Import Missing <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Chapters Tab */}
        {activeTab === 'chapters' && (
          <div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Syllabus Chapters with Zero Questions</h2>
                <p className="text-xs text-gray-500">Chapters defined in the taxonomy that have no practice questions attached.</p>
              </div>
            </div>
            {report.zeroQuestionChapters.length === 0 ? (
              <div className="p-12 text-center text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="font-semibold text-gray-800">Every syllabus chapter has active questions available!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Chapter Name</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.zeroQuestionChapters.map(({ chapter, subjectName }) => (
                      <tr key={chapter.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-medium text-gray-900 text-xs">{subjectName}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-gray-800">{chapter.name}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to="/monitor/import"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                          >
                            Add Questions <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Malformed or Insecure Resource Links</h2>
                <p className="text-xs text-gray-500">Curated external links failing http/https URL protocol validation.</p>
              </div>
              <Link
                to="/monitor/resource-links"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                Manage Links <ArrowRight size={12} />
              </Link>
            </div>
            {report.brokenResourceLinks.length === 0 ? (
              <div className="p-12 text-center text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="font-semibold text-gray-800">All curated resource links are valid and secure!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">URL</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.brokenResourceLinks.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{l.title}</td>
                        <td className="py-3 px-4 text-xs font-mono text-rose-600">{l.url}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to="/monitor/resource-links"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                          >
                            Fix Link <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
