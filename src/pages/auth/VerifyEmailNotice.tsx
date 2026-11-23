import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { verifyStudentEmail } from '../../lib/db';
import { Mail, CheckCircle2, LogOut, ArrowRight } from 'lucide-react';

export default function VerifyEmailNotice() {
  const { user, logout, refreshUser } = useAuth();
  const [simulated, setSimulated] = useState(false);

  const handleSimulateVerify = () => {
    if (!user) return;
    verifyStudentEmail(user.id);
    setSimulated(true);
    if (refreshUser) refreshUser();
    setTimeout(() => {
      window.location.href = '/waiting-approval';
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200">
          <Mail className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Verify Your Email Address
        </h1>

        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          We sent a verification link to <strong className="text-gray-900">{user?.email}</strong>. Please confirm your email to submit your registration for monitor approval.
        </p>

        {simulated ? (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 size={16} />
            <span>Email verified! Redirecting to approval queue...</span>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-left text-xs">
            <span className="font-bold text-gray-700 block mb-1">Local / Development Notice:</span>
            <p className="text-gray-500 mb-3">
              In production, click the link sent to your inbox. For local development or testing, use the button below to confirm immediately.
            </p>
            <button
              type="button"
              onClick={handleSimulateVerify}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Simulate Email Verification</span>
              <ArrowRight size={14} />
            </button>
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
