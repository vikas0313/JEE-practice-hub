import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getProfile } from '../../lib/db';
import { Clock, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function WaitingApproval() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const checkApprovalStatus = useCallback(() => {
    if (!user) return;
    setChecking(true);
    const fresh = getProfile(user.id);
    if (fresh && (fresh.status === 'active' || fresh.status === 'approved')) {
      refreshUser();
      setFeedback('Approved! Redirecting to JEE Practice Hub...');
      setTimeout(() => {
        navigate('/welcome', { replace: true });
      }, 700);
      return;
    }
    setTimeout(() => {
      setChecking(false);
      setFeedback('Still pending review by monitor. Please check back shortly.');
      setTimeout(() => setFeedback(null), 3500);
    }, 400);
  }, [user, refreshUser, navigate]);

  useEffect(() => {
    if (!user) return;

    // Immediate check on mount
    const fresh = getProfile(user.id);
    if (fresh && (fresh.status === 'active' || fresh.status === 'approved')) {
      refreshUser();
      navigate('/welcome', { replace: true });
      return;
    }

    // Auto-poll every 2.5 seconds to detect monitor approval instantly
    const interval = setInterval(() => {
      const p = getProfile(user.id);
      if (p && (p.status === 'active' || p.status === 'approved')) {
        refreshUser();
        navigate('/welcome', { replace: true });
      }
    }, 2500);

    const handleStorage = () => {
      const p = getProfile(user.id);
      if (p && (p.status === 'active' || p.status === 'approved')) {
        refreshUser();
        navigate('/welcome', { replace: true });
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('active-student-changed', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('active-student-changed', handleStorage);
    };
  }, [user, navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Clock className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Waiting for Monitor Approval
        </h1>

        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Your registration is pending review and approval by the monitor before you can access practice questions and exams.
        </p>

        {feedback && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-medium flex items-center justify-center gap-1.5">
            {feedback.startsWith('Approved') ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <RefreshCw size={14} className="text-blue-500 animate-spin shrink-0" />
            )}
            <span>{feedback}</span>
          </div>
        )}

        {user && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-left text-xs space-y-1.5 border border-gray-100">
            <div><span className="font-semibold text-gray-500">Name:</span> <span className="text-gray-900 font-medium">{user.name}</span></div>
            <div><span className="font-semibold text-gray-500">Email:</span> <span className="text-gray-900 font-medium">{user.email}</span></div>
            {user.college_name && (
              <div><span className="font-semibold text-gray-500">College:</span> <span className="text-gray-900 font-medium">{user.college_name}</span></div>
            )}
            {user.requested_at && (
              <div><span className="font-semibold text-gray-500">Requested:</span> <span className="text-gray-900 font-medium">{new Date(user.requested_at).toLocaleString()}</span></div>
            )}
            <div>
              <span className="font-semibold text-gray-500">Status:</span>{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                Pending Approval
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={checkApprovalStatus}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? 'Checking Status...' : 'Check Approval Status'}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
