import React, { useState, useMemo } from 'react';
import { useAuth } from '../lib/auth';
import { generateStudentResultsExport } from '../lib/db';
import type { StudentResultExportRow } from '../lib/types';
import { formatCsvField, sanitizeRecordForExport } from '../lib/csvSanitizer';
import { Download, FileSpreadsheet, Printer, ShieldCheck, Filter } from 'lucide-react';

export default function StudentResultsDownload() {
  const { user } = useAuth();
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  const rows: StudentResultExportRow[] = useMemo(() => {
    if (!user) return [];
    try {
      return generateStudentResultsExport(user.id);
    } catch {
      return [];
    }
  }, [user]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (subjectFilter !== 'all' && r.subject.toLowerCase() !== subjectFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter === 'correct' && !r.is_correct) return false;
      if (statusFilter === 'incorrect' && r.is_correct) return false;
      return true;
    });
  }, [rows, subjectFilter, statusFilter]);

  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;

    // Header row
    const headers = [
      'Question ID',
      'Subject',
      'Chapter',
      'Type',
      'Your Answer',
      'Correct Answer',
      'Result',
      'Marks',
      'Mistake Cause',
      'Confidence',
      'Solution Summary',
    ];

    const csvContent = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          formatCsvField(r.question_id),
          formatCsvField(r.subject),
          formatCsvField(r.chapter),
          formatCsvField(r.question_type),
          formatCsvField(r.student_answer || 'Unattempted'),
          formatCsvField(r.correct_answer || 'N/A'),
          formatCsvField(r.is_correct ? 'Correct' : 'Incorrect'),
          r.marks_awarded,
          formatCsvField(r.error_tag || 'None'),
          formatCsvField(r.confidence_tag || 'Unrated'),
          formatCsvField((r.solution_text || '').slice(0, 150)),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jee_my_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = async () => {
    if (filteredRows.length === 0) return;

    const data = filteredRows.map((r) => sanitizeRecordForExport({
      'Question ID': r.question_id,
      Subject: r.subject,
      Chapter: r.chapter,
      Type: r.question_type,
      'Your Answer': r.student_answer || 'Unattempted',
      'Correct Answer': r.correct_answer || 'N/A',
      Result: r.is_correct ? 'Correct' : 'Incorrect',
      'Marks Awarded': r.marks_awarded,
      'Mistake Tag': r.error_tag || 'None',
      Confidence: r.confidence_tag || 'Unrated',
      Solution: r.solution_text || '',
    }));

    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Results');
    XLSX.writeFile(workbook, `jee_my_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Download My Practice & Exam Results</h1>
          <p className="text-sm text-gray-500 mt-1">
            Export a complete offline study sheet of questions, answers, and solutions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-semibold rounded-lg shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <Download size={16} />
            <span>Download CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet size={16} />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={filteredRows.length === 0}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <Printer size={16} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Privacy Guarantee Alert */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 flex items-start gap-3">
        <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-800">
          <span className="font-bold">Strict Privacy & Well-being Guarantee:</span>
          <p className="mt-0.5 text-xs text-emerald-700">
            This export contains only your submitted questions, solutions, correct answers, and mistake notes.
            In accordance with the JEE Practice Hub student visibility policy, all timing telemetry, pacing metrics, and attempt sequence data are strictly excluded.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-lg border border-gray-200 mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter size={16} className="text-gray-400" />
            <span className="font-medium">Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1 text-sm bg-gray-50 border border-gray-300 rounded-md focus:outline-blue-500"
            >
              <option value="all">All Subjects</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
              <option value="mathematics">Mathematics</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Result:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1 text-sm bg-gray-50 border border-gray-300 rounded-md focus:outline-blue-500"
            >
              <option value="all">All Questions</option>
              <option value="correct">Correct Only</option>
              <option value="incorrect">Mistakes / Review Needed</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500">
          Showing {filteredRows.length} of {rows.length} questions
        </div>
      </div>

      {/* Preview Table */}
      {filteredRows.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No completed questions match your selected filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold border-b border-gray-200">
                <tr>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Chapter</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">Your Answer</th>
                  <th className="p-3 text-center">Correct Answer</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Marks</th>
                  <th className="p-3">Mistake Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-semibold text-gray-900">{r.subject}</td>
                    <td className="p-3 text-xs text-gray-600 max-w-xs truncate">{r.chapter}</td>
                    <td className="p-3 text-center text-xs">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">
                        {r.question_type}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      {r.student_answer || <span className="text-gray-400 font-normal">None</span>}
                    </td>
                    <td className="p-3 text-center font-mono text-emerald-700 font-bold">
                      {r.correct_answer || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {r.is_correct ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                          Correct
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-bold rounded-full">
                          Incorrect
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {r.marks_awarded > 0 ? (
                        <span className="text-emerald-700">+{r.marks_awarded}</span>
                      ) : r.marks_awarded < 0 ? (
                        <span className="text-red-600">{r.marks_awarded}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {r.error_tag ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-medium">
                          {r.error_tag}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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

