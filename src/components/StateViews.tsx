import React from 'react';
import { AlertTriangle, WifiOff, Clock, Inbox, RefreshCw, ChevronRight } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border border-dashed border-gray-300 my-6">
      <div className="p-3 bg-gray-50 rounded-full text-gray-400 mb-3">
        <Icon size={32} />
      </div>
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mt-1">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition flex items-center gap-1.5"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorViewProps) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center my-6">
      <div className="inline-flex p-2 bg-red-100 rounded-full text-red-600 mb-3">
        <AlertTriangle size={28} />
      </div>
      <h3 className="text-base font-semibold text-red-800">{title}</h3>
      <p className="text-sm text-red-600 max-w-md mx-auto mt-1 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 my-6" aria-label="Loading content...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white p-5 rounded-lg border border-gray-200 animate-pulse space-y-3"
        >
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-100 rounded w-full"></div>
          <div className="h-3 bg-gray-100 rounded w-4/5"></div>
          <div className="h-8 bg-gray-100 rounded w-24 pt-2"></div>
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div
      role="status"
      className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
    >
      <WifiOff size={16} />
      <span>You are currently offline. Responses and bookmarks are being buffered locally.</span>
    </div>
  );
}

export function SessionTimeoutBanner({
  secondsRemaining,
  onExtend,
}: {
  secondsRemaining: number;
  onExtend: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl border border-gray-700 max-w-sm flex items-start gap-3"
    >
      <Clock size={20} className="text-amber-400 shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-semibold">Inactivity Warning</h4>
        <p className="text-xs text-gray-300 mt-0.5">
          Your session will pause in {secondsRemaining} seconds due to inactivity.
        </p>
        <button
          onClick={onExtend}
          className="mt-2.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
        >
          I am still here
        </button>
      </div>
    </div>
  );
}

