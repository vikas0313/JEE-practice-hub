import React from 'react';
import { useAuth } from '../../lib/auth';
import { PauseCircle, LogOut } from 'lucide-react';

export default function SuspendedNotice() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <PauseCircle className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Your Account is Paused
        </h1>

        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Access to your account has been temporarily suspended by the monitor. Your past practice history, results, and notes remain safely preserved.
        </p>

        {user?.decision_note && (
          <div className="mt-5 p-4 bg-gray-50 border border-gray-200 rounded-xl text-left">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
              Notice:
            </span>
            <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap">
              {user.decision_note}
            </p>
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
