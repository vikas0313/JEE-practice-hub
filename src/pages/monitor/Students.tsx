import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import {
  getAllStudents,
  suspendStudent,
  reinstateStudent,
  deleteStudentAccount,
  sendStudentPasswordReset,
  updateProfile,
  updateStudentEmail,
  getActiveSelectedStudentId,
  setActiveSelectedStudentId,
  getAllVisits,
  getAttempts,
} from '../../lib/db';
import type { Profile, AccountStatus } from '../../lib/types';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Edit2,
  Trash2,
  Shield,
  Clock,
  School,
  Calendar,
  Eye,
  Filter,
  Mail,
} from 'lucide-react';

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'active' | 'suspended' | 'pending_approval'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active selected student for scoping
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(() => getActiveSelectedStudentId());

  // Edit details modal state
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAge, setEditAge] = useState<number | ''>('');
  const [editCollege, setEditCollege] = useState('');

  // Change email modal state (Amendment 1)
  const [settingEmailStudent, setSettingEmailStudent] = useState<Profile | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');

  // Delete modal state
  const [deletingStudent, setDeletingStudent] = useState<Profile | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState('');

  // Last active timestamps map
  const [lastActiveMap, setLastActiveMap] = useState<Record<string, string>>({});

  const loadData = () => {
    const list = getAllStudents();
    setStudents(list);
    setSelectedStudentId(getActiveSelectedStudentId());

    // Calculate last active from visits and attempts
    const visits = getAllVisits();
    const attempts = getAttempts();
    const map: Record<string, string> = {};

    list.forEach(s => {
      let latestTime = 0;
      visits.forEach(v => {
        if (v.student_id === s.id && v.ended_at) {
          const t = new Date(v.ended_at).getTime();
          if (t > latestTime) latestTime = t;
        }
      });
      attempts.forEach(a => {
        if (a.student_id === s.id && a.started_at) {
          const t = new Date(a.started_at).getTime();
          if (t > latestTime) latestTime = t;
        }
      });
      if (latestTime > 0) {
        map[s.id] = new Date(latestTime).toISOString();
      }
    });

    setLastActiveMap(map);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectStudent = (id: string) => {
    setActiveSelectedStudentId(id);
    setSelectedStudentId(id);
    window.dispatchEvent(new Event('storage'));
    setActionSuccess('Switched active student for monitor views.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleSuspend = (s: Profile) => {
    const res = suspendStudent(s.id);
    if (res.ok) {
      setActionSuccess(`Suspended account for ${s.first_name || s.name || s.email}.`);
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error || 'Failed to suspend student.');
    }
  };

  const handleReinstate = (s: Profile) => {
    const res = reinstateStudent(s.id);
    if (res.ok) {
      setActionSuccess(`Reinstated account for ${s.first_name || s.name || s.email}.`);
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error || 'Failed to reinstate student.');
    }
  };

  const handlePasswordReset = (s: Profile) => {
    const res = sendStudentPasswordReset(s.email);
    if (res.ok) {
      setActionSuccess(res.message || `Password reset link prepared for ${s.email}.`);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const openEditModal = (s: Profile) => {
    setEditingStudent(s);
    setEditFirstName(s.first_name || '');
    setEditLastName(s.last_name || '');
    setEditAge(s.age ?? '');
    setEditCollege(s.college_name || '');
    setActionError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const ageNum = typeof editAge === 'number' ? editAge : parseInt(String(editAge), 10);
    if (isNaN(ageNum) || ageNum < 10 || ageNum > 99) {
      setActionError('Age must be between 10 and 99.');
      return;
    }

    const updated = updateProfile(editingStudent.id, {
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      name: `${editFirstName.trim()} ${editLastName.trim()}`.trim(),
      age: ageNum,
      college_name: editCollege.trim(),
    });

    if (updated) {
      setActionSuccess(`Updated details for ${updated.first_name} ${updated.last_name}.`);
      setEditingStudent(null);
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError('Failed to update profile.');
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingStudent) return;
    if (confirmEmailInput.trim().toLowerCase() !== deletingStudent.email.toLowerCase()) {
      setActionError('Entered email does not match.');
      return;
    }

    const res = deleteStudentAccount(deletingStudent.id);
    if (res.ok) {
      setActionSuccess(`Permanently deleted student account ${deletingStudent.email}.`);
      setDeletingStudent(null);
      setConfirmEmailInput('');
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error || 'Failed to delete account.');
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingEmailStudent || !user) return;
    const res = updateStudentEmail(settingEmailStudent.id, newEmailInput, user.id);
    if (res.ok) {
      setActionSuccess(`Email successfully updated to ${newEmailInput}.`);
      setSettingEmailStudent(null);
      setNewEmailInput('');
      loadData();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error || 'Failed to update email.');
    }
  };

  const filteredStudents = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return students.filter(s => {
      if (statusFilter === 'today') {
        const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
        if (dateStr !== todayStr) return false;
      } else if (statusFilter === 'active') {
        if (s.status !== 'active' && s.status !== 'approved') return false;
      } else if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        (s.first_name && s.first_name.toLowerCase().includes(q)) ||
        (s.last_name && s.last_name.toLowerCase().includes(q)) ||
        (s.college_name && s.college_name.toLowerCase().includes(q))
      );
    });
  }, [students, statusFilter, searchQuery]);

  const getStatusBadge = (status?: AccountStatus) => {
    switch (status) {
      case 'active':
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={11} /> Active
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={11} /> Pending Review
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800">
            <Lock size={11} /> Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {status || 'Active'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Directory</h1>
          <p className="text-sm text-gray-600">
            Manage student accounts, view activity, handle access suspension or edits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Total registered: {students.length}</span>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm animate-fade-in">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1">
            <Filter size={14} /> Filter:
          </span>
          {(['all', 'today', 'active', 'suspended', 'pending_approval'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status === 'today' ? 'New Today' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search student, college, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Users size={36} className="mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No students found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filter or search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-center">Active Target</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredStudents.map(student => {
                  const isSelected = selectedStudentId === student.id;
                  const lastActive = lastActiveMap[student.id];

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50/75 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              {student.first_name || student.name || 'Unnamed'}{' '}
                              {student.last_name || ''}
                              {student.incomplete_profile && (
                                <span
                                  className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded"
                                  title="Registered before full profile requirement"
                                >
                                  Legacy Profile
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {student.college_name || <span className="text-gray-400 italic">None</span>}
                        {student.age && <span className="text-xs text-gray-400 ml-1.5">({student.age} yrs)</span>}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(student.status)}</td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {student.requested_at
                          ? new Date(student.requested_at).toLocaleDateString()
                          : student.created_at
                          ? new Date(student.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {lastActive ? new Date(lastActive).toLocaleDateString() : <span className="text-gray-400">Never</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {student.status === 'approved' ? (
                          <button
                            onClick={() => handleSelectStudent(student.id)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                              isSelected
                                ? 'bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-300'
                                : 'bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-800'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : 'Select'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(student)}
                            className="p-1.5 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit student details"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            onClick={() => {
                              setSettingEmailStudent(student);
                              setNewEmailInput(student.email);
                              setActionError(null);
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Set new email address"
                          >
                            <Mail size={15} />
                          </button>

                          <button
                            onClick={() => handlePasswordReset(student)}
                            className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Send password reset"
                          >
                            <KeyRound size={15} />
                          </button>

                          {(student.status === 'approved' || student.status === 'active') && (
                            <button
                              onClick={() => handleSuspend(student)}
                              className="p-1.5 text-gray-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Suspend student access"
                            >
                              <Lock size={15} />
                            </button>
                          )}

                          {student.status === 'suspended' && (
                            <button
                              onClick={() => handleReinstate(student)}
                              className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Reinstate student access"
                            >
                              <Unlock size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setDeletingStudent(student);
                              setConfirmEmailInput('');
                              setActionError(null);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete student account"
                          >
                            <Trash2 size={15} />
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

      {/* Edit Details Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-gray-900">Edit Student Details</h3>
            <p className="text-xs text-gray-500">Updating profile for {editingStudent.email}</p>

            <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  min={10}
                  max={99}
                  required
                  value={editAge}
                  onChange={e => setEditAge(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">College / School Name</label>
                <input
                  type="text"
                  required
                  value={editCollege}
                  onChange={e => setEditCollege(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Student Email Modal (Amendment 1 item 4.c) */}
      {settingEmailStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Set New Email for Student</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Update the student's stored contact address. This action is audit-logged.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEmail} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Stored Email</label>
                <div className="text-xs font-mono bg-gray-50 p-2.5 rounded-lg text-gray-600 border border-gray-200">
                  {settingEmailStudent.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="new.email@example.com"
                  value={newEmailInput}
                  onChange={e => setNewEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettingEmailStudent(null);
                    setNewEmailInput('');
                  }}
                  className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Update Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Permanently Delete Student?</h3>
                <p className="text-xs text-gray-600 mt-1">
                  This action is irreversible. All responses, practice attempts, mistake notebook entries, and visits associated with this student will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800">
              To confirm, please type the student's email address:{' '}
              <strong className="font-mono text-gray-900">{deletingStudent.email}</strong>
            </div>

            <input
              type="text"
              placeholder={deletingStudent.email}
              value={confirmEmailInput}
              onChange={e => setConfirmEmailInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 font-mono"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingStudent(null);
                  setConfirmEmailInput('');
                }}
                className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmEmailInput.trim().toLowerCase() !== deletingStudent.email.toLowerCase()}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm"
              >
                Delete Student Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
