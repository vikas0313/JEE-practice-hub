import React, { useState, useEffect } from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';
import { executeUndoAction } from '../lib/db';
import type { DestructiveAction } from '../lib/types';

interface UndoToastProps {
  action: DestructiveAction | null;
  onUndoSuccess: (targetId: string) => void;
  onDismiss: () => void;
}

export function UndoToast({ action, onUndoSuccess, onDismiss }: UndoToastProps) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;

    const expiryTime = new Date(action.expires_at).getTime();
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        onDismiss();
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [action, onDismiss]);

  if (!action) return null;

  const handleUndo = () => {
    setLoading(true);
    setError(null);
    try {
      const res = executeUndoAction(action.monitor_id, action.id);
      if (res.success && res.restoredTargetId) {
        onUndoSuccess(res.restoredTargetId);
        onDismiss();
      } else {
        setError(res.error || 'Failed to undo action');
      }
    } catch (e: any) {
      setError(e.message || 'Undo operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-lg shadow-2xl p-4 max-w-md w-full border border-gray-700 animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-md shrink-0 mt-0.5">
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-100">{action.description}</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Undo available for {secondsLeft} seconds
            </p>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUndo}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition flex items-center gap-1"
          >
            <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Undo</span>
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition"
            aria-label="Dismiss undo notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 h-1 rounded-full mt-3 overflow-hidden">
        <div
          className="bg-amber-400 h-full transition-all duration-1000 ease-linear"
          style={{ width: `${(secondsLeft / 30) * 100}%` }}
        />
      </div>
    </div>
  );
}

