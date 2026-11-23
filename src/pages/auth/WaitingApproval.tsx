import React from 'react';
import { useAuth } from '../../lib/auth';
import { Clock, LogOut } from 'lucide-react';

export default function WaitingApproval() {
  const { user, logout } = useAuth();

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
