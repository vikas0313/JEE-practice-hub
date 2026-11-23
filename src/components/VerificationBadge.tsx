import React from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck, Flag } from 'lucide-react';
import type { VerificationStatus } from '../lib/types';

const config: Record<VerificationStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  'Unverified': { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Unverified' },
  'Key-matched': { icon: CheckCircle, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Key Matched' },
  'Reviewed': { icon: ShieldCheck, color: 'text-green-600 bg-green-50 border-green-200', label: 'Reviewed' },
  'Flagged': { icon: Flag, color: 'text-red-600 bg-red-50 border-red-200', label: 'Flagged' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const c = config[status] || config['Unverified'];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}

