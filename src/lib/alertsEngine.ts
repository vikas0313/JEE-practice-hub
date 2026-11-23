// ============================================================
// Alerts Engine & Cooldown Evaluator (Phase 3: SRD FR-8.1, Section 8)
// ============================================================

import type { Alert, AlertSettings } from './types';
import {
  getAlerts, createAlert, resolveAlert, getAlertSettings,
  getPracticedQuestions, getAllQuestions, getTargets,
  getChapterWeightages, getAttempts, getStudentProfile,
  getQuestionChapter,
} from './db';

export interface AlertEvaluationOptions {
  studentId?: string;
  as_of?: string; // Optional injectable clock for deterministic testing
}

export function evaluateAlerts(options: AlertEvaluationOptions = {}): { generated: Alert[]; resolved: Alert[] } {
  const asOf = options.as_of ? new Date(options.as_of) : new Date();
  const student = options.studentId ? { id: options.studentId } : getStudentProfile();
  if (!student) return { generated: [], resolved: [] };

  const studentId = student.id;
  const settings: AlertSettings = getAlertSettings();
  const generated: Alert[] = [];
  const resolved: Alert[] = [];

  const practiced = getPracticedQuestions(studentId);
  const questions = getAllQuestions();
  const targets = getTargets().filter(t => t.student_id === studentId);
  const existingAlerts = getAlerts().filter(a => a.student_id === studentId);

  // -------------------------------------------------------------
  // Trigger 1: Inactivity Alert
  // -------------------------------------------------------------
  const inactivityDays = settings.inactivity_days || 3;
  const inactivityThresholdMs = inactivityDays * 24 * 60 * 60 * 1000;

  // Find latest practice submission
  let lastPracticeTime = 0;
  practiced.forEach(pq => {
    if (pq.first_practiced_at) {
      const t = new Date(pq.first_practiced_at).getTime();
      if (t <= asOf.getTime() && t > lastPracticeTime) {
        lastPracticeTime = t;
      }
    }
  });

  const inactivityDedupeKey = `inactivity:${studentId}`;
  const activeInactivityAlert = existingAlerts.find(a => a.dedupe_key === inactivityDedupeKey && a.status === 'active');

  if (lastPracticeTime > 0 && asOf.getTime() - lastPracticeTime > inactivityThresholdMs) {
    const daysSince = Math.floor((asOf.getTime() - lastPracticeTime) / (24 * 60 * 60 * 1000));
    // 24 hour cooldown
    const cooldownUntil = new Date(asOf.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const alert = createAlert({
      student_id: studentId,
      alert_type: 'inactivity',
      severity: 'warning',
      dedupe_key: inactivityDedupeKey,
      title: 'Extended Inactivity Detected',
      message: `No practice questions submitted in ${daysSince} days (threshold: ${inactivityDays} days).`,
      status: 'active',
      cooldown_until: cooldownUntil,
      metadata: { daysSince, lastPracticeTime: new Date(lastPracticeTime).toISOString() },
    }, asOf);
    if (alert) generated.push(alert);
  } else if (activeInactivityAlert && lastPracticeTime > 0 && asOf.getTime() - lastPracticeTime <= inactivityThresholdMs) {
    // Auto-resolve when student resumed practicing
    const res = resolveAlert(activeInactivityAlert.id);
    if (res) resolved.push(res);
  }

  // -------------------------------------------------------------
  // Trigger 2: Low Syllabus Coverage Alert (< 70% with <= 60 days to target exam)
  // -------------------------------------------------------------
  const upcomingTargets = targets
    .map(t => ({ target: t, examTime: new Date(t.exam_date).getTime() }))
    .filter(t => t.examTime >= asOf.getTime())
    .sort((a, b) => a.examTime - b.examTime);

  if (upcomingTargets.length > 0) {
    const nearest = upcomingTargets[0];
    const daysToExam = Math.ceil((nearest.examTime - asOf.getTime()) / (24 * 60 * 60 * 1000));

    if (daysToExam <= 60) {
      // Calculate chapter coverage
      const practicedChapters = new Set<string>();
      practiced.forEach(pq => {
        if (!pq.first_practiced_at || new Date(pq.first_practiced_at).getTime() > asOf.getTime()) return;
        const q = questions.find(item => item.id === pq.question_id);
        if (q && q.answer_status !== 'Dropped') practicedChapters.add(getQuestionChapter(q));
      });

      const totalChapters = getChapterWeightages().length || 30;
      const coveragePct = (practicedChapters.size / totalChapters) * 100;

      const coverageDedupeKey = `low_coverage:${studentId}`;
      const activeCoverageAlert = existingAlerts.find(a => a.dedupe_key === coverageDedupeKey && a.status === 'active');

      if (coveragePct < 70) {
        // 7-day cooldown
        const cooldownUntil = new Date(asOf.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const alert = createAlert({
          student_id: studentId,
          alert_type: 'low_coverage',
          severity: 'warning',
          dedupe_key: coverageDedupeKey,
          title: 'Low Syllabus Coverage Warning',
          message: `Syllabus coverage is only ${coveragePct.toFixed(1)}% (${practicedChapters.size}/${totalChapters} chapters) with ${daysToExam} days remaining until ${nearest.target.name}.`,
          status: 'active',
          cooldown_until: cooldownUntil,
          metadata: { coveragePct, daysToExam, targetName: nearest.target.name },
        }, asOf);
        if (alert) generated.push(alert);
      } else if (activeCoverageAlert && coveragePct >= 70) {
        const res = resolveAlert(activeCoverageAlert.id);
        if (res) resolved.push(res);
      }
    }
  }

  // -------------------------------------------------------------
  // Trigger 3: Left Fullscreen in Exam
  // -------------------------------------------------------------
  const attempts = getAttempts().filter(a => a.student_id === studentId);
  attempts.forEach(att => {
    if (att.submit_reason === 'left_full_screen') {
      const dedupeKey = `exam_left_fullscreen:${att.id}`;
      const existing = existingAlerts.find(a => a.dedupe_key === dedupeKey);
      if (!existing) {
        const alert = createAlert({
          student_id: studentId,
          alert_type: 'exam_exit',
          severity: 'critical',
          dedupe_key: dedupeKey,
          title: 'Exam Terminated: Left Full Screen',
          message: `An exam attempt was auto-submitted because the student exited full screen.`,
          status: 'active',
          metadata: { attemptId: att.id, examId: att.exam_id },
        });
        if (alert) generated.push(alert);
      }
    }
  });

  return { generated, resolved };
}
