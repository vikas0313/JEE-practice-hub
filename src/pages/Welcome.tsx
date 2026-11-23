import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { updateProfile } from '../lib/db';
import { Clock, Eye, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Welcome() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'student') {
    navigate('/login', { replace: true });
    return null;
  }

  const handleAcknowledge = () => {
    const now = new Date().toISOString();
    updateProfile(user.id, {
      time_tracking_acknowledged: true,
      privacy_acknowledged_at: now,
    });
    refreshUser();
    navigate('/practice', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 space-y-6">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            First Time Notice
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Welcome to JEE Practice Hub</h1>
          <p className="text-sm text-gray-600 mt-1">
            Before you begin, please read this important information regarding practice transparency.
          </p>
        </div>

        <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
              <Clock size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Time per question is tracked</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Active time spent solving each question is recorded so we can analyze speed, pacing, and difficulty bottlenecks.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
              <Eye size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Your monitor can see your times</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Your guardian (monitor) sees active time per question, pause durations, and topic speed trends.
                You will see marks, solutions, and explanations, but not time analytics.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Bookmarks remain private</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Your bookmarks and personal revision markings are completely private to your account.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAcknowledge}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-xl font-semibold text-sm shadow-md transition-all"
        >
          <span>I understand — start practicing</span>
          <ArrowRight size={18} />
        </button>

        <p className="text-center text-xs text-gray-400">
          You can review this statement anytime in your account Settings.
        </p>
      </div>
    </div>
  );
}

