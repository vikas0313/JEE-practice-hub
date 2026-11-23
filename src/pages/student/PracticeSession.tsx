import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAttempt,
  getQuestionsForPractice,
  getAllQuestions,
  insertResponse,
  updateResponse,
  getResponsesByAttempt,
  getQuestionAnswer,
  getSolution,
  getAllQuestionAnswers,
  getAllSolutions,
  getSyllabusChapters,
  getSyllabusSubjects,
  recordPracticedQuestion,
  isBookmarked,
  toggleBookmark,
  scoreResponse,
  getSettings,
  insertVisit,
  insertPauseEvent,
  updatePauseEvent,
  insertSolutionView,
  insertFlagReport,
  updateAttempt,
  recordMistake,
  clearRevisionItem,
  getQuestionTextInLanguage,
  updateProfile,
} from '../../lib/db';
import { useAuth } from '../../lib/auth';
import type {
  Question,
  Response as StudentResponse,
  QuestionAnswer,
  Solution,
  Visit,
  PauseEvent,
  ConfidenceTag,
  ErrorReason,
} from '../../lib/types';
import { getIdealTime } from '../../lib/types';
import { v4 as uuid } from 'uuid';
import { KaTeXText } from '../../lib/katex-render';
import { PracticeStopwatchGauge } from '../../components/PracticeStopwatchGauge';
import { NumericKeypad } from '../../components/NumericKeypad';
import { SolutionTabs } from '../../components/SolutionTabs';
import { DigitalScratchpad } from '../../components/DigitalScratchpad';
import {
  Bookmark,
  CheckCircle,
  XCircle,
  ArrowRight,
  HelpCircle,
  Pause,
  Play,
  Award,
} from 'lucide-react';

export default function PracticeSession() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const attempt = useMemo(() => (attemptId ? getAttempt(attemptId) : null), [attemptId]);
  const settings = useMemo(() => getSettings(), []);

  // Authorization guard: Student can only access their own practice session
  useEffect(() => {
    if (attempt && user && attempt.student_id !== user.id) {
      navigate('/practice', { replace: true });
    }
  }, [attempt, user, navigate]);

  // Questions in this set
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Current question states
  const currentQuestion: Question | undefined = questions[currentIndex];
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<StudentResponse | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<QuestionAnswer | null>(null);
  const [revealedSolution, setRevealedSolution] = useState<Solution | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceTag | null>(null);
  const [selectedErrorReason, setSelectedErrorReason] = useState<ErrorReason | null>(null);

  // Time tracking states
  const elapsedActiveRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentVisitId, setCurrentVisitId] = useState<string>('');
  const [currentPauseEventId, setCurrentPauseEventId] = useState<string | null>(null);

  // Inactivity "Still solving?" prompt
  const [showInactivityModal, setShowInactivityModal] = useState<boolean>(false);
  const lastInteractionTimeRef = useRef<number>(Date.now());
  const inactivityPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityExcludeStartRef = useRef<number | null>(null);

  // Bookmarking
  const [bookmarked, setBookmarked] = useState<boolean>(false);

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

  const correctAnswerDisplay = useMemo(() => {
    if (!revealedAnswer) return '';
    const c = revealedAnswer.correct_answer;
    if (Array.isArray(c)) return c.join(', ');
    return String(c || '').trim();
  }, [revealedAnswer]);

  const isCorrect = useMemo(() => {
    if (currentResponse?.is_correct !== null && currentResponse?.is_correct !== undefined) {
      return Boolean(currentResponse.is_correct);
    }
    if (revealedAnswer && studentAnswer.trim()) {
      const correctUpper = correctAnswerDisplay.toUpperCase();
      const givenUpper = studentAnswer.trim().toUpperCase();
      return givenUpper === correctUpper;
    }
    return false;
  }, [currentResponse?.is_correct, revealedAnswer, studentAnswer, correctAnswerDisplay]);

  const chapterName = useMemo(() => {
    if (!currentQuestion) return '';
    const ch = getSyllabusChapters().find(c => c.id === currentQuestion.primary_chapter_id || c.id === currentQuestion.chapter_id);
    return ch?.name || '';
  }, [currentQuestion]);

  const subjectName = useMemo(() => {
    if (!currentQuestion) return '';
    const s = getSyllabusSubjects().find(sub => sub.id === currentQuestion.subject_id);
    return s?.name || '';
  }, [currentQuestion]);

  // Load questions for this attempt
  useEffect(() => {
    if (!attempt || !user) {
      setLoadingQuestions(false);
      return;
    }
    let chosen: Question[] = [];
    if ((attempt as any).question_id) {
      const q = getAllQuestions().find(item => item.id === (attempt as any).question_id);
      if (q) chosen = [q];
    }
    if (chosen.length === 0 && attempt.topic_id) {
      const qById = getAllQuestions().find(item => item.id === attempt.topic_id);
      if (qById) chosen = [qById];
    }
    if (chosen.length === 0) {
      const pool = getQuestionsForPractice(
        attempt.topic_id || '',
        attempt.difficulty || 'Mixed'
      );
      chosen = pool.slice(0, attempt.set_size || 5);
    }
    setQuestions(chosen);
    setLoadingQuestions(false);
  }, [attempt, user]);

  // Sync bookmark status when current question changes
  useEffect(() => {
    if (!user || !currentQuestion) return;
    setBookmarked(isBookmarked(user.id, currentQuestion.id));
  }, [user, currentQuestion]);

  // Visit timing setup per question
  useEffect(() => {
    if (!user || !attempt || !currentQuestion) return;

    setStudentAnswer('');
    setSubmitted(false);
    setRevealedAnswer(null);
    setRevealedSolution(null);
    elapsedActiveRef.current = 0;
    setIsPaused(false);
    setShowInactivityModal(false);
    lastInteractionTimeRef.current = Date.now();
    inactivityExcludeStartRef.current = null;

    const existingResp = getResponsesByAttempt(attempt.id).find(
      (r) => r.question_id === currentQuestion.id
    );

    let respId: string;
    if (existingResp) {
      respId = existingResp.id;
      setCurrentResponse(existingResp);
      if (existingResp.submitted_at) {
        setStudentAnswer(existingResp.answer || '');
        setSubmitted(true);
        setRevealedAnswer(getQuestionAnswer(currentQuestion.id, user.id));
        setRevealedSolution(getSolution(currentQuestion.id, user.id));
      }
    } else {
      respId = uuid();
      const newResp: StudentResponse = {
        id: respId,
        attempt_id: attempt.id,
        question_id: currentQuestion.id,
        student_id: user.id,
        answer: null,
        is_correct: null,
        marks: null,
        submitted_at: null,
        level: currentQuestion.difficulty,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      insertResponse(newResp);
      setCurrentResponse(newResp);
    }

    const visitId = uuid();
    setCurrentVisitId(visitId);
    const visit: Visit = {
      id: visitId,
      response_id: respId,
      student_id: user.id,
      started_at: new Date().toISOString(),
      ended_at: null,
      active_seconds: 0,
      idle_seconds: 0,
      actions: [],
      created_at: new Date().toISOString(),
    };
    insertVisit(visit);
  }, [user, attempt, currentQuestion]);

  // Inactivity Trigger Callback (isolated into PracticeStopwatchGauge)
  const handleTriggerInactivity = useCallback(() => {
    setShowInactivityModal(true);
    inactivityExcludeStartRef.current = Date.now();

    inactivityPromptTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 60000);
  }, []);

  // Tab hidden / window blur detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPaused(true);
    };
    const handleBlur = () => setIsPaused(true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const registerInteraction = useCallback(() => {
    lastInteractionTimeRef.current = Date.now();
  }, []);

  // Manual Pause Toggle
  const handleTogglePause = () => {
    if (!user || !currentVisitId) return;

    if (!isPaused) {
      setIsPaused(true);
      const pauseId = uuid();
      setCurrentPauseEventId(pauseId);
      const pe: PauseEvent = {
        id: pauseId,
        visit_id: currentVisitId,
        student_id: user.id,
        started_at: new Date().toISOString(),
        ended_at: null,
        kind: 'pause_button',
        created_at: new Date().toISOString(),
      };
      insertPauseEvent(pe);
    } else {
      setIsPaused(false);
      if (currentPauseEventId) {
        updatePauseEvent(currentPauseEventId, { ended_at: new Date().toISOString() });
        setCurrentPauseEventId(null);
      }
    }
  };

  const handleStillSolvingReply = (stillSolving: boolean) => {
    if (inactivityPromptTimeoutRef.current) {
      clearTimeout(inactivityPromptTimeoutRef.current);
    }
    setShowInactivityModal(false);
    lastInteractionTimeRef.current = Date.now();

    if (stillSolving) {
      setIsPaused(false);
    } else {
      setIsPaused(false);
      if (user && currentVisitId && inactivityExcludeStartRef.current) {
        insertPauseEvent({
          id: uuid(),
          visit_id: currentVisitId,
          student_id: user.id,
          started_at: new Date(inactivityExcludeStartRef.current).toISOString(),
          ended_at: new Date().toISOString(),
          kind: 'idle_gap',
          created_at: new Date().toISOString(),
        });
      }
    }
  };

  const handleBookmarkToggle = () => {
    if (!user || !currentQuestion) return;
    const newState = toggleBookmark(user.id, currentQuestion.id);
    setBookmarked(newState);
  };

  const handleFlagSolution = () => {
    if (!user || !currentQuestion) return;
    const reason = prompt('Please specify why this solution or answer is wrong:');
    if (!reason?.trim()) return;

    insertFlagReport({
      id: uuid(),
      question_id: currentQuestion.id,
      reporter_id: user.id,
      reason: reason.trim(),
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    alert('Thank you. Your flag has been submitted to the monitor review queue.');
  };

  // Submit Answer
  const handleSubmitAnswer = (chosenOpt?: string) => {
    if (!user || !currentQuestion || !currentResponse || !attempt) return;
    const answerToSubmit = (chosenOpt || studentAnswer).trim();
    if (!answerToSubmit) {
      alert('Please select or type an answer first.');
      return;
    }

    const { is_correct, marks } = scoreResponse(
      currentQuestion.id,
      answerToSubmit,
      currentQuestion.type
    );

    const now = new Date().toISOString();
    const updatedResp = updateResponse(currentResponse.id, {
      answer: answerToSubmit,
      is_correct,
      marks,
      confidence,
      language,
      submitted_at: now,
    });

    if (updatedResp) {
      setCurrentResponse(updatedResp);
    } else {
      setCurrentResponse({
        ...currentResponse,
        answer: answerToSubmit,
        is_correct,
        marks,
        confidence,
        language,
        submitted_at: now,
      });
    }

    recordPracticedQuestion(user.id, currentQuestion.id, answerToSubmit, is_correct);

    if (is_correct) {
      clearRevisionItem(user.id, currentQuestion.id);
    } else {
      recordMistake(user.id, currentQuestion.id, 'wrong_answer');
    }

    if (currentVisitId) {
      insertVisit({
        id: currentVisitId,
        response_id: currentResponse.id,
        student_id: user.id,
        started_at: currentResponse.created_at,
        ended_at: now,
        active_seconds: elapsedActiveRef.current,
        idle_seconds: 0,
        actions: ['submitted'],
        created_at: now,
      });
    }

    let ans = getQuestionAnswer(currentQuestion.id, user.id);
    let sol = getSolution(currentQuestion.id, user.id);
    if (!ans) {
      ans = getAllQuestionAnswers().find(a => a.question_id === currentQuestion.id) ?? null;
    }
    if (!sol) {
      sol = getAllSolutions().find(s => s.question_id === currentQuestion.id) ?? null;
    }
    setRevealedAnswer(ans);
    setRevealedSolution(sol);
    setSubmitted(true);
  };

  const handleViewSteps = () => {
    if (!user || !currentResponse) return;
    insertSolutionView({
      id: uuid(),
      response_id: currentResponse.id,
      student_id: user.id,
      opened_steps_at: new Date().toISOString(),
      opened_shortcut_at: null,
      created_at: new Date().toISOString(),
    });
  };

  const handleViewShortcut = () => {
    if (!user || !currentResponse) return;
    insertSolutionView({
      id: uuid(),
      response_id: currentResponse.id,
      student_id: user.id,
      opened_steps_at: null,
      opened_shortcut_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  };

  const handleSelectErrorReason = (reason: ErrorReason) => {
    setSelectedErrorReason(reason);
    if (currentResponse) {
      updateResponse(currentResponse.id, { error_reason: reason });
    }
  };

  const handleNext = () => {
    setStudentAnswer('');
    setSubmitted(false);
    setRevealedAnswer(null);
    setRevealedSolution(null);
    setConfidence(null);
    setSelectedErrorReason(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      if (attempt) {
        const respList = getResponsesByAttempt(attempt.id);
        const score = respList.reduce((sum, r) => sum + (r.marks || 0), 0);
        updateAttempt(attempt.id, {
          ended_at: new Date().toISOString(),
          score,
          total_marks: questions.length * 4,
          submit_reason: 'manual',
        });
        navigate(`/practice/session/${attempt.id}/summary`);
      }
    }
  };

  if (!attempt && !loadingQuestions) {
    return (
      <div className="min-h-screen bg-[#ebf7f0] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-100 max-w-md w-full">
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Practice Session Not Found</h2>
          <p className="text-emerald-700 text-sm mb-6">The practice session could not be found or may have expired.</p>
          <button
            onClick={() => navigate('/practice')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
          >
            Return to Practice
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0 && !loadingQuestions) {
    return (
      <div className="min-h-screen bg-[#ebf7f0] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-100 max-w-md w-full">
          <h2 className="text-xl font-bold text-emerald-900 mb-2">No Questions Found</h2>
          <p className="text-emerald-700 text-sm mb-6">No matching questions were found for this topic and difficulty.</p>
          <button
            onClick={() => navigate('/practice')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
          >
            Choose Another Topic
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-[#ebf7f0] flex items-center justify-center p-4">
        <p className="text-emerald-800 font-bold text-lg animate-pulse">Loading JEE Practice Question...</p>
      </div>
    );
  }

  const idealTime = getIdealTime(settings, currentQuestion.difficulty);

  // Level number mapping
  const levelNumber = currentQuestion.difficulty === 'Basic' ? 1 : currentQuestion.difficulty === 'Medium' ? 2 : 3;

  // XP calculation
  const totalXP = (getResponsesByAttempt(attempt?.id || '').filter(r => r.is_correct).length) * 10;

  // Progress percentage
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  // Option visual configs (A=Pink, B=Blue, C=Green, D=Yellow)
  const optionTheme = [
    {
      badgeBg: 'bg-[#fbcfe8]',
      badgeText: 'text-[#db2777]',
      border: 'border-[#fbcfe8]',
      hoverBorder: 'hover:border-[#f472b6]',
      selectedBorder: 'border-[#db2777] bg-[#fdf2f8]',
    },
    {
      badgeBg: 'bg-[#bae6fd]',
      badgeText: 'text-[#0284c7]',
      border: 'border-[#bae6fd]',
      hoverBorder: 'hover:border-[#38bdf8]',
      selectedBorder: 'border-[#0284c7] bg-[#f0f9ff]',
    },
    {
      badgeBg: 'bg-[#bbf7d0]',
      badgeText: 'text-[#16a34a]',
      border: 'border-[#bbf7d0]',
      hoverBorder: 'hover:border-[#4ade80]',
      selectedBorder: 'border-[#16a34a] bg-[#f0fdf4]',
    },
    {
      badgeBg: 'bg-[#fef08a]',
      badgeText: 'text-[#ca8a04]',
      border: 'border-[#fef08a]',
      hoverBorder: 'hover:border-[#facc15]',
      selectedBorder: 'border-[#ca8a04] bg-[#fefce8]',
    },
  ];

  return (
    <div
      onKeyDown={registerInteraction}
      onClick={registerInteraction}
      className="min-h-screen bg-[#ebf7f0] -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 flex flex-col justify-between"
    >
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Pill: Level + Difficulty + Question # */}
          <div className="bg-white px-5 py-2 rounded-full font-extrabold text-xs text-gray-800 tracking-wide uppercase shadow-sm border border-emerald-100 flex items-center gap-2">
            <span>LEVEL {levelNumber} · {currentQuestion.difficulty}</span>
            <span className="text-gray-300">·</span>
            <span className="text-emerald-700">Q{currentIndex + 1}/{questions.length}</span>
          </div>

          {/* Middle: XP & Smooth Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">
              XP {totalXP}
            </span>
            <div className="w-36 sm:w-48 bg-white/80 h-3.5 rounded-full overflow-hidden p-0.5 border border-emerald-100/80 shadow-inner">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Right Pill: Ideal Timer target */}
          <div className="bg-[#fee685] text-[#713f12] px-5 py-2 rounded-full font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-2">
            <span>TIMER · {idealTime} SEC</span>
          </div>
        </div>

        {/* Main Content: Left Column (Question + 2x2 Options) & Right Column (Timer Gauge + Mascot) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left / Main Question Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Language Switcher Bar */}
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-gray-500">
                {localized.isTranslated ? 'Official NTA Hindi translation available' : 'Language'}
              </span>
              <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 rounded-xl text-xs font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => handleToggleLanguage('english')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    language === 'english'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLanguage('hindi')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    language === 'hindi'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  हिन्दी
                </button>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100/60 space-y-4">
              {/* Question Header: Subject / Chapter badge + Question Type */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {subjectName || 'JEE Main'}
                  </span>
                  {chapterName && (
                    <span className="text-xs font-semibold text-gray-600">
                      • {chapterName}
                    </span>
                  )}
                  {currentQuestion.subtopic && (
                    <span className="text-xs font-medium text-gray-400 hidden sm:inline">
                      ({currentQuestion.subtopic})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md select-all" title="Question ID">
                    ID: {currentQuestion.id}
                  </span>
                  <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700">
                    {currentQuestion.type === 'MCQ' ? 'Single Correct MCQ (+4, -1)' : 'Numerical Value (+4, 0)'}
                  </span>
                </div>
              </div>

              {/* Question Body */}
              <div className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
                <KaTeXText text={localized.text} />
              </div>

              {/* Optional Figure */}
              {currentQuestion.figure && (
                <div className="pt-2">
                  <img
                    src={currentQuestion.figure}
                    alt="Question Diagram"
                    className="max-h-72 mx-auto rounded-xl border border-gray-200 object-contain bg-white p-2"
                  />
                </div>
              )}
            </div>

            {/* Module G3: Practice Digital Scratchpad */}
            {settings.flag_g3_practice_scratchpad && !isPaused && (
              <DigitalScratchpad />
            )}

            {/* 2x2 Options Grid (MCQ) */}
            {currentQuestion.type === 'MCQ' && localized.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {localized.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = studentAnswer === letter;
                  const isThisCorrect = submitted && letter.toUpperCase() === correctAnswerDisplay.toUpperCase();
                  const theme = optionTheme[idx % optionTheme.length];

                  let cardBorder = `${theme.border} ${theme.hoverBorder} bg-white`;
                  if (isSelected) {
                    cardBorder = `${theme.selectedBorder} ring-2 ring-offset-1 ring-blue-400 font-semibold`;
                  }
                  if (submitted && revealedAnswer) {
                    if (isThisCorrect) {
                      cardBorder = 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-400 font-bold';
                    } else if (isSelected && !isCorrect) {
                      cardBorder = 'border-rose-400 bg-rose-50/90 ring-2 ring-rose-300 font-bold';
                    } else {
                      cardBorder = 'border-gray-200 bg-gray-50/60 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={submitted || isPaused}
                      onClick={() => !submitted && setStudentAnswer(letter)}
                      className={`rounded-2xl p-4 sm:p-5 border-2 text-left flex items-center gap-4 transition-all duration-150 shadow-sm ${cardBorder} ${
                        submitted ? 'cursor-default' : 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full ${theme.badgeBg} ${theme.badgeText} font-black text-xl flex items-center justify-center shrink-0 shadow-sm`}
                      >
                        {letter}
                      </div>
                      <div className="text-base sm:text-lg font-bold text-gray-900 flex-1 leading-snug">
                        <KaTeXText text={option} />
                      </div>
                      {submitted && isThisCorrect && (
                        <CheckCircle size={22} className="text-emerald-600 shrink-0 ml-auto" />
                      )}
                      {submitted && isSelected && !isCorrect && (
                        <XCircle size={22} className="text-rose-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Numerical Value Input (NVQ) */}
            {currentQuestion.type === 'NVQ' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 flex flex-col items-center">
                <span className="text-xs uppercase font-extrabold text-gray-400 mb-3 tracking-wider">
                  Type Numerical Value
                </span>
                <NumericKeypad
                  value={studentAnswer}
                  onChange={setStudentAnswer}
                  disabled={submitted || isPaused}
                />
              </div>
            )}
          </div>

          {/* Right Column (4 Cols): Timer Gauge & Selection Action Card */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
            {/* Top Card: Circular Timer Gauge */}
            <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/60 flex flex-col items-center justify-center relative">
              <PracticeStopwatchGauge
                idealTime={idealTime}
                isPaused={isPaused}
                isSubmitted={submitted}
                showInactivityModal={showInactivityModal}
                idleTimeout={settings.idle_timeout}
                resetKey={currentQuestion.id}
                lastInteractionTimeRef={lastInteractionTimeRef}
                elapsedRef={elapsedActiveRef}
                onTriggerInactivity={handleTriggerInactivity}
              />

              {/* Pause & Bookmark Quick Controls */}
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-bold transition-colors"
                >
                  {isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} className="fill-current" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBookmarkToggle}
                  className={`p-1.5 rounded-full border transition-colors ${
                    bookmarked
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
                  }`}
                  title={bookmarked ? 'Bookmarked' : 'Add to bookmarks'}
                >
                  <Bookmark size={15} className={bookmarked ? 'fill-current' : ''} />
                </button>
              </div>
            </div>

            {/* Bottom Card: Selection & Submit Action Panel */}
            <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/60 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-3 w-full">
                {/* Status Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs font-bold uppercase tracking-wider">
                  <span className="text-gray-400">Response Status</span>
                  {submitted ? (
                    <span className={isCorrect ? 'text-emerald-600 font-extrabold flex items-center gap-1' : 'text-rose-600 font-extrabold flex items-center gap-1'}>
                      {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  ) : studentAnswer.trim() ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Option {studentAnswer} Selected
                    </span>
                  ) : (
                    <span className="text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Select an Option
                    </span>
                  )}
                </div>

                {/* Confidence Selector (Optional before submit) */}
                {!submitted ? (
                  <div className="w-full my-2 text-left">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1">
                      <span>Confidence</span>
                      {confidence && <span className="text-emerald-600 font-extrabold">{confidence}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Sure', 'Not sure', 'Guess'] as ConfidenceTag[]).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          disabled={isPaused}
                          onClick={() => setConfidence(confidence === tag ? null : tag)}
                          className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all border ${
                            confidence === tag
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-left space-y-1.5 text-xs">
                    <div className="text-gray-500 font-semibold">Your Selected Answer:</div>
                    <div className="font-extrabold text-gray-900 text-base">Option {studentAnswer || 'None'}</div>
                    {revealedAnswer && (
                      <div className="text-emerald-800 font-bold pt-1.5 border-t border-gray-200 mt-2">
                        Official Key: Option {correctAnswerDisplay}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button: Mark Answer & Submit */}
              <div className="w-full pt-3">
                {!submitted ? (
                  <button
                    type="button"
                    disabled={!studentAnswer.trim() || isPaused}
                    onClick={() => handleSubmitAnswer()}
                    className={`w-full py-3.5 px-4 text-white font-extrabold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                      !studentAnswer.trim() || isPaused
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg cursor-pointer scale-[1.01]'
                    }`}
                  >
                    <CheckCircle size={16} />
                    <span>{studentAnswer.trim() ? 'Mark Answer & Submit' : 'Select Option to Submit'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full py-3.5 px-4 bg-gray-900 hover:bg-black text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                  >
                    <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'View Summary'}</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Post-submission Result Banner & Solutions */}
        {submitted && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Answer banner */}
            <div className={`rounded-2xl p-5 shadow-sm border-2 flex flex-wrap items-center justify-between gap-3 ${
              isCorrect ? 'bg-emerald-50 border-emerald-500/80' : 'bg-rose-50 border-rose-500/80'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                {isCorrect ? (
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-base">
                    <CheckCircle size={22} className="text-emerald-600 shrink-0" />
                    <span>Correct Answer! (+4 Marks)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-900 font-extrabold text-base">
                    <XCircle size={22} className="text-rose-600 shrink-0" />
                    <span>Incorrect Answer ({currentResponse?.marks ?? -1} Marks)</span>
                  </div>
                )}
                {revealedAnswer && (
                  <div className="text-sm font-bold text-gray-800 bg-white/90 px-3.5 py-1.5 rounded-xl border border-gray-200">
                    Correct Answer: <strong className="text-emerald-700 font-extrabold">Option {correctAnswerDisplay}</strong>
                    {revealedAnswer.answer_text && revealedAnswer.answer_text !== correctAnswerDisplay && (
                      <span className="ml-2 font-mono text-xs">
                        (<KaTeXText text={revealedAnswer.answer_text} />)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'View Summary'}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Error Reason Selector (When incorrect) */}
            {!isCorrect && (
              <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Why was this missed? (Saved to Mistake Notebook)
                  </span>
                  {selectedErrorReason && (
                    <span className="text-xs font-extrabold text-rose-700 bg-rose-200/70 px-2 py-0.5 rounded-full">
                      Logged: {selectedErrorReason}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    'Calculation error',
                    'Formula forgotten / misremembered',
                    'Misread question',
                    'Conceptual gap',
                    'Ran out of time / rushed',
                  ] as ErrorReason[]).map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleSelectErrorReason(reason)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        selectedErrorReason === reason
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm scale-105'
                          : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-100/60'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step-by-step English Solution */}
            {revealedSolution && (
              <SolutionTabs
                solution={revealedSolution}
                questionId={currentQuestion?.id}
                studentId={user?.id}
                onFlag={handleFlagSolution}
                onViewSteps={handleViewSteps}
                onViewShortcut={handleViewShortcut}
              />
            )}
          </div>
        )}

        {/* Footer Hint */}
        <p className="text-xs text-emerald-800/60 text-center font-medium pt-2">
          Think first. Auto-reveals answer and step-by-step solution when submitted.
        </p>
      </div>

      {/* "Still solving?" Inactivity Modal */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-emerald-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <HelpCircle size={26} />
            </div>
            <div className="text-center">
              <h3 className="font-extrabold text-gray-900 text-lg">Still solving?</h3>
              <p className="text-xs text-gray-600 mt-1">
                You've been on this question for 5 minutes without touching the screen.
                Are you still working on paper?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleStillSolvingReply(true)}
                className="py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Yes, still solving
              </button>
              <button
                type="button"
                onClick={() => handleStillSolvingReply(false)}
                className="py-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
              >
                No, was idle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
