import React, { useState, useMemo } from 'react';
import {
  getStudentProfile,
  getMonitorProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getAllUserSessions,
  revokeUserSession,
  getMfaRecoveryCodes,
} from '../../lib/db';
import { generateMfaRecoveryCodes } from '../../lib/accountSecurity';
import { Settings as SettingsIcon, Clock, ToggleLeft, ToggleRight, Mail, KeyRound, CheckCircle2, Eye, Shield, Laptop, Trash2, Smartphone } from 'lucide-react';

export default function MonitorSettings() {
  const student = useMemo(() => getStudentProfile(), []);
  const initialSettings = useMemo(() => getSettings(), []);

  const [stopwatchVisible, setStopwatchVisible] = useState<boolean>(student?.stopwatch_visible ?? true);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(initialSettings.registration_enabled ?? false);
  const [requireApproval, setRequireApproval] = useState<boolean>(initialSettings.require_approval ?? false);
  const [dailyRegistrationCap, setDailyRegistrationCap] = useState<number>(initialSettings.daily_registration_cap ?? 50);
  const [registrationInAppNotice, setRegistrationInAppNotice] = useState<boolean>(initialSettings.registration_in_app_notice ?? true);
  const [idealBasic, setIdealBasic] = useState<number>(initialSettings.ideal_time_basic);
  const [idealMedium, setIdealMedium] = useState<number>(initialSettings.ideal_time_medium);
  const [idealAdvanced, setIdealAdvanced] = useState<number>(initialSettings.ideal_time_advanced);
  const [idleTimeout, setIdleTimeout] = useState<number>(initialSettings.idle_timeout);
  const [allowPhysicalKeypadA11y, setAllowPhysicalKeypadA11y] = useState<boolean>(initialSettings.allow_physical_keypad_a11y ?? false);
  const [flagE10, setFlagE10] = useState<boolean>(initialSettings.flag_e10_ux_completeness ?? false);
  const [flagE9, setFlagE9] = useState<boolean>(initialSettings.flag_e9_performance_and_visual_polish ?? false);
  const [flagE13, setFlagE13] = useState<boolean>(initialSettings.flag_e13_enhanced_testing ?? false);
  const [flagE12, setFlagE12] = useState<boolean>(initialSettings.flag_e12_integrity_resilience ?? false);
  const [flagE11, setFlagE11] = useState<boolean>(initialSettings.flag_e11_account_security ?? false);
  const [flagE1, setFlagE1] = useState<boolean>(initialSettings.flag_e1_adaptive_repetition ?? false);
  const [flagE6, setFlagE6] = useState<boolean>(initialSettings.flag_e6_calibration_analytics ?? false);
  const [flagE3, setFlagE3] = useState<boolean>(initialSettings.flag_e3_revision_cards ?? false);
  const [flagE5, setFlagE5] = useState<boolean>(initialSettings.flag_e5_advanced_exam_analytics ?? false);
  const [flagE8, setFlagE8] = useState<boolean>(initialSettings.flag_e8_custom_reporting ?? false);
  const [flagE7, setFlagE7] = useState<boolean>(initialSettings.flag_e7_exam_auto_composer ?? false);
  const [flagE4, setFlagE4] = useState<boolean>(initialSettings.flag_e4_question_search_embeddings ?? false);
  const [flagE2, setFlagE2] = useState<boolean>(initialSettings.flag_e2_concept_map ?? false);
  const [flagG3, setFlagG3] = useState<boolean>(initialSettings.flag_g3_practice_scratchpad ?? false);

  const monitor = useMemo(() => getMonitorProfile(), []);
  const [allSessions, setAllSessions] = useState(() => getAllUserSessions());
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [resetSent, setResetSent] = useState<boolean>(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (student) {
      updateProfile(student.id, { stopwatch_visible: stopwatchVisible });
    }
    updateSettings({
      registration_enabled: registrationEnabled,
      require_approval: requireApproval,
      daily_registration_cap: dailyRegistrationCap,
      registration_in_app_notice: registrationInAppNotice,
      ideal_time_basic: idealBasic,
      ideal_time_medium: idealMedium,
      ideal_time_advanced: idealAdvanced,
      idle_timeout: idleTimeout,
      allow_physical_keypad_a11y: allowPhysicalKeypadA11y,
      flag_e10_ux_completeness: flagE10,
      flag_e9_performance_and_visual_polish: flagE9,
      flag_e13_enhanced_testing: flagE13,
      flag_e12_integrity_resilience: flagE12,
      flag_e11_account_security: flagE11,
      flag_e1_adaptive_repetition: flagE1,
      flag_e6_calibration_analytics: flagE6,
      flag_e3_revision_cards: flagE3,
      flag_e5_advanced_exam_analytics: flagE5,
      flag_e8_custom_reporting: flagE8,
      flag_e7_exam_auto_composer: flagE7,
      flag_e4_question_search_embeddings: flagE4,
      flag_e2_concept_map: flagE2,
      flag_g3_practice_scratchpad: flagG3,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRevokeSession = (sessionId: string) => {
    revokeUserSession(sessionId);
    setAllSessions(getAllUserSessions());
  };

  const handleGenerateRecoveryCodes = () => {
    if (!monitor) return;
    const { plainCodes } = generateMfaRecoveryCodes(monitor.id);
    setGeneratedCodes(plainCodes);
  };

  const handleSendPasswordReset = () => {
    if (!student) return;
    // In Phase 1 local mode, simulate sending reset email
    setResetSent(true);
    setTimeout(() => setResetSent(false), 5000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Monitor Settings & Controls</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Configure stopwatch visibility, question pacing parameters, and manage student security.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Student Registration & Access Controls (Amendment 1) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                Student Registration & Access Controls (Amendment 1)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure instant access registration, monitor approval gates, and daily registration abuse caps.
              </p>
            </div>
          </div>

          {/* Registration on/off switch */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Allow New Student Registrations</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Master switch for public student registrations. Kept off by default until production legal readiness is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegistrationEnabled(!registrationEnabled)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle student registration switch"
            >
              {registrationEnabled ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          {/* Require approval switch */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Require Manual Monitor Approval</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When OFF (default), new students receive immediate active access upon registration. When ON, accounts remain in pending_approval until approved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequireApproval(!requireApproval)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle require approval switch"
            >
              {requireApproval ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          {/* In-app notice on registration */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">In-App Alert on New Student Registration</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically generate an in-app monitor alert whenever a new student registers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegistrationInAppNotice(!registrationInAppNotice)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle in-app registration alert"
            >
              {registrationInAppNotice ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          {/* Daily registration cap */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase">
              Daily Registration Cap (Abuse Protection)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="500"
                value={dailyRegistrationCap}
                onChange={e => setDailyRegistrationCap(Math.max(1, parseInt(e.target.value) || 50))}
                className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-mono"
              />
              <span className="text-xs text-gray-500">
                Default: 50 accounts per calendar day. Further registrations are refused with a clear message.
              </span>
            </div>
          </div>
        </div>

        {/* Stopwatch Toggle */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" />
            Practice Stopwatch Visibility (FR-3.4, FR-11.10)
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Display live pacing stopwatch to student</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, student sees live timer turning amber and red. When disabled, time is still tracked silently.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStopwatchVisible(!stopwatchVisible)}
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {stopwatchVisible ? <ToggleRight size={38} /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>
        </div>

        {/* Ideal Pacing Configuration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon size={18} className="text-indigo-600" />
            Ideal Solving Times & Pacing Thresholds
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Basic Question (Seconds)
              </label>
              <input
                type="number"
                value={idealBasic}
                onChange={e => setIdealBasic(parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Default: 60s (1 min)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Medium Question (Seconds)
              </label>
              <input
                type="number"
                value={idealMedium}
                onChange={e => setIdealMedium(parseInt(e.target.value) || 120)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Default: 120s (2 min)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Advanced Question (Seconds)
              </label>
              <input
                type="number"
                value={idealAdvanced}
                onChange={e => setIdealAdvanced(parseInt(e.target.value) || 180)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Default: 180s (3 min)</span>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              "Still Solving?" Inactivity Check Timeout (Seconds)
            </label>
            <input
              type="number"
              value={idleTimeout}
              onChange={e => setIdleTimeout(parseInt(e.target.value) || 300)}
              className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Default: 300s (5 minutes without screen interaction asks if student is still solving on paper).
            </span>
          </div>
        </div>

        {/* Motor-Impaired Accessibility: Physical Keypad Support (Module M8) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Eye size={18} className="text-indigo-600" />
            Exam Accessibility: Physical Numeric Keypad (SRD Section 4.4, Item 6)
          </h2>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-semibold text-gray-800 text-sm">Allow physical keyboard input on Numerical Value Questions (NVQ)</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                By default, the NTA CBT simulator enforces on-screen mouse clicks to faithfully replicate official exam test centre hardware restrictions. Enable this exception to allow physical numeric keyboard typing for candidates with motor impairments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowPhysicalKeypadA11y(!allowPhysicalKeypadA11y)}
              className="text-indigo-600 hover:text-indigo-700 transition-colors shrink-0"
            >
              {allowPhysicalKeypadA11y ? <ToggleRight size={38} /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>
        </div>

        {/* Enhancement Program Feature Flags */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ToggleLeft size={18} className="text-indigo-600" />
            Enhancement Program Feature Flags
          </h2>
          <p className="text-xs text-gray-600">
            Control advanced features across the platform. Disabling any flag instantly returns the system to its baseline behavior with zero data loss.
          </p>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E10: UX Completeness & Safety</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables first-run onboarding tours, destructive action undo safeguards, in-app help guide, and student zero-time results download.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE10(!flagE10)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E10 UX Completeness"
            >
              {flagE10 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E9: Performance & Visual Polish</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables route code-splitting, next-question text prefetching, dark mode, and high-contrast theming (CBT exam interface remains strictly unchanged).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE9(!flagE9)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E9 Performance and Visual Polish"
            >
              {flagE9 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E13: Test Depth & QA Resilience</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables automated property-based invariant verification, parser fuzz testing, Edge Function contract gates, and 10x volume soak validations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE13(!flagE13)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E13 Test Depth"
            >
              {flagE13 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E12: Sync Idempotency & Resilience</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables offline sync deduplication via cryptographic hashes, telemetry event sequence gap detection, and exponential retry with dead-letter queue isolation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE12(!flagE12)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E12 Sync Idempotency and Resilience"
            >
              {flagE12 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E11: Account Security & Sessions</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables active session inventory and remote revocation, monitor-only new device alerts, MFA emergency recovery codes, and CSP violation audits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE11(!flagE11)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E11 Account Security and Sessions"
            >
              {flagE11 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E1: Adaptive Practice & Spaced Repetition v2</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables dynamic SM-2 intervals for revision scheduling and surfaces the student &ldquo;Today&rdquo; focus set capped strictly at 3 items per day.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE1(!flagE1)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E1 Adaptive Practice and Spaced Repetition"
            >
              {flagE1 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E6: Calibration & Error Analytics</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Surfaces Brier score, Expected Calibration Error (ECE), slip/guess rates, and error taxonomy matrices in monitor Outcomes &amp; Calibration.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE6(!flagE6)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E6 Calibration and Error Analytics"
            >
              {flagE6 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E3: Revision Cards &amp; Formula Sheets</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables verified chapter concept notes, high-yield KaTeX formula sheets, and clean printer-friendly formula downloads for the student.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE3(!flagE3)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E3 Revision Cards and Formula Sheets"
            >
              {flagE3 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E5: Advanced Exam Analytics</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Surfaces 4-quadrant speed/accuracy breakdowns, multi-pass attempt navigation order strategies, and avoided-slip &ldquo;what-if&rdquo; score projections.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE5(!flagE5)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E5 Advanced Exam Analytics"
            >
              {flagE5 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E8: Monitor Reporting Upgrades</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables saved custom report views with multifaceted filters, multi-sheet analytical exports, and monthly monitor-only summary digests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE8(!flagE8)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E8 Monitor Reporting Upgrades"
            >
              {flagE8 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E7: Auto-Compose Exam Draft &amp; Study Planner</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Auto-generates balanced 75-question mock exams matching official NTA distribution (20 MCQ + 5 NVQ per subject) and tracks weekly chapter study goals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE7(!flagE7)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E7 Auto-Compose Exam Draft and Study Planner"
            >
              {flagE7 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E4: Search &amp; &ldquo;More Like This&rdquo; Embeddings</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enables full-text token search and semantic similarity matching, surfacing curated &ldquo;More Like This&rdquo; suggestions post-submission only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE4(!flagE4)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E4 Question Search and Embeddings"
            >
              {flagE4 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module E2: Subtopic Taxonomy &amp; Prerequisite Concept Map</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Visualizes granular subtopic dependencies, prerequisite DAG validation, cycle detection, and student prerequisite readiness trees.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagE2(!flagE2)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module E2 Subtopic Taxonomy and Prerequisite Concept Map"
            >
              {flagE2 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Module G3: Practice Digital Scratchpad</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Provides an on-screen stylus/finger canvas scratchpad exclusively in Practice mode (strictly disabled in CBT Exam mode for NTA physical paper compliance).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlagG3(!flagG3)}
              className="text-indigo-600 hover:text-indigo-800 transition"
              aria-label="Toggle Module G3 Practice Digital Scratchpad"
            >
              {flagG3 ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
        >
          Save Configuration
        </button>

        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <span>Settings saved successfully.</span>
          </div>
        )}
      </form>

      {/* Student Account Management */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <KeyRound size={18} className="text-indigo-600" />
          Student Account Security (FR-1.8)
        </h2>
        <p className="text-xs text-gray-600">
          As monitor, you can trigger a password-reset email for the student without ever seeing or possessing their new password.
        </p>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase">Student Email</span>
            <p className="font-semibold text-gray-900 text-sm">{student?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSendPasswordReset}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-lg text-xs font-bold transition-colors"
          >
            <Mail size={14} /> Send Password Reset Email
          </button>
        </div>

        {resetSent && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span>Password reset request dispatched to {student?.email}.</span>
          </div>
        )}
      </div>

      {/* Module E11: Active Sessions & Remote Revocation */}
      {flagE11 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Laptop size={18} className="text-indigo-600" />
                Active Sessions & Device Control (Module E11)
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Inspect signed-in devices for student and monitor accounts. Revoke any session instantly to force sign-out.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              {allSessions.filter((s) => !s.is_revoked).length} Active Sessions
            </span>
          </div>

          <div className="space-y-2">
            {allSessions.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center bg-gray-50 rounded-xl">
                No active device sessions registered yet.
              </p>
            ) : (
              allSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {sess.device_summary.toLowerCase().includes('phone') ||
                    sess.device_summary.toLowerCase().includes('android') ||
                    sess.device_summary.toLowerCase().includes('ios') ? (
                      <Smartphone className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <Laptop className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{sess.device_summary}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            sess.is_revoked
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sess.is_revoked ? 'Revoked' : 'Active'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        User: {sess.user_id === student?.id ? 'Student' : 'Monitor'} · IP:{' '}
                        {sess.ip_address ?? 'Local'} · Last active:{' '}
                        {new Date(sess.last_active_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!sess.is_revoked && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Trash2 size={13} /> Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Module E11: MFA Emergency Recovery Codes */}
      {flagE11 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                MFA Emergency Recovery Codes (Module E11)
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Generate one-time emergency codes for secondary authentication recovery. Each code can be used exactly once.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateRecoveryCodes}
              className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition"
            >
              Generate 8 Emergency Codes
            </button>
          </div>

          {generatedCodes.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-amber-900">
                Save these recovery codes in a secure location. They will not be displayed again in plaintext:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-bold text-gray-800">
                {generatedCodes.map((code, idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-amber-200 text-center select-all">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

