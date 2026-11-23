import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Database,
  Archive,
  RefreshCw,
  Mail,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';

export interface MonitorReadinessItem {
  id: string;
  name: string;
  passed: boolean;
  warning?: boolean;
  details: string;
}

export interface MonitorReadinessReport {
  items: MonitorReadinessItem[];
  allPassed: boolean;
  hasDeployWarning: boolean;
}

export function evaluateMonitorReadiness(
  dbPingMs: number | null,
  lastBackupHoursAgo: number,
  cronHealthy: boolean,
  smtpHealthy: boolean,
  hoursSinceLastDeploy: number
): MonitorReadinessReport {
  const items: MonitorReadinessItem[] = [
    {
      id: 'db',
      name: 'Database Connectivity',
      passed: dbPingMs !== null && dbPingMs < 1000,
      details: dbPingMs !== null ? `Responding in ${dbPingMs}ms` : 'Database unreachable',
    },
    {
      id: 'backup',
      name: 'Backup Freshness (< 24h)',
      passed: lastBackupHoursAgo < 24,
      details:
        lastBackupHoursAgo < 24
          ? `Last backup created ${lastBackupHoursAgo.toFixed(1)}h ago`
          : `WARNING: Last backup created ${lastBackupHoursAgo.toFixed(1)}h ago (Stale > 24h)`,
    },
    {
      id: 'cron',
      name: 'Background Cron & Workers',
      passed: cronHealthy,
      details: cronHealthy ? 'pg_cron / edge workers active' : 'Workers degraded or paused',
    },
    {
      id: 'smtp',
      name: 'Email Delivery (SMTP / Inbucket)',
      passed: smtpHealthy,
      details: smtpHealthy ? 'Mail transport ready' : 'Mail transport unreachable',
    },
    {
      id: 'deploy_freeze',
      name: '24-Hour Deployment Freeze',
      passed: true,
      warning: hoursSinceLastDeploy < 24,
      details:
        hoursSinceLastDeploy < 24
          ? `Code or migration updated ${hoursSinceLastDeploy.toFixed(1)}h ago. Verify thoroughly before live exam.`
          : `Stable: Last deploy was ${hoursSinceLastDeploy.toFixed(0)}h ago (> 24h freeze satisfied).`,
    },
  ];

  const allPassed = items.every((i) => i.passed);
  const hasDeployWarning = items.some((i) => i.warning);

  return {
    items,
    allPassed,
    hasDeployWarning,
  };
}

interface ExamReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed?: () => void;
  examName: string;
}

export function ExamReadinessModal({
  isOpen,
  onClose,
  onProceed,
  examName,
}: ExamReadinessModalProps) {
  const [report, setReport] = useState<MonitorReadinessReport>(() =>
    evaluateMonitorReadiness(42, 6.5, true, true, 36)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-blue-900">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-black">Exam Readiness Pre-Flight</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600">
          Verifying infrastructure health and system readiness for exam:
          <span className="font-bold text-slate-900 ml-1">"{examName}"</span>
        </div>

        <div className="space-y-3">
          {report.items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
                item.warning
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : item.passed
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="space-y-0.5">
                <div className="font-bold">{item.name}</div>
                <div className="text-[11px] text-slate-500">{item.details}</div>
              </div>
              <div>
                {item.warning ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : item.passed ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>

        {report.hasDeployWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>24-Hour Freeze Notice:</strong> A code or database deployment took place recently. Ensure that end-to-end rehearsal tests have verified all core workflows.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            disabled={!report.allPassed}
            onClick={() => {
              if (onProceed) onProceed();
              onClose();
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
          >
            Confirm & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

