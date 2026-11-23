import React from 'react';
import { useAuth } from '../../lib/auth';
import { XCircle, LogOut } from 'lucide-react';

export default function RejectedNotice() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
          <XCircle className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Your Request Was Not Approved
        </h1>

        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          The monitor reviewed your registration request and decided not to approve access at this time.
        </p>

        {user?.decision_note && (
          <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1">
              Note from Monitor:
            </span>
            <p className="text-xs text-amber-950 font-medium whitespace-pre-wrap">
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
