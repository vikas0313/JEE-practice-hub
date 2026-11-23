// ============================================================
// Weekly Summary Email Service (Phase 3: SRD 4.16, Section 7)
// ============================================================

import {
  getStudentProfile, getProfiles, getPracticedQuestions, getAllQuestions,
  getAssignments, getAssignmentProgress, getTargets, getLatestEstimateSnapshot,
  getEmailLogs, logEmail, getAlertSettings, getQuestionSubject, getQuestionAnswerMonitor,
} from './db';
import { escapeHtml } from './contentSafety';

export interface WeeklyDigestData {
  recipientEmail: string;
  studentName: string;
  weekLabel: string;
  idempotencyKey: string;
  practicedCount: number;
  subjectBreakdown: Record<string, { total: number; correct: number; accuracy: number | null }>;
  assignments: Array<{ title: string; completed: number; target: number }>;
  targetEstimates: Array<{ name: string; rangeText: string }>;
  html: string;
  text: string;
}

/**
 * Returns ISO Year and Week number (e.g. "2026-W14")
 */
export function getIsoWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Compiles weekly summary report content.
 */
export function generateWeeklyDigest(studentId?: string, asOfStr?: string): WeeklyDigestData {
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const student = studentId ? getProfiles().find(p => p.id === studentId) : getStudentProfile();
  const monitor = getProfiles().find(p => p.role === 'monitor');
  const settings = getAlertSettings();

  const recipientEmail = settings.monitor_email || (monitor ? monitor.email : 'monitor@jeepractice.local');
  const studentName = student ? student.name : 'Student';
  const weekKey = getIsoWeekString(asOf);
  const idempotencyKey = `weekly-digest:${student ? student.id : 'unknown'}:${weekKey}`;

  // Time window: last 7 days from asOf
  const sevenDaysAgo = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
  const asOfTime = asOf.getTime();

  const allPracticed = student ? getPracticedQuestions(student.id) : [];
  const questions = getAllQuestions();

  const weeklyPracticed = allPracticed.filter(pq => {
    if (!pq.first_practiced_at) return false;
    const t = new Date(pq.first_practiced_at).getTime();
    return t >= sevenDaysAgo && t <= asOfTime;
  });

  const subjectStats: Record<string, { total: number; correct: number; accuracy: number | null }> = {
    Physics: { total: 0, correct: 0, accuracy: null },
    Chemistry: { total: 0, correct: 0, accuracy: null },
    Mathematics: { total: 0, correct: 0, accuracy: null },
  };

  weeklyPracticed.forEach(pq => {
    const q = questions.find(item => item.id === pq.question_id);
    if (!q) return;
    const subjName = getQuestionSubject(q);
    if (!subjectStats[subjName]) return;
    subjectStats[subjName].total++;
    const qa = getQuestionAnswerMonitor(q.id);
    const isCorrect = pq.last_result ?? (qa && pq.first_answer ? pq.first_answer === qa.correct_answer : false);
    if (isCorrect) {
      subjectStats[subjName].correct++;
    }
  });

  Object.keys(subjectStats).forEach(subj => {
    const s = subjectStats[subj];
    s.accuracy = s.total > 0 ? Number(((s.correct / s.total) * 100).toFixed(1)) : null;
  });

  // Active assignments
  const assignments = student ? getAssignments(student.id) : [];
  const assignmentSummaries = assignments.filter(a => a.status === 'active').map(a => {
    const prog = getAssignmentProgress(a.id);
    return {
      title: a.title,
      completed: prog.completedCount,
      target: prog.targetCount,
    };
  });

  // Targets & Projections
  const targets = student ? getTargets().filter(t => t.student_id === student.id) : [];
  const targetEstimates = targets.map(t => {
    const snap = student ? getLatestEstimateSnapshot(student.id, t.id) : null;
    let rangeText = 'Not enough data yet';
    if (snap && snap.p10_percentile !== null && snap.p90_percentile !== null) {
      rangeText = `${snap.p10_percentile.toFixed(1)} - ${snap.p90_percentile.toFixed(1)} percentile`;
    }
    return { name: t.name, rangeText };
  });

  // Format Plain Text
  const text = `
=== JEE PRACTICE HUB: WEEKLY MONITOR SUMMARY ===
Week: ${weekKey}
Student: ${studentName}

1. PRACTICE VOLUME
Questions practiced this week: ${weeklyPracticed.length}

2. SUBJECT ACCURACY
- Physics: ${subjectStats.Physics.total} Qs (${subjectStats.Physics.accuracy !== null ? `${subjectStats.Physics.accuracy}%` : 'N/A'})
- Chemistry: ${subjectStats.Chemistry.total} Qs (${subjectStats.Chemistry.accuracy !== null ? `${subjectStats.Chemistry.accuracy}%` : 'N/A'})
- Mathematics: ${subjectStats.Mathematics.total} Qs (${subjectStats.Mathematics.accuracy !== null ? `${subjectStats.Mathematics.accuracy}%` : 'N/A'})

3. ACTIVE ASSIGNMENTS
${assignmentSummaries.length > 0 ? assignmentSummaries.map(a => `- ${a.title}: ${a.completed}/${a.target} completed`).join('\n') : '- No active assignments'}

4. TARGET CHANCE PROJECTIONS
${targetEstimates.length > 0 ? targetEstimates.map(t => `- ${t.name}: ${t.rangeText}`).join('\n') : '- No targets defined'}
  `.trim();

  // Format HTML with strict escaping
  const safeWeekKey = escapeHtml(weekKey);
  const safeStudentName = escapeHtml(studentName);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; padding: 20px;">
      <h2 style="color: #4338ca; border-bottom: 2px solid #e0e7ff; padding-bottom: 8px;">JEE Practice Hub — Weekly Summary</h2>
      <p style="color: #6b7280; font-size: 14px;">Week: <strong>${safeWeekKey}</strong> | Student: <strong>${safeStudentName}</strong></p>

      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #374151;">Practice Volume</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 8px 0; color: #4f46e5;">${weeklyPracticed.length} questions</p>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Practiced over the last 7 days.</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 12px;">Subject Accuracy</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="background: #f3f4f6; text-align: left;">
            <th style="padding: 8px;">Subject</th>
            <th style="padding: 8px;">Questions</th>
            <th style="padding: 8px;">Accuracy</th>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Physics</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${subjectStats.Physics.total}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${subjectStats.Physics.accuracy !== null ? `${subjectStats.Physics.accuracy}%` : '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Chemistry</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${subjectStats.Chemistry.total}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${subjectStats.Chemistry.accuracy !== null ? `${subjectStats.Chemistry.accuracy}%` : '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Mathematics</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${subjectStats.Mathematics.total}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${subjectStats.Mathematics.accuracy !== null ? `${subjectStats.Mathematics.accuracy}%` : '—'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 8px;">Target Projections (Range)</h3>
        ${targetEstimates.map(t => `
          <div style="padding: 10px; background: #eef2ff; border-radius: 6px; margin-bottom: 6px;">
            <strong>${escapeHtml(t.name)}</strong>: <span style="color: #4338ca; font-weight: bold;">${escapeHtml(t.rangeText)}</span>
          </div>
        `).join('')}
      </div>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 30px;">Sent automatically by JEE Practice Hub. Confidential monitor report.</p>
    </div>
  `;

  return {
    recipientEmail,
    studentName,
    weekLabel: weekKey,
    idempotencyKey,
    practicedCount: weeklyPracticed.length,
    subjectBreakdown: subjectStats,
    assignments: assignmentSummaries,
    targetEstimates,
    html,
    text,
  };
}

/**
 * Sends or delivers the weekly summary email with strict idempotency (1 email per week).
 */
export async function sendWeeklySummaryEmail(options: {
  studentId?: string;
  as_of?: string;
  forceTest?: boolean;
}): Promise<{ success: boolean; idempotencyKey: string; message: string }> {
  const digest = generateWeeklyDigest(options.studentId, options.as_of);

  // Check idempotency unless forceTest is explicitly true
  if (!options.forceTest) {
    const existingLogs = getEmailLogs();
    const alreadySent = existingLogs.find(
      l => (l.idempotency_key === digest.idempotencyKey || (l as any).idempotencyKey === digest.idempotencyKey) && l.status === 'sent'
    );
    if (alreadySent) {
      return {
        success: true,
        idempotencyKey: digest.idempotencyKey,
        message: `Digest for ${digest.weekLabel} was already sent on ${alreadySent.sent_at}`,
      };
    }
  }

  // Delivery mechanism (Inbucket local mail catcher / simulated SMTP transport)
  try {
    // In local development / test environments, log email to database email_logs
    logEmail(
      digest.recipientEmail,
      `JEE Practice Hub Summary: ${digest.weekLabel}`,
      'weekly_digest',
      digest.idempotencyKey,
      'sent'
    );

    return {
      success: true,
      idempotencyKey: digest.idempotencyKey,
      message: `Weekly summary email delivered to ${digest.recipientEmail}`,
    };
  } catch (err: any) {
    logEmail(
      digest.recipientEmail,
      `JEE Practice Hub Summary: ${digest.weekLabel}`,
      'weekly_digest',
      digest.idempotencyKey,
      'failed'
    );
    return {
      success: false,
      idempotencyKey: digest.idempotencyKey,
      message: `Failed to deliver email: ${err.message}`,
    };
  }
}
