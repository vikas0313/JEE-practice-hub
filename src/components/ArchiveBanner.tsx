import React from 'react';
import { isArchiveModeActive } from '../lib/db';
import { Archive, Lock } from 'lucide-react';

export function ArchiveBanner({ role }: { role?: 'student' | 'monitor' }) {
  if (!isArchiveModeActive()) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs sm:text-sm font-medium shadow-md flex items-center justify-between sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center gap-2.5 w-full">
        <Lock className="w-4 h-4 shrink-0 text-amber-200" />
        <div className="flex-1">
          <span className="font-bold tracking-wide uppercase mr-2 text-[11px] bg-amber-800/60 px-2 py-0.5 rounded">
            Archive Mode Active
          </span>
          {role === 'student' ? (
            <span>
              The Class 12 JEE preparation cycle has concluded. The system is in read-only archive mode. Question practice and test taking are disabled; your complete study history, mistake notebook, and score analysis remain available for review.
            </span>
          ) : (
            <span>
              Database-enforced Archive Mode is ON. Student practice submissions and exam attempts are blocked at the database level. All monitor analytics, trajectory graphs, and data exports remain fully accessible.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
