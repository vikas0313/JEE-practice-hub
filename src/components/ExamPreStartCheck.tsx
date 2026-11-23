import React, { useState, useEffect } from 'react';
import { Monitor, Maximize2, Wifi, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export interface PreStartCheckState {
  screenResolution: { passed: boolean; details: string };
  fullscreenSupport: { passed: boolean; details: string };
  onlineStatus: { passed: boolean; details: string };
  clockSkew: { passed: boolean; details: string };
  allPassed: boolean;
}

interface ExamPreStartCheckProps {
  onStatusChange?: (ready: boolean) => void;
  serverTimestamp?: string;
}

export function evaluateSystemReadiness(
  screenWidth: number,
  screenHeight: number,
  fullscreenEnabled: boolean,
  isOnline: boolean,
  clientTimeMs: number,
  serverTimeMs: number
): PreStartCheckState {
  // 1. Resolution Check: >= 1024x768 (or window inner width >= 1024)
  const resPassed = screenWidth >= 1024 && screenHeight >= 700;
  const screenResolution = {
    passed: resPassed,
    details: `${screenWidth} × ${screenHeight} px (Required: ≥ 1024 × 768)`,
  };

  // 2. Fullscreen Support
  const fullscreenSupport = {
    passed: fullscreenEnabled,
    details: fullscreenEnabled ? 'Supported & Enabled' : 'Fullscreen API unsupported or blocked',
  };

  // 3. Online Status
  const onlineStatus = {
    passed: isOnline,
    details: isOnline ? 'Connected' : 'Offline / No internet signal',
  };

  // 4. Clock Skew (< 30 seconds)
  const skewSeconds = Math.abs(clientTimeMs - serverTimeMs) / 1000;
  const clockPassed = skewSeconds < 30;
  const clockSkew = {
    passed: clockPassed,
    details: `Skew: ${skewSeconds.toFixed(1)}s (Allowed: < 30s)`,
  };

  const allPassed = resPassed && fullscreenEnabled && isOnline && clockPassed;

  return {
    screenResolution,
    fullscreenSupport,
    onlineStatus,
    clockSkew,
    allPassed,
  };
}

export function ExamPreStartCheck({ onStatusChange, serverTimestamp }: ExamPreStartCheckProps) {
  const [checkState, setCheckState] = useState<PreStartCheckState>(() =>
    evaluateSystemReadiness(
      window.innerWidth,
      window.innerHeight,
      Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled),
      navigator.onLine,
      Date.now(),
      serverTimestamp ? new Date(serverTimestamp).getTime() : Date.now()
    )
  );

  useEffect(() => {
    const runChecks = () => {
      const serverTimeMs = serverTimestamp ? new Date(serverTimestamp).getTime() : Date.now();
      const state = evaluateSystemReadiness(
        window.innerWidth,
        window.innerHeight,
        Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled),
        navigator.onLine,
        Date.now(),
        serverTimeMs
      );
      setCheckState(state);
      if (onStatusChange) {
        onStatusChange(state.allPassed);
      }
    };

    runChecks();
    window.addEventListener('resize', runChecks);
    window.addEventListener('online', runChecks);
    window.addEventListener('offline', runChecks);

    return () => {
      window.removeEventListener('resize', runChecks);
      window.removeEventListener('online', runChecks);
      window.removeEventListener('offline', runChecks);
    };
  }, [onStatusChange, serverTimestamp]);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-blue-600" />
          Pre-Start Technical Readiness Check
        </h3>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            checkState.allPassed
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {checkState.allPassed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Machine Ready
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5" />
              Action Required
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Screen Resolution */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            checkState.screenResolution.passed
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {checkState.screenResolution.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">Screen Resolution</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {checkState.screenResolution.details}
            </div>
            {!checkState.screenResolution.passed && (
              <div className="text-[11px] font-semibold text-rose-700 mt-1">
                Maximize browser window or use a larger screen.
              </div>
            )}
          </div>
        </div>

        {/* Fullscreen API */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            checkState.fullscreenSupport.passed
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {checkState.fullscreenSupport.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" /> Full-Screen Mode
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {checkState.fullscreenSupport.details}
            </div>
          </div>
        </div>

        {/* Connectivity */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            checkState.onlineStatus.passed
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {checkState.onlineStatus.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-slate-400" /> Internet Connectivity
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {checkState.onlineStatus.details}
            </div>
          </div>
        </div>

        {/* Clock Skew */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            checkState.clockSkew.passed
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {checkState.clockSkew.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> System Clock Synchronization
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {checkState.clockSkew.details}
            </div>
            {!checkState.clockSkew.passed && (
              <div className="text-[11px] font-semibold text-rose-700 mt-1">
                Synchronize local computer clock in OS Settings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

