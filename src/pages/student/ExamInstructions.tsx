import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getExam,
  getExamQuestions,
  getAttempts,
} from '../../lib/db';
import {
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  Monitor,
  ArrowLeft,
  Play,
  Lock,
} from 'lucide-react';
import { ExamPreStartCheck } from '../../components/ExamPreStartCheck';
import { isStandaloneMode } from '../../lib/pwa';

export default function ExamInstructions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [acknowledged, setAcknowledged] = useState(false);
  const [technicalCheckReady, setTechnicalCheckReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [monitorOverride, setMonitorOverride] = useState(false);

  const exam = useMemo(() => (id ? getExam(id) : null), [id]);
  const examQuestions = useMemo(() => (id ? getExamQuestions(id) : []), [id]);

  // Check if attempt already exists
  const existingAttempt = useMemo(() => {
    if (!id || !user) return null;
    return getAttempts().find(a => a.exam_id === id && a.student_id === user.id);
  }, [id, user]);

  useEffect(() => {
    // Detect mobile viewport or touch agent
    const checkMobile = () => {
      const mobileWidth = window.innerWidth < 768;
      const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(mobileWidth && touchDevice);
      setIsStandalone(isStandaloneMode());
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!exam) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Exam not found</h2>
        <Link to="/exams" className="text-blue-600 font-semibold text-sm">
          &larr; Return to Exams
        </Link>
      </div>
    );
  }

  if (existingAttempt && existingAttempt.ended_at !== null) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 bg-white p-8 rounded-3xl border border-gray-200">
        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Attempt Limit Reached</h2>
        <p className="text-sm text-gray-600 max-w-sm mx-auto">
          You have already completed this examination. One attempt per exam is strictly enforced.
        </p>
        <Link
          to={`/exam/${exam.id}/result`}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
        >
          View Your Results
        </Link>
      </div>
    );
  }

  const isBlockedByStandalone = isStandalone && !monitorOverride;

  const handleStartExam = async () => {
    if (!acknowledged || isMobile || isBlockedByStandalone || !technicalCheckReady) return;

    try {
      // Request full screen
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Full screen request ignored or denied by browser:', err);
    }

    navigate(`/exam/${exam.id}/session`);
  };

  const mcqCount = examQuestions.filter(q => q.section === 'A').length;
  const nvqCount = examQuestions.filter(q => q.section === 'B').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Link
        to="/exams"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Exams
      </Link>

      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-10 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-gray-100 pb-5">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
            <Monitor className="w-3.5 h-3.5" />
            <span>NTA Computer-Based Test (CBT) Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{exam.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Please read the instructions carefully before entering the examination environment.
          </p>
        </div>

        {/* Mobile Restriction Alert */}
        {isMobile && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex items-start gap-4 text-rose-950">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm">Laptop or Desktop Browser Required</h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                Official NTA Exam mode requires a full keyboard and mouse interface with full-screen lock.
                Please log in from a laptop or desktop computer to take this test.
              </p>
            </div>
          </div>
        )}

        {/* Standalone PWA Restriction Alert (Phase 6 M6) */}
        {isBlockedByStandalone && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-4 text-amber-950">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm">Standalone Mode Detected</h3>
              <p className="text-xs text-amber-900 leading-relaxed">
                Exams must be taken in a full desktop browser. Please open Chrome or Edge on your laptop or desktop to start this exam.
              </p>
              {user?.role === 'monitor' && (
                <button
                  type="button"
                  onClick={() => setMonitorOverride(true)}
                  className="mt-2 text-xs font-bold text-indigo-700 underline hover:text-indigo-900 block"
                >
                  Monitor Override: Allow Exam in Standalone Mode
                </button>
              )}
            </div>
          </div>
        )}

        {/* Examination Parameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Total Duration</span>
            <span className="font-extrabold text-base text-gray-900 flex items-center gap-1 mt-0.5">
              <Clock className="w-4 h-4 text-blue-600" />
              {exam.duration_minutes} Mins
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Total Questions</span>
            <span className="font-extrabold text-base text-gray-900 mt-0.5 block">
              {exam.total_questions} Questions
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Maximum Marks</span>
            <span className="font-extrabold text-base text-gray-900 mt-0.5 block">
              {exam.max_marks} Marks
            </span>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Section Breakdown</span>
            <span className="font-bold text-xs text-gray-800 mt-1 block">
              Sec A: {mcqCount} MCQ<br />Sec B: {nvqCount} NVQ
            </span>
          </div>
        </div>

        {/* Marking Scheme */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-blue-950 uppercase tracking-wide">Marking Scheme</h3>
          <ul className="text-xs text-blue-900 space-y-1.5 list-disc list-inside">
            <li>
              <strong>Section A (Multiple Choice Questions):</strong> +{exam.marks_correct_mcq} marks for each correct response, {exam.marks_wrong_mcq} mark for an incorrect response, 0 marks for unattempted questions.
            </li>
            <li>
              <strong>Section B (Numerical Value Questions):</strong> +{exam.marks_correct_nvq} marks for each correct response, {exam.marks_wrong_nvq} mark for incorrect response, 0 marks for unattempted questions.
            </li>
            <li>
              Numerical answers must be typed using the on-screen numeric keypad. Physical keyboard typing is disabled.
            </li>
          </ul>
        </div>

        {/* Critical Full-Screen Disclosures (SRD 4.4, 5) */}
        <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-950 font-black text-sm uppercase tracking-wide">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Strict Full-Screen & Auto-Submit Rules</span>
          </div>
          <ul className="text-xs text-amber-900 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>Full-Screen Lock is Mandatory:</strong> Clicking "Start Examination" will expand this browser window to full-screen mode.
            </li>
            <li>
              <strong>Instant Auto-Submit on Exit:</strong> Leaving full-screen mode by any means (pressing <kbd className="bg-amber-100 px-1 py-0.5 rounded border border-amber-300 font-mono">Esc</kbd>, switching windows or applications, closing the tab, or browser reload) will <strong>automatically submit your exam immediately</strong> with the answers saved so far.
            </li>
            <li>
              <strong>One Attempt Strictly Enforced:</strong> An auto-submitted or completed exam cannot be resumed or re-opened under any circumstances.
            </li>
            <li>
              <strong>Database Clock Countdown:</strong> The exam timer runs strictly against the server deadline clock. Answers saved before the deadline are securely counted.
            </li>
          </ul>
        </div>

        {/* Pre-Start Technical Readiness Check (Item 15) */}
        <ExamPreStartCheck onStatusChange={setTechnicalCheckReady} />

        {/* Acknowledgement Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={isMobile || isBlockedByStandalone || !technicalCheckReady}
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
            />
            <span className="text-xs font-semibold text-gray-800 leading-snug">
              I have read and understood all instructions. I confirm that I am using a desktop/laptop computer, and I understand that exiting full screen or refreshing the page will immediately submit my exam.
            </span>
          </label>
        </div>

        {/* Start Button */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            disabled={!acknowledged || isMobile || isBlockedByStandalone || !technicalCheckReady}
            onClick={handleStartExam}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Examination</span>
          </button>
        </div>
      </div>
    </div>
  );
}
