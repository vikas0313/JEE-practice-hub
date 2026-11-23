import React, { useState, useEffect } from 'react';

export interface PracticeStopwatchGaugeProps {
  idealTime: number;
  isPaused: boolean;
  isSubmitted: boolean;
  showInactivityModal: boolean;
  idleTimeout: number;
  resetKey: string;
  lastInteractionTimeRef: React.RefObject<number>;
  elapsedRef: React.MutableRefObject<number>;
  onTriggerInactivity: () => void;
}

export function PracticeStopwatchGauge({
  idealTime,
  isPaused,
  isSubmitted,
  showInactivityModal,
  idleTimeout,
  resetKey,
  lastInteractionTimeRef,
  elapsedRef,
  onTriggerInactivity,
}: PracticeStopwatchGaugeProps) {
  const [elapsed, setElapsed] = useState<number>(0);

  // Reset stopwatch when question changes
  useEffect(() => {
    setElapsed(0);
    elapsedRef.current = 0;
  }, [resetKey, elapsedRef]);

  // Autonomous 1-second interval (does not re-render parent)
  useEffect(() => {
    if (isSubmitted || isPaused || showInactivityModal) return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });

      const lastInteraction = lastInteractionTimeRef.current || Date.now();
      const idleTime = (Date.now() - lastInteraction) / 1000;
      if (idleTime >= idleTimeout && !showInactivityModal) {
        onTriggerInactivity();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, isPaused, showInactivityModal, idleTimeout, onTriggerInactivity, elapsedRef, lastInteractionTimeRef]);

  // Circular gauge calculations
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(elapsed / (idealTime || 60), 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  let gaugeColor = '#34d399'; // Mint/Emerald
  if (elapsed > idealTime * 1.5) gaugeColor = '#f87171'; // Red
  else if (elapsed > idealTime) gaugeColor = '#fbbf24'; // Amber

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
        {/* Background track */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="#f1f5f9"
          strokeWidth="12"
          fill="transparent"
        />
        {/* Progress ring */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={gaugeColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black text-gray-900 tracking-tight font-mono">
          {elapsed}
        </span>
        <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest -mt-1">
          SEC
        </span>
      </div>
    </div>
  );
}
