// ============================================================
// JEE Practice Hub — Module E11: Account Security & Sessions
// ============================================================

import { v4 as uuid } from 'uuid';
import type { UserSession, CspReport, MfaRecoveryCode } from './types';
import {
  getSettings,
  getUserSessions,
  insertUserSession,
  updateUserSession,
  insertCspReport,
  getMfaRecoveryCodes,
  saveMfaRecoveryCodes,
  markMfaRecoveryCodeUsed,
  insertMonitorNotice,
} from './db';
import { logSystemEvent } from './logger';
import { computeDeterministicHash } from './syncResilience';

/**
 * Parses user agent string into a concise human-readable device summary.
 */
export function parseDeviceSummary(userAgent?: string): string {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'Unknown Browser / Device';
  }

  let browser = 'Unknown Browser';
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';

  let os = 'Unknown OS';
  if (userAgent.includes('Windows NT 10.0')) os = 'Windows';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  else if (userAgent.includes('Mac OS X')) os = 'macOS';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

/**
 * Hashes a recovery code for secure database persistence.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return computeDeterministicHash(`recov_${normalized}`);
}

/**
 * Records a user login session and checks whether it represents a new/unseen device.
 * CRITICAL ZERO-STUDENT-EMAIL GUARANTEE:
 * Any new device alert is routed EXCLUSIVELY to the monitor notice log.
 * Never send any email or message to the student.
 */
export function recordSessionAndCheckDevice(options: {
  userId: string;
  userRole: 'student' | 'monitor';
  userAgent?: string;
  ipAddress?: string;
}): { session: UserSession; isNewDevice: boolean } {
  const existingSessions = getUserSessions(options.userId);
  const deviceSummary = parseDeviceSummary(options.userAgent);

  // Check if device or IP was previously seen
  const hasSeenDevice = existingSessions.some(
    (s) => s.device_summary === deviceSummary && (!options.ipAddress || s.ip_address === options.ipAddress)
  );
  const isNewDevice = existingSessions.length > 0 && !hasSeenDevice;

  const session: UserSession = {
    id: uuid(),
    user_id: options.userId,
    user_agent: options.userAgent ?? null,
    device_summary: deviceSummary,
    ip_address: options.ipAddress ?? null,
    last_active_at: new Date().toISOString(),
    is_revoked: false,
    created_at: new Date().toISOString(),
  };

  insertUserSession(session);

  // If flag enabled and new device detected, notify monitor exclusively
  const settings = getSettings();
  if (settings.flag_e11_account_security && isNewDevice) {
    insertMonitorNotice({
      attempt_id: null,
      student_id: options.userRole === 'student' ? options.userId : null,
      message: `Security Notice: New device login detected for ${options.userRole} account from ${deviceSummary} (IP: ${options.ipAddress ?? 'unknown'}).`,
      reason: 'new_device_login',
    });

    logSystemEvent('warn', 'security', `New device login for ${options.userRole}`, {
      user_id: options.userId,
      user_role: options.userRole,
      device_summary: deviceSummary,
      ip_address: options.ipAddress,
    });
  }

  return { session, isNewDevice };
}

/**
 * Validates whether an active session is valid and not revoked.
 */
export function isSessionValid(sessionId: string, userId: string): boolean {
  const sessions = getUserSessions(userId);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return false;
  if (session.is_revoked) return false;

  // Touch last_active_at
  updateUserSession(sessionId, { last_active_at: new Date().toISOString() });
  return true;
}

/**
 * Generates emergency MFA recovery codes for TOTP backup access.
 */
export function generateMfaRecoveryCodes(
  userId: string,
  count = 8
): { plainCodes: string[]; savedCodes: MfaRecoveryCode[] } {
  const plainCodes: string[] = [];
  const savedCodes: MfaRecoveryCode[] = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous characters

  for (let i = 0; i < count; i++) {
    let part1 = '';
    let part2 = '';
    for (let c = 0; c < 4; c++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const plain = `${part1}-${part2}`;
    plainCodes.push(plain);

    savedCodes.push({
      id: uuid(),
      user_id: userId,
      code_hash: hashRecoveryCode(plain),
      is_used: false,
      created_at: new Date().toISOString(),
    });
  }

  saveMfaRecoveryCodes(userId, savedCodes);

  return { plainCodes, savedCodes };
}

/**
 * Verifies and one-time consumes an MFA recovery code.
 */
export function verifyAndConsumeMfaRecoveryCode(userId: string, plainCode: string): boolean {
  if (!plainCode || plainCode.trim().length === 0) return false;
  const hash = hashRecoveryCode(plainCode);
  const codes = getMfaRecoveryCodes(userId);

  const matching = codes.find((c) => c.code_hash === hash && !c.is_used);
  if (!matching) return false;

  return markMfaRecoveryCodeUsed(matching.id);
}

/**
 * Logs a browser Content Security Policy (CSP) violation.
 */
export function logCspViolation(reportData: {
  document_uri: string;
  blocked_uri?: string | null;
  violated_directive: string;
  raw_report: Record<string, any>;
}): CspReport {
  const report: CspReport = {
    id: uuid(),
    document_uri: reportData.document_uri,
    blocked_uri: reportData.blocked_uri ?? null,
    violated_directive: reportData.violated_directive,
    raw_report: reportData.raw_report,
    reported_at: new Date().toISOString(),
  };

  insertCspReport(report);

  // Monitor notification for script injection or unsafe eval violations
  if (
    reportData.violated_directive.includes('script-src') ||
    reportData.violated_directive.includes('object-src')
  ) {
    logSystemEvent('warn', 'security', `CSP violation: ${reportData.violated_directive}`, {
      document_uri: reportData.document_uri,
      blocked_uri: reportData.blocked_uri,
    });
  }

  return report;
}
