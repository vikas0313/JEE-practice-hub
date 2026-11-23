import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Clock, Eye, ShieldCheck, User, Laptop, Smartphone, Trash2, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getUserSessions, revokeUserSession, getSettings, updateStudentEmail } from '../../lib/db';
import { verifyPassword } from '../../lib/passwordHasher';

export default function StudentSettings() {
  const { user, refreshUser } = useAuth();
  const settings = getSettings();
  const [sessions, setSessions] = useState(() => (user ? getUserSessions(user.id) : []));

  // Change contact email state (Amendment 1 item 4.d)
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [passwordVerification, setPasswordVerification] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  if (!user) return null;

  const handleRevokeSession = (sessionId: string) => {
    revokeUserSession(sessionId);
    setSessions(getUserSessions(user.id));
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail.trim()) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setSavingEmail(true);
    try {
      // Must verify current password first per Amendment 1 item 4.d
      const { valid } = await verifyPassword(passwordVerification, user.password || '');
      if (!valid) {
        setEmailError('Incorrect password. Please enter your current account password to authorize changing your email.');
        setSavingEmail(false);
        return;
      }

      const res = updateStudentEmail(user.id, newEmail.trim(), user.id);
      if (!res.ok) {
        setEmailError(res.error || 'Failed to update email.');
        setSavingEmail(false);
        return;
      }

      setEmailSuccess('Your contact email address has been updated successfully.');
      setIsEditingEmail(false);
      setNewEmail('');
      setPasswordVerification('');
      refreshUser();
    } catch {
      setEmailError('An unexpected error occurred. Please try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Account Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Review your profile and transparency notices.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <User size={18} className="text-blue-600" />
          Profile Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block text-xs uppercase font-medium">Name</span>
            <span className="font-semibold text-gray-800">{user.name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase font-medium">Email</span>
            <span className="font-semibold text-gray-800">{user.email}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase font-medium">Role</span>
            <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
              Student (Class 12)
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase font-medium">Pacing Stopwatch</span>
            <span className="font-semibold text-gray-800">
              {user.stopwatch_visible ? 'Enabled (Controlled by monitor)' : 'Disabled by monitor'}
            </span>
          </div>
        </div>

        {/* Change Contact Email (Amendment 1 item 4.d) */}
        <div className="pt-3 border-t border-gray-100">
          {emailSuccess && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{emailSuccess}</span>
            </div>
          )}

          {emailError && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{emailError}</span>
            </div>
          )}

          {!isEditingEmail ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-700 block">Contact Email Address</span>
                <span className="text-xs text-gray-500">
                  Used exclusively for password reset delivery. Unverified contact data.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingEmail(true);
                  setNewEmail(user.email);
                  setEmailError('');
                  setEmailSuccess('');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                Change Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdateEmail} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                <Mail size={14} className="text-blue-600" />
                <span>Update Contact Email</span>
              </div>
              <p className="text-[11px] text-gray-500">
                Enter your new email and confirm your current password to apply changes.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">New Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="your.new.email@example.com"
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Account Password (for confirmation)</label>
                <input
                  type="password"
                  required
                  value={passwordVerification}
                  onChange={e => setPasswordVerification(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingEmail(false);
                    setEmailError('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {savingEmail ? 'Saving...' : 'Save Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          Time Tracking Transparency Notice
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-2.5 items-start">
            <Clock size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p>
              Active time is recorded while you solve each question. Idle time or paused time is separated.
            </p>
          </div>
          <div className="flex gap-2.5 items-start">
            <Eye size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              Your guardian (monitor) accesses all timing analytics, topic speed comparisons, and question visit histories.
            </p>
          </div>
          <div className="flex gap-2.5 items-start">
            <ShieldCheck size={16} className="text-green-500 mt-0.5 shrink-0" />
            <p>
              Your student views are strictly focused on mastering concepts, marks, shortcuts, and solutions.
            </p>
          </div>
        </div>
      </div>

      {/* Account Security & Password Change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-600" />
          Account Security
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Session Management</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Sign out of all browsers and devices if you used a shared computer.
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out of all devices?')) {
                window.location.href = '/login';
              }
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
          >
            Sign Out Everywhere
          </button>
        </div>

        {/* Module E11 Active Sessions List */}
        {settings.flag_e11_account_security && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Your Signed-In Devices ({sessions.filter((s) => !s.is_revoked).length})
            </h4>
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">No other active sessions detected.</p>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {sess.device_summary.toLowerCase().includes('phone') ||
                    sess.device_summary.toLowerCase().includes('android') ||
                    sess.device_summary.toLowerCase().includes('ios') ? (
                      <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <Laptop className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{sess.device_summary}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            sess.is_revoked
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {sess.is_revoked ? 'Revoked' : 'Active'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        IP: {sess.ip_address ?? 'Local'} · Last active:{' '}
                        {new Date(sess.last_active_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!sess.is_revoked && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-2 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Trash2 size={11} /> Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Quick Tools & Downloads */}
      <div className="grid sm:grid-cols-2 gap-4">
        <a
          href="/results/download"
          className="p-5 bg-white border border-gray-200 hover:border-blue-400 rounded-xl shadow-xs transition group block"
        >
          <h3 className="font-semibold text-sm text-gray-800 group-hover:text-blue-600">
            Download My Results
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Export an Excel or PDF sheet of your completed questions and solutions with zero timing data.
          </p>
        </a>

        <a
          href="/help"
          className="p-5 bg-white border border-gray-200 hover:border-blue-400 rounded-xl shadow-xs transition group block"
        >
          <h3 className="font-semibold text-sm text-gray-800 group-hover:text-blue-600">
            Help & Guidelines
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Official NTA CBT marking schemes, mistake classification definitions, and exam rules.
          </p>
        </a>
      </div>
    </div>
  );
}

