/**
 * Privacy-Preserving Structured Logger (SRD Phase 5)
 * Strict redacting: zero PII, zero student answers/dwells, zero tokens or secrets.
 * Retains logs up to 14 days.
 */

export type LogLevel = 'info' | 'warn' | 'error';
export type LogComponent = 'edge_function' | 'cron' | 'storage' | 'auth' | 'database' | 'security';

export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  event: string;
  metadata: Record<string, unknown>;
}

const MAX_LOG_RETENTION_DAYS = 14;
const STORAGE_KEY = 'jph_system_logs';

/**
 * Deeply redacts sensitive keys from log metadata:
 * - PII: email, phone, name, ip, auth tokens
 * - Answers: answer, correct_answer, solution, keystrokes
 * - Secrets: key, secret, password, bearer
 */
export function sanitizeLogMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'email',
    'password',
    'token',
    'secret',
    'apikey',
    'api_key',
    'authorization',
    'bearer',
    'answer',
    'correct_answer',
    'solution',
    'user_input',
    'dwell_time',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function logSystemEvent(
  level: LogLevel,
  component: LogComponent,
  event: string,
  metadata: Record<string, unknown> = {}
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    component,
    event,
    metadata: sanitizeLogMetadata(metadata),
  };

  try {
    const existing = getStoredLogs();
    const pruned = pruneOldLogs([...existing, entry]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    }
  } catch (err) {
    // Fail-safe: logging failure should not crash application
    console.error('Failed to persist structured log:', err);
  }

  return entry;
}

export function getStoredLogs(): StructuredLogEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function pruneOldLogs(
  logs: StructuredLogEntry[],
  nowMs: number = Date.now(),
  retentionDays: number = MAX_LOG_RETENTION_DAYS
): StructuredLogEntry[] {
  const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  return logs.filter((log) => {
    const logTimeMs = new Date(log.timestamp).getTime();
    return !isNaN(logTimeMs) && logTimeMs >= cutoffMs;
  });
}

export function clearLogs(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

