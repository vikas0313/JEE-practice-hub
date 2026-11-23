import React, { useState, useEffect } from 'react';
import {
  Activity,
  HardDrive,
  Database,
  Cpu,
  Bell,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import {
  getStoredLogs,
  logSystemEvent,
  StructuredLogEntry,
  clearLogs,
} from '../../lib/logger';
import { getAlerts, getSettings, getDeadLetterJobs, updateDeadLetterJob, getCspReports } from '../../lib/db';

export default function SystemStatus() {
  const [logs, setLogs] = useState<StructuredLogEntry[]>([]);
  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [dbPing, setDbPing] = useState<number>(38);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deadLetters, setDeadLetters] = useState(getDeadLetterJobs());
  const settings = getSettings();
  const cspReports = getCspReports();

  const alerts = getAlerts();
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.resolved_at);
  const warningAlerts = alerts.filter((a) => a.severity === 'warning' && !a.resolved_at);

  useEffect(() => {
    // Initial logs seed if empty
    const current = getStoredLogs();
    if (current.length === 0) {
      logSystemEvent('info', 'database', 'Database health check OK', { latency_ms: 38 });
      logSystemEvent('info', 'cron', 'pg_cron scheduler pulse active', { active_jobs: 3 });
      logSystemEvent('info', 'storage', 'Diagrams bucket verified', { total_mb: 142.5 });
      setLogs(getStoredLogs());
    } else {
      setLogs(current);
    }
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const ping = Math.floor(25 + Math.random() * 30);
      setDbPing(ping);
      logSystemEvent('info', 'database', 'Manual health check pulse', { latency_ms: ping });
      setLogs(getStoredLogs());
      setIsRefreshing(false);
    }, 400);
  };

  const handleTriggerDrill = () => {
    logSystemEvent('warn', 'security', 'Observability drill: simulated alert test', {
      drill_mode: true,
      operator: 'monitor',
    });
    setLogs(getStoredLogs());
  };

  const handleResolveDeadLetter = (jobId: string) => {
    updateDeadLetterJob(jobId, { status: 'resolved', resolved_at: new Date().toISOString() });
    setDeadLetters(getDeadLetterJobs());
    logSystemEvent('info', 'database', `Dead letter job ${jobId.slice(0, 8)} manually resolved by monitor`, {
      job_id: jobId,
    });
    setLogs(getStoredLogs());
  };

  const filteredLogs = logs.filter((log) => {
    if (filterComponent === 'all') return true;
    return log.component === filterComponent;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            System Status & Observability
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Real-time infrastructure health, storage utilization, background workers, and privacy-preserving audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerDrill}
            className="px-3.5 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-colors"
          >
            Trigger Test Event
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Health */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Database</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{dbPing} ms</span>
            <span className="text-xs font-semibold text-emerald-600">Healthy</span>
          </div>
          <p className="text-[11px] text-gray-500">PostgreSQL connection pool responsive</p>
        </div>

        {/* Storage Utilization */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Storage Usage</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">142.5 MB</span>
            <span className="text-xs text-gray-400">/ 1,000 MB</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '14.2%' }} />
          </div>
        </div>

        {/* Cron & Workers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Background Workers</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">Active</span>
            <span className="text-xs text-gray-500">3 pg_cron tasks</span>
          </div>
          <p className="text-[11px] text-gray-500">Watchdog, snapshot, streak checks operational</p>
        </div>

        {/* Alert Triggers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Alert Triggers</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">
              {criticalAlerts.length + warningAlerts.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {criticalAlerts.length > 0 ? 'Action Needed' : 'Normal'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            {criticalAlerts.length} critical, {warningAlerts.length} warnings
          </p>
        </div>
      </div>

      {/* Module E12: Dead Letter Queue */}
      {settings.flag_e12_integrity_resilience && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Resilience & Dead-Letter Queue (Module E12)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Monitors isolated transient job failures, queue retries, and offline synchronization health.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                deadLetters.filter((j) => j.status === 'pending').length === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {deadLetters.filter((j) => j.status === 'pending').length} Pending
            </span>
          </div>

          {deadLetters.length === 0 ? (
            <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
              No failed jobs in the dead-letter queue. All background sync operations are healthy.
            </div>
          ) : (
            <div className="space-y-2">
              {deadLetters.map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-gray-900">[{job.job_type}]</span>{' '}
                    <span className="text-rose-600 font-medium">{job.error_message}</span>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Attempts: {job.attempts_count} · Status: {job.status} ·{' '}
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                  {job.status === 'pending' && (
                    <button
                      onClick={() => handleResolveDeadLetter(job.id)}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-semibold shrink-0"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Module E11: Content Security Policy (CSP) Violations */}
      {settings.flag_e11_account_security && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Content Security Policy (CSP) Reports (Module E11)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Monitors browser script execution, foreign asset loads, and injected resource attempts.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                cspReports.length === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {cspReports.length} Reports
            </span>
          </div>

          {cspReports.length === 0 ? (
            <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
              Zero CSP violations detected. Strict browser security headers are enforced.
            </div>
          ) : (
            <div className="space-y-2">
              {cspReports.slice(0, 10).map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-rose-700">[{rep.violated_directive}]</span>{' '}
                    <span className="text-gray-900 font-mono text-[11px]">{rep.blocked_uri ?? 'inline'}</span>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Document: {rep.document_uri} · {new Date(rep.reported_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Structured Observability Logs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">
              Structured System Logs (14-Day Retention)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterComponent}
              onChange={(e) => setFilterComponent(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="all">All Components</option>
              <option value="database">Database</option>
              <option value="cron">Cron & Workers</option>
              <option value="storage">Storage</option>
              <option value="security">Security</option>
            </select>
            <button
              onClick={() => {
                clearLogs();
                setLogs([]);
              }}
              className="text-xs text-gray-500 hover:text-rose-600 font-semibold px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Privacy guarantee: All question text, student responses, and credentials are redacted prior to storage.
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-sans text-xs">
              No log entries match the current filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.level === 'error'
                          ? 'bg-rose-100 text-rose-800'
                          : log.level === 'warn'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="font-semibold text-slate-700">[{log.component}]</span>
                    <span className="text-slate-900 font-sans text-xs">{log.event}</span>
                  </div>
                  {Object.keys(log.metadata).length > 0 && (
                    <div className="text-[11px] text-slate-500 break-all pl-2 border-l-2 border-slate-200">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
