import React from 'react';
import {
  Shield,
  Eye,
  Lock,
  Clock,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
  acknowledgedAt?: string | null;
}

export function PrivacyNoticeModal({
  isOpen,
  onClose,
  onAcknowledge,
  acknowledgedAt,
}: PrivacyNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-blue-900">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-black">Student Privacy & Transparency Notice</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed">
          JEE Practice Hub is designed strictly to support your exam preparation. To ensure complete trust, this notice outlines exactly what data is visible to your guardian (monitor) and what is strictly private.
        </div>

        {/* What the Monitor Sees */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-950 font-bold text-xs uppercase tracking-wider">
            <Eye className="w-4 h-4 text-blue-600" />
            <span>What Your Monitor Sees</span>
          </div>
          <ul className="text-xs text-blue-900 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>Active Time per Question:</strong> Time spent reading and solving each question.
            </li>
            <li>
              <strong>CBT Exam Telemetry:</strong> Question visit order, answer revisions, and full-screen exits during live exams.
            </li>
            <li>
              <strong>Score & Percentile Estimates:</strong> Progress against 99th percentile target maps.
            </li>
            <li>
              <strong>Mistake & Revision Notebook:</strong> Tagged wrong answers and questions flagged for review.
            </li>
          </ul>
        </div>

        {/* What is Completely Private */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>What is Completely Private & Never Tracked</span>
          </div>
          <ul className="text-xs text-emerald-900 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>Zero Audio/Video Surveillance:</strong> No webcam, microphone, or ambient recording whatsoever.
            </li>
            <li>
              <strong>Zero Keystroke Logging:</strong> No recording of keystrokes outside typed numerical math answers.
            </li>
            <li>
              <strong>Zero External Tracking:</strong> No tracking of tabs or apps outside the exam browser window.
            </li>
            <li>
              <strong>Private Bookmarks:</strong> Personal study bookmarks are visible only to you.
            </li>
            <li>
              <strong>Zero Student Emails:</strong> System notification emails and alerts are routed exclusively to your monitor. Your email is used only for account login.
            </li>
          </ul>
        </div>

        {acknowledgedAt && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Consent acknowledged on {new Date(acknowledgedAt).toLocaleDateString()} at{' '}
            {new Date(acknowledgedAt).toLocaleTimeString()}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {onAcknowledge ? (
            <button
              onClick={() => {
                onAcknowledge();
                onClose();
              }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
            >
              I Understand & Acknowledge
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

