import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  getExam,
  getAttempts,
  startExamAttempt,
  saveExamResponse,
  submitExamAttempt,
  getResponsesByAttempt,
  recordExamTelemetry,
  getSubjects,
  getExamQuestions,
  getAllQuestions,
  getQuestionTextInLanguage,
  updateProfile,
  getSettings,
} from '../../lib/db';
import type {
  Exam,
  Attempt,
  Question,
  Response as ExamResponse,
  PaletteStatus,
  ExamSubmitReason,
} from '../../lib/types';
import { KaTeXText } from '../../lib/katex-render';
import { NumericKeypad } from '../../components/NumericKeypad';
import { ExamCountdownTimer } from '../../components/ExamCountdownTimer';
import { ExamQuestionPalette } from '../../components/ExamQuestionPalette';
import {
  Clock,
  User,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function ExamSession() {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentId = user?.id || '';

  const exam = useMemo(() => (examId ? getExam(examId) : null), [examId]);
  const subjects = useMemo(() => getSubjects(), []);
  const sMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);
  const settings = useMemo(() => getSettings(), []);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Map<string, ExamResponse>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Current question inputs
  const currentQuestion: Question | undefined = questions[currentIndex];
  const [currentAnswer, setCurrentAnswer] = useState<string>('');

  // Clock state
  const [initialSeconds, setInitialSeconds] = useState<number>(0);

  // Full-screen and grace period
  const [isGraceActive, setIsGraceActive] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(0);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submit confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Filter tabs for exam sections
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'A' | 'B'>('A');

  // Language state (Phase 6 M4: Bilingual toggle)
  const [language, setLanguage] = useState<'english' | 'hindi'>((user?.preferred_language as any) || 'english');

  const handleToggleLanguage = (newLang: 'english' | 'hindi') => {
    setLanguage(newLang);
    if (user) {
      updateProfile(user.id, { preferred_language: newLang });
    }
  };

  const localized = useMemo(() => {
    if (!currentQuestion) return { text: '', options: null, isTranslated: false };
    return getQuestionTextInLanguage(currentQuestion, language);
  }, [currentQuestion, language]);

  // Initialization & Reload Guard
  useEffect(() => {
    if (!examId || !studentId) return;

    // Check if session was already active in this window (RELOAD GUARD)
    const sessionKey = `jph_exam_active_${examId}_${studentId}`;
    const wasRunning = sessionStorage.getItem(sessionKey);

    const existingAttempts = getAttempts().filter(a => a.exam_id === examId && a.student_id === studentId);
    if (existingAttempts.length > 0) {
      const att = existingAttempts[0];
      if (att.ended_at !== null) {
        // Attempt already completed
        navigate(`/exam/${examId}/result`);
        return;
      }

      if (wasRunning === 'true') {
        // RELOAD RULE: page was reloaded while attempt was open -> SUBMIT IMMEDIATELY!
        sessionStorage.removeItem(sessionKey);
        submitExamAttempt(att.id, studentId, 'left_full_screen');
        navigate(`/exam/${examId}/result?reason=left_full_screen`);
        return;
      }

      // If attempt is open and not reloaded (first load into session)
      sessionStorage.setItem(sessionKey, 'true');
      setAttempt(att);
      const resps = getResponsesByAttempt(att.id);
      const rMap = new Map(resps.map(r => [r.question_id, r]));
      setResponses(rMap);

      // Load questions
      const eqList = getExamQuestions(examId);
      const qMap = new Map(getAllQuestions().map(q => [q.id, q]));
      const qs = eqList.map(eq => qMap.get(eq.question_id)!).filter(Boolean);
      setQuestions(qs);

      if (qs.length > 0) {
        setActiveSubjectId(qs[0].subject_id);
      }

      // Compute remaining time
      if (att.deadline_at) {
        const msRemaining = Math.max(0, new Date(att.deadline_at).getTime() - Date.now());
        setInitialSeconds(Math.floor(msRemaining / 1000));
      }
      return;
    }

    // First time starting attempt
    try {
      sessionStorage.setItem(sessionKey, 'true');
      const { attempt: newAtt, questions: newQs } = startExamAttempt(examId, studentId);
      setAttempt(newAtt);
      setQuestions(newQs);
      if (newQs.length > 0) {
        setActiveSubjectId(newQs[0].subject_id);
      }

      const resps = getResponsesByAttempt(newAtt.id);
      const rMap = new Map(resps.map(r => [r.question_id, r]));
      setResponses(rMap);

      if (newAtt.deadline_at) {
        const msRemaining = Math.max(0, new Date(newAtt.deadline_at).getTime() - Date.now());
        setInitialSeconds(Math.floor(msRemaining / 1000));
      }
    } catch (err) {
      alert((err as Error).message);
      navigate('/exams');
    }
  }, [examId, studentId, navigate]);

  // Sync current answer when question changes
  useEffect(() => {
    if (!currentQuestion) return;
    const resp = responses.get(currentQuestion.id);
    setCurrentAnswer(resp?.answer || '');

    // If question was 'not_visited', update to 'not_answered'
    if (attempt && resp && resp.palette_status === 'not_visited') {
      const updated = saveExamResponse(attempt.id, currentQuestion.id, studentId, null, 'not_answered');
      setResponses(prev => new Map(prev).set(currentQuestion.id, updated));
    }
  }, [currentIndex, currentQuestion, attempt, studentId]);

  // Full-Screen Watchdog & beforeunload listeners
  useEffect(() => {
    if (!attempt || !exam) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordExamTelemetry(attempt.id, studentId, 'fullscreen_exit', { timestamp: new Date().toISOString() });

        // Phase 7 ISSUE-01: Enforce minimum 15-second grace window to prevent accidental OS popup instant submits
        const grace = Math.max(15, exam.grace_period_seconds ?? 15);
        setIsGraceActive(true);
        setGraceSecondsLeft(grace);

        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
        let remaining = grace;
        graceTimerRef.current = setInterval(() => {
          remaining--;
          setGraceSecondsLeft(remaining);
          if (remaining <= 0) {
            if (graceTimerRef.current) clearInterval(graceTimerRef.current);
            sessionStorage.removeItem(`jph_exam_active_${examId}_${studentId}`);
            submitExamAttempt(attempt.id, studentId, 'left_full_screen');
            navigate(`/exam/${examId}/result?reason=left_full_screen`);
          }
        }, 1000);
      } else {
        // Restored full screen within grace!
        if (isGraceActive) {
          setIsGraceActive(false);
          if (graceTimerRef.current) clearInterval(graceTimerRef.current);
          recordExamTelemetry(attempt.id, studentId, 'fullscreen_restored', { timestamp: new Date().toISOString() });
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordExamTelemetry(attempt.id, studentId, 'tab_switch', { hidden: true });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      sessionStorage.removeItem(`jph_exam_active_${examId}_${studentId}`);
      submitExamAttempt(attempt.id, studentId, 'left_full_screen');
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, [attempt, exam, examId, studentId, navigate, isGraceActive]);

  // Main Countdown Timer Auto-Submit Callback
  const handleTimeUp = useCallback(() => {
    if (!attempt) return;
    sessionStorage.removeItem(`jph_exam_active_${examId}_${studentId}`);
    submitExamAttempt(attempt.id, studentId, 'time_up');
    navigate(`/exam/${examId}/result?reason=time_up`);
  }, [attempt, examId, studentId, navigate]);

  // Re-enter full-screen helper
  const handleReturnToFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  };

  // NTA Action: Save & Next
  const handleSaveAndNext = () => {
    if (!attempt || !currentQuestion) return;
    const ans = currentAnswer.trim() || null;
    const newStatus: PaletteStatus = ans ? 'answered' : 'not_answered';

    const updated = saveExamResponse(attempt.id, currentQuestion.id, studentId, ans, newStatus, language);
    setResponses(prev => new Map(prev).set(currentQuestion.id, updated));

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // NTA Action: Save & Mark for Review
  const handleSaveAndMarkForReview = () => {
    if (!attempt || !currentQuestion) return;
    const ans = currentAnswer.trim() || null;
    const newStatus: PaletteStatus = ans ? 'answered_marked_for_review' : 'marked_for_review';

    const updated = saveExamResponse(attempt.id, currentQuestion.id, studentId, ans, newStatus, language);
    setResponses(prev => new Map(prev).set(currentQuestion.id, updated));

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // NTA Action: Clear Response
  const handleClearResponse = () => {
    if (!attempt || !currentQuestion) return;
    setCurrentAnswer('');
    const updated = saveExamResponse(attempt.id, currentQuestion.id, studentId, null, 'not_answered', language);
    setResponses(prev => new Map(prev).set(currentQuestion.id, updated));
  };

  // NTA Action: Mark for Review & Next (without saving answer)
  const handleMarkForReviewAndNext = () => {
    if (!attempt || !currentQuestion) return;
    const updated = saveExamResponse(attempt.id, currentQuestion.id, studentId, null, 'marked_for_review', language);
    setResponses(prev => new Map(prev).set(currentQuestion.id, updated));

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Direct Jump from Question Palette
  const handleJumpToQuestion = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Submit Exam
  const handleFinalSubmit = () => {
    if (!attempt) return;
    sessionStorage.removeItem(`jph_exam_active_${examId}_${studentId}`);
    submitExamAttempt(attempt.id, studentId, 'submitted');
    navigate(`/exam/${examId}/result?reason=submitted`);
  };

  // Calculate palette status counts
  const paletteCounts = useMemo(() => {
    const counts = {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked_for_review: 0,
      answered_marked_for_review: 0,
    };
    responses.forEach(r => {
      const st = r.palette_status || 'not_visited';
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [responses]);

  if (!exam || !attempt || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <p className="text-gray-700 font-bold text-base animate-pulse">Initializing CBT Environment...</p>
      </div>
    );
  }

  // Current question response
  const currentResp = responses.get(currentQuestion.id);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Grace Period Fullscreen Warning Toast */}
      {isGraceActive && (
        <div className="fixed top-0 inset-x-0 z-50 bg-rose-600 text-white py-3 px-6 shadow-2xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-wider">
              WARNING: Full-screen mode exited! Returning in {graceSecondsLeft}s or your exam will be auto-submitted.
            </span>
          </div>
          <button
            onClick={handleReturnToFullscreen}
            className="px-4 py-1.5 bg-white text-rose-700 font-black text-xs uppercase rounded-lg shadow-sm hover:bg-rose-50"
          >
            Re-enter Full Screen
          </button>
        </div>
      )}

      {/* Top Header Bar (NTA Portal Style) */}
      <header className="bg-[#2454a4] text-white border-b border-[#1b3e7a] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-extrabold text-base tracking-wide uppercase">{exam.name}</span>
          <span className="hidden md:inline-block bg-white/20 text-xs px-2.5 py-0.5 rounded font-medium">
            JEE Main CBT Portal
          </span>
        </div>

        {/* Live Countdown Clock (Isolated leaf component - eliminates whole-tree re-render storms) */}
        <div className="flex items-center gap-4">
          <ExamCountdownTimer initialSeconds={initialSeconds} onTimeUp={handleTimeUp} />

          <div className="hidden sm:flex items-center gap-2 border-l border-white/20 pl-4">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              <User className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">{user?.name || 'Candidate'}</span>
          </div>
        </div>
      </header>

      {/* Section Subheader */}
      <div className="bg-[#f0f3f8] border-b border-gray-300 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700">Subject:</span>
          <span className="font-extrabold text-[#2454a4] bg-white px-2.5 py-1 rounded border border-gray-300">
            {sMap.get(currentQuestion.subject_id) || 'Subject'}
          </span>
          <span className="font-bold text-gray-700 ml-2">Section:</span>
          <span className="font-extrabold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-300">
            Section {currentQuestion.type === 'NVQ' ? 'B (Numerical)' : 'A (MCQ)'}
          </span>
        </div>

        <div className="flex items-center gap-3 font-semibold text-gray-600">
          <span>Marks for correct: <strong className="text-emerald-700">+{currentQuestion.type === 'MCQ' ? exam.marks_correct_mcq : exam.marks_correct_nvq}</strong></span>
          <span>Negative marks: <strong className="text-rose-700">{currentQuestion.type === 'MCQ' ? exam.marks_wrong_mcq : exam.marks_wrong_nvq}</strong></span>
        </div>
      </div>

      {/* Main 2-Column Split: Left Question Panel & Right Question Palette */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Question Area & Navigation */}
        <div className="flex-1 flex flex-col justify-between bg-white border-r border-gray-300 overflow-y-auto">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-900 text-lg">
                  Question No. {currentIndex + 1}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                  {currentQuestion.type}
                </span>
              </div>

              {/* View in: Language Selector (NTA standard layout) */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">View in:</span>
                <select
                  value={language}
                  onChange={e => handleToggleLanguage(e.target.value as 'english' | 'hindi')}
                  className="text-xs font-bold text-gray-900 bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-[#2454a4] cursor-pointer"
                >
                  <option value="english">English</option>
                  <option value="hindi">हिन्दी</option>
                </select>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-gray-900 font-medium text-base sm:text-lg leading-relaxed">
              <KaTeXText text={localized.text} />
            </div>

            {/* Answer Input: MCQ Radio Options */}
            {currentQuestion.type === 'MCQ' && localized.options && (
              <div className="space-y-3 pt-2">
                {localized.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = currentAnswer.toUpperCase() === letter;

                  return (
                    <label
                      key={letter}
                      className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#2454a4] bg-blue-50/50 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exam-option"
                        value={letter}
                        checked={isSelected}
                        onChange={() => setCurrentAnswer(letter)}
                        className="mt-1 w-4 h-4 text-[#2454a4] focus:ring-[#2454a4] cursor-pointer"
                      />
                      <span className="font-extrabold text-sm text-gray-700 w-5">{letter}.</span>
                      <span className="text-gray-900 text-sm sm:text-base font-medium flex-1">
                        <KaTeXText text={opt} />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Answer Input: NVQ Numeric Keypad */}
            {currentQuestion.type === 'NVQ' && (
              <div className="space-y-3 pt-2 max-w-sm">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Type numerical answer (Use on-screen keypad only):
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentAnswer}
                    placeholder="Enter answer..."
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl font-mono text-lg font-bold text-gray-900 focus:outline-hidden"
                  />
                  {currentAnswer && (
                    <button
                      type="button"
                      onClick={() => setCurrentAnswer('')}
                      className="px-3 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <NumericKeypad
                  value={currentAnswer}
                  onChange={setCurrentAnswer}
                  disabled={false}
                  allowPhysicalKeypad={settings.allow_physical_keypad_a11y ?? false}
                />
              </div>
            )}
          </div>

          {/* Bottom Action Footer (Official NTA Layout) */}
          <div className="bg-[#f0f3f8] border-t border-gray-300 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-5 py-2.5 bg-[#28a745] hover:bg-[#218838] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors"
              >
                Save & Next
              </button>

              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                className="px-4 py-2.5 bg-[#ffc107] hover:bg-[#e0a800] text-gray-900 font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors"
              >
                Save & Mark for Review
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
              >
                Clear Response
              </button>

              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-2.5 bg-[#6f42c1] hover:bg-[#59359a] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors"
              >
                Mark for Review & Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="inline-flex items-center gap-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase rounded-lg transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="px-6 py-2.5 bg-[#dc3545] hover:bg-[#c82333] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors ml-2"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Candidate Info & NTA Question Palette */}
        <div className="w-full lg:w-84 xl:w-96 bg-[#f7f9fc] border-t lg:border-t-0 border-gray-300 flex flex-col justify-between overflow-y-auto p-4 sm:p-5 space-y-5">
          <div>
            {/* Candidate Card */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-300 flex items-center gap-3 shadow-xs">
              <div className="w-12 h-14 bg-gray-200 border border-gray-300 rounded flex items-center justify-center text-gray-400 font-bold text-xs">
                PHOTO
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="font-extrabold text-gray-900">{user?.name || 'Candidate'}</div>
                <div className="text-gray-500 font-mono text-[11px]">Roll: JEE2026-{studentId.slice(0, 6)}</div>
                <div className="text-gray-500 text-[11px]">Desktop Terminal #01</div>
              </div>
            </div>

            {/* NTA Palette Legend (5 official statuses) */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-300 mt-4 space-y-2 text-xs">
              <span className="font-extrabold text-gray-700 text-[11px] uppercase tracking-wider block border-b pb-1">
                Question Legend
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-[#28a745] text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteCounts.answered}
                  </span>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-[#dc3545] text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteCounts.not_answered}
                  </span>
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-gray-300 text-gray-800 font-bold flex items-center justify-center text-[10px]">
                    {paletteCounts.not_visited}
                  </span>
                  <span>Not Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#6f42c1] text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteCounts.marked_for_review}
                  </span>
                  <span>Review</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t text-[11px]">
                <span className="w-6 h-6 rounded-full bg-[#6f42c1] border-2 border-emerald-400 text-white font-bold flex items-center justify-center text-[10px] relative">
                  {paletteCounts.answered_marked_for_review}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
                </span>
                <span>Answered & Review</span>
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div className="mt-4">
              <span className="font-extrabold text-gray-700 text-xs block mb-2">
                Choose a Question:
              </span>
              <ExamQuestionPalette
                questions={questions}
                responses={responses}
                currentIndex={currentIndex}
                onSelect={handleJumpToQuestion}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-300">
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 bg-[#dc3545] hover:bg-[#c82333] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-colors"
            >
              Submit Exam
            </button>
          </div>
        </div>
      </div>

      {/* Final Submit Summary Confirmation Modal (Official NTA Style) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Exam Summary & Confirmation</h3>
                <p className="text-xs text-gray-500">Review your attempt summary before final submission.</p>
              </div>
            </div>

            {/* Summary Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-bold">
                  <tr>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">No. of Questions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  <tr>
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-[#28a745]" /> Answered
                    </td>
                    <td className="p-2.5 text-right font-bold text-gray-900">{paletteCounts.answered}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-[#dc3545]" /> Not Answered
                    </td>
                    <td className="p-2.5 text-right font-bold text-gray-900">{paletteCounts.not_answered}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#6f42c1]" /> Marked for Review
                    </td>
                    <td className="p-2.5 text-right font-bold text-gray-900">{paletteCounts.marked_for_review}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#6f42c1] ring-1 ring-emerald-400" /> Answered & Marked for Review
                    </td>
                    <td className="p-2.5 text-right font-bold text-gray-900">{paletteCounts.answered_marked_for_review}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-gray-300" /> Not Visited
                    </td>
                    <td className="p-2.5 text-right font-bold text-gray-900">{paletteCounts.not_visited}</td>
                  </tr>
                  <tr className="bg-gray-50 font-black">
                    <td className="p-2.5">Total Questions</td>
                    <td className="p-2.5 text-right">{questions.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-rose-700 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
              Note: Once submitted, you cannot resume or re-take this examination.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs uppercase rounded-xl transition-colors"
              >
                Return to Exam
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 bg-[#dc3545] hover:bg-[#c82333] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-colors"
              >
                Yes, Final Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
