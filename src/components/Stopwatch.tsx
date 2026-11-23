import React from 'react';
import { Clock, Pause, Play } from 'lucide-react';

interface StopwatchProps {
  elapsedSeconds: number;
  idealTimeSeconds: number;
  visible: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
}

export function Stopwatch({
  elapsedSeconds,
  idealTimeSeconds,
  visible,
  isPaused,
  onTogglePause,
}: StopwatchProps) {
  if (!visible) return null;

  const amberThreshold = idealTimeSeconds;
  const redThreshold = idealTimeSeconds * 1.5;

  let colorClass = 'text-green-600 bg-green-50 border-green-200';
  if (elapsedSeconds > redThreshold) {
    colorClass = 'text-red-600 bg-red-50 border-red-200 animate-pulse';
  } else if (elapsedSeconds > amberThreshold) {
    colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
  }

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-medium ${colorClass}`}>
      <Clock size={16} />
      <span>{formatted}</span>
      <button
        type="button"
        onClick={onTogglePause}
        className="ml-1 p-1 rounded hover:bg-black/5 active:bg-black/10 transition-colors"
        title={isPaused ? 'Resume' : 'Pause'}
      >
        {isPaused ? <Play size={14} className="fill-current" /> : <Pause size={14} className="fill-current" />}
      </button>
    </div>
  );
}

