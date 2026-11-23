import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export interface ExamCountdownTimerProps {
  initialSeconds: number;
  onTimeUp: () => void;
}

export const ExamCountdownTimer = React.memo(function ExamCountdownTimer({ initialSeconds, onTimeUp }: ExamCountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (initialSeconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUpRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [initialSeconds]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(h)}:${pad(m)}:${pad(s)}`;

  return (
    <div className="bg-[#183973] border border-white/20 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
      <Clock className="w-4 h-4 text-amber-300" />
      <span className="text-xs font-bold text-gray-200">Time Left:</span>
      <span className="font-mono font-black text-lg text-amber-300 tracking-wider">
        {formatted}
      </span>
    </div>
  );
});
