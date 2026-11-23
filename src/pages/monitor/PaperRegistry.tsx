import React, { useState, useEffect } from 'react';
import {
  getPapers,
  getPatternProfiles,
  getMonitorProfile,
  verifyPaperProfile,
  transitionPaperStatus,
} from '../../lib/db';
import type { Paper, PatternProfile, PaperStatus } from '../../lib/types';
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, RotateCcw, ExternalLink } from 'lucide-react';

export default function PaperRegistry() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [profiles, setProfiles] = useState<PatternProfile[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [bulletinRef, setBulletinRef] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const monitor = getMonitorProfile();

  const loadData = () => {
    setPapers(getPapers());
    const profs = getPatternProfiles();
    setProfiles(profs);
    if (profs.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profs[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenVerify = (paper: Paper) => {
    setSelectedPaper(paper);
    setSelectedProfileId(paper.pattern_profile_id || (profiles[0]?.id ?? ''));
    setBulletinRef(paper.information_bulletin_ref || `JEE (Main) ${paper.year} Information Bulletin, NTA`);
    setModalOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleConfirmVerification = () => {
    if (!selectedPaper || !monitor) return;
    if (!bulletinRef.trim()) {
      setErrorMsg('Please specify the official Information Bulletin name and year.');
      return;
    }
    try {
      verifyPaperProfile(selectedPaper.id, monitor.id, selectedProfileId, bulletinRef.trim());
      setSuccessMsg(`Pattern profile successfully verified for ${selectedPaper.exam} ${selectedPaper.year} ${selectedPaper.shift}.`);
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed.');
    }
  };

  const handleTransition = (paper: Paper, newStatus: PaperStatus) => {
    if (!monitor) return;
    try {
      transitionPaperStatus(paper.id, newStatus, monitor.id);
      setSuccessMsg(`Paper status transitioned to '${newStatus}'.`);
      setErrorMsg(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Status transition failed.');
      setSuccessMsg(null);
    }
  };

  const getStatusBadge = (status: PaperStatus = 'registered') => {
    switch (status) {
      case 'published':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Published</span>;
      case 'ready':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Ready to Publish</span>;
      case 'in_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">In Review</span>;
      case 'rolled_back':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Rolled Back</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const activeProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paper Registry & Pattern Profiles</h1>
          <p className="text-sm text-gray-500">
            Verify official pattern profiles against official Information Bulletins before publishing papers.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Papers Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paper Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source & Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pattern Profile</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {papers.map((p) => {
              const isVerified = Boolean(p.profile_verified_at && p.pattern_profile_id);
              const prof = profiles.find(pr => pr.id === p.pattern_profile_id);
              return (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-gray-900">{p.exam} {p.year}</div>
                    <div className="text-xs text-gray-500">{p.session} • {p.date || 'Date N/A'} • {p.shift || 'Shift N/A'}</div>
                    {p.source_file_sha256 && (
                      <div className="text-[10px] text-gray-400 font-mono mt-1">SHA: {p.source_file_sha256.slice(0, 16)}...</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{p.source}</div>
                    <div className="text-xs text-gray-400">Key: {p.key_source || p.answer_key_source} ({p.key_status || 'final'})</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isVerified ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                          <ShieldCheck className="h-4 w-4" />
                          <span>{prof?.name || 'Verified Profile'}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Ref: {p.information_bulletin_ref}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Unverified Profile</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(p.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      onClick={() => handleOpenVerify(p)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                    >
                      {isVerified ? 'Re-verify' : 'Verify Profile'}
                    </button>

                    {p.status !== 'published' ? (
                      <button
                        onClick={() => handleTransition(p, 'published')}
                        disabled={!isVerified}
                        title={!isVerified ? 'Cannot publish: Verify pattern profile against official Information Bulletin first' : ''}
                        className={`px-3 py-1 rounded text-xs font-medium text-white shadow-sm ${
                          isVerified ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'
                        }`}
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTransition(p, 'rolled_back')}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium shadow-sm inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Roll Back
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Side-by-side Profile Verification Modal */}
      {modalOpen && selectedPaper && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-5">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Verify Pattern Profile — {selectedPaper.exam} {selectedPaper.year} ({selectedPaper.shift})
                </h3>
                <p className="text-xs text-gray-500">
                  Review the pattern profile against the official NTA Information Bulletin.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Paper First Page Summary */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Paper Metadata
                </h4>
                <div className="text-xs space-y-1.5 text-gray-600">
                  <div><strong>Exam:</strong> {selectedPaper.exam}</div>
                  <div><strong>Year:</strong> {selectedPaper.year}</div>
                  <div><strong>Session:</strong> {selectedPaper.session}</div>
                  <div><strong>Date / Shift:</strong> {selectedPaper.date} {selectedPaper.shift}</div>
                  <div><strong>Source:</strong> {selectedPaper.source}</div>
                  <div><strong>Key Source:</strong> {selectedPaper.key_source || selectedPaper.answer_key_source}</div>
                  {selectedPaper.source_file_sha256 && (
                    <div className="break-all"><strong>SHA-256:</strong> {selectedPaper.source_file_sha256}</div>
                  )}
                </div>
              </div>

              {/* Profile Rule Comparison */}
              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200 space-y-3">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Selected Pattern Profile
                </h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pattern Profile</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full text-xs rounded border-gray-300 p-1.5 bg-white"
                  >
                    {profiles.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.name} ({pr.duration_minutes} min)</option>
                    ))}
                  </select>
                </div>

                {activeProfile && (
                  <div className="text-xs space-y-1 text-gray-700">
                    <div><strong>Duration:</strong> {activeProfile.duration_minutes} mins</div>
                    <div><strong>Questions per subject:</strong> {activeProfile.questions_per_subject} ({activeProfile.mcq_per_subject} MCQ + {activeProfile.nvq_per_subject} NVQ)</div>
                    <div><strong>Marking (MCQ):</strong> +{activeProfile.marks_correct_mcq} / {activeProfile.marks_wrong_mcq}</div>
                    <div><strong>Marking (NVQ):</strong> +{activeProfile.marks_correct_nvq} / {activeProfile.marks_wrong_nvq}</div>
                    <div><strong>NVQ Rule:</strong> {activeProfile.nvq_attempt_rule}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Information Bulletin Reference Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Official Information Bulletin Reference (Name and Year only)
              </label>
              <input
                type="text"
                value={bulletinRef}
                onChange={(e) => setBulletinRef(e.target.value)}
                placeholder="e.g. JEE (Main) 2026 Information Bulletin, NTA Section 3.2"
                className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Confirm that questions per section, duration, and negative marking match this publication.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerification}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                Confirm & Verify Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
