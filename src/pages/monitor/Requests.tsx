import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import {
  getPendingStudents,
  approveStudent,
  deleteStudentAccount,
  getSettings,
  updateSettings,
} from '../../lib/db';
import type { Profile } from '../../lib/types';
import {
  UserCheck,
  Clock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Requests() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => getSettings());
  const [pendingStudents, setPendingStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Profile | null>(null);

  const loadData = () => {
    setSettings(getSettings());
    setPendingStudents(getPendingStudents());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = (student: Profile) => {
    if (!user) return;
    const res = approveStudent(student.id, user.id);
    if (res.ok) {
      setActionSuccess(`Approved ${student.first_name || student.name || student.email}. They can now log in and practice.`);
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingStudent) return;
    const res = deleteStudentAccount(deletingStudent.id);
    if (res.ok) {
      setActionSuccess(`Deleted registration for ${deletingStudent.email}.`);
      setDeletingStudent(null);
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleToggleRequireApproval = (enabled: boolean) => {
    updateSettings({ require_approval: enabled });
    loadData();
    setActionSuccess(
      enabled
        ? 'Monitor approval requirement enabled. Future registrations will require your manual approval.'
        : 'Instant access enabled. Future registrations will receive immediate access without approval.'
    );
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const filteredPending = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingStudents;
    return pendingStudents.filter(
      s =>
        s.email.toLowerCase().includes(q) ||
        (s.first_name && s.first_name.toLowerCase().includes(q)) ||
        (s.last_name && s.last_name.toLowerCase().includes(q)) ||
        (s.college_name && s.college_name.toLowerCase().includes(q))
    );
  }, [pendingStudents, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Registration Requests</h1>
          <p className="text-sm text-gray-600">
            Review and approve student accounts before they are granted access to questions and practice data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <Link
            to="/monitor/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm transition-colors"
          >
            <Sliders size={15} />
            Settings
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Dormant / Instant Access Notice */}
      {!settings.require_approval && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-blue-900 text-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-blue-950">Approval Queue is Dormant (Instant Access Enabled)</p>
              <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                By default under Amendment 1, students receive immediate active access upon registration without waiting for monitor approval.
                New students appear directly in the <Link to="/monitor/students" className="underline font-semibold hover:text-blue-950">Students Directory</Link>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleRequireApproval(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-100 rounded-lg border border-blue-300 shadow-sm transition shrink-0"
          >
            Enable Approval Requirement
          </button>
        </div>
      )}

      {settings.require_approval && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-950">Manual Approval is Active</p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                New accounts start in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">pending_approval</code> and read zero data rows until you approve them below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleRequireApproval(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 shadow-sm transition shrink-0"
          >
            Switch to Instant Access
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700">
            <Clock size={14} className="text-gray-500" />
            Pending Approval ({pendingStudents.length})
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, college..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Pending Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredPending.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShieldCheck size={40} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="text-base font-semibold text-gray-900">All caught up!</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {settings.require_approval
                ? 'There are no students awaiting approval at this time. When a student registers, their request will appear here.'
                : 'Instant access is currently enabled. All registered students are active and accessible in the Students tab.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Age</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4">Consents</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredPending.map(student => {
                  const isMinor = student.age !== undefined && student.age < 18;
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                          <Mail size={12} />
                          {student.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {student.college_name || <span className="text-gray-400 italic">Not provided</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-gray-800">{student.age ?? '—'}</span>
                        {isMinor && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                            Minor
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {student.requested_at
                          ? new Date(student.requested_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 size={12} />
                            Tracking Consent
                          </span>
                          {isMinor && (
                            <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                              <CheckCircle2 size={12} />
                              Guardian Consent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(student)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
                            title="Approve student registration"
                          >
                            <UserCheck size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => setDeletingStudent(student)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium rounded-md transition-colors"
                            title="Delete registration"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Delete Registration?</h3>
            <p className="text-xs text-gray-600">
              Permanently remove registration for <strong className="text-gray-900">{deletingStudent.email}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
