// ============================================================
// Enhancement E8: Custom Reporting & Monthly Digest Generator
// Strictly Monitor-Only: Aggregated views, custom criteria, and digest.
// Adheres strictly to Zero-Student-Email Policy & Visibility Matrix.
// ============================================================

import {
  Response,
  Question,
  Attempt,
  Subject,
  Visit,
  Settings,
  ReportFilterCriteria,
  MonthlyDigestMetrics,
  getIdealTime,
} from './types';

/**
 * Filter responses based on monitor-configured criteria.
 */
export function filterResponsesByCriteria(
  responses: Response[],
  criteria: ReportFilterCriteria,
  qMap: Map<string, Question>,
  attMap: Map<string, Attempt>,
  nowMs: number = Date.now()
): Response[] {
  return responses.filter((r) => {
    if (!r.submitted_at) return false;

    // Date range filter
    const dateMs = new Date(r.submitted_at).getTime();
    if (criteria.date_range === 'today') {
      if ((nowMs - dateMs) / (1000 * 3600 * 24) > 1) return false;
    } else if (criteria.date_range === 'week') {
      if ((nowMs - dateMs) / (1000 * 3600 * 24) > 7) return false;
    } else if (criteria.date_range === 'month') {
      if ((nowMs - dateMs) / (1000 * 3600 * 24) > 30) return false;
    } else if (criteria.date_range === 'custom') {
      if (criteria.start_date && dateMs < new Date(criteria.start_date).getTime()) return false;
      if (criteria.end_date && dateMs > new Date(criteria.end_date).getTime()) return false;
    }

    // Mode filter (exam vs practice)
    const att = attMap.get(r.attempt_id);
    if (criteria.mode && criteria.mode !== 'all') {
      if (!att || att.mode !== criteria.mode) return false;
    }

    // Question-level subject filter
    const q = qMap.get(r.question_id);
    if (criteria.subject_id) {
      if (!q || q.subject_id !== criteria.subject_id) return false;
    }

    // Confidence filter
    if (criteria.confidence && r.confidence !== criteria.confidence) {
      return false;
    }

    // Error reason filter
    if (criteria.error_reason && r.error_reason !== criteria.error_reason) {
      return false;
    }

    // Score bounds filter on attempt
    if (criteria.min_score !== undefined || criteria.max_score !== undefined) {
      const score = att?.score ?? 0;
      if (criteria.min_score !== undefined && score < criteria.min_score) return false;
      if (criteria.max_score !== undefined && score > criteria.max_score) return false;
    }

    return true;
  });
}

/**
 * Compute aggregate metrics across a filtered set of responses.
 */
export function computeReportAggregates(
  responses: Response[],
  qMap: Map<string, Question>,
  subjects: Subject[],
  visits: Visit[],
  settings: Settings
) {
  const total = responses.length;
  if (total === 0) {
    return {
      totalQuestions: 0,
      accuracyPct: 0,
      averageSpeedIndex: 1.0,
      subjectBreakdowns: [],
      errorTaxonomyBreakdown: {},
    };
  }

  const correct = responses.filter((r) => r.is_correct === true).length;
  const accuracyPct = Math.round((correct / total) * 100);

  // Speed index: total actual seconds / total ideal seconds
  const responseIdSet = new Set(responses.map((r) => r.id));
  const relevantVisits = visits.filter((v) => responseIdSet.has(v.response_id));
  const visitTimeMap = new Map<string, number>();
  for (const v of relevantVisits) {
    const prev = visitTimeMap.get(v.response_id) || 0;
    visitTimeMap.set(v.response_id, prev + (v.active_seconds || 0));
  }

  let totalActualSecs = 0;
  let totalIdealSecs = 0;

  for (const r of responses) {
    const q = qMap.get(r.question_id);
    const actual = visitTimeMap.get(r.id) || 60;
    const ideal = q ? getIdealTime(settings, q.difficulty) : 60;
    totalActualSecs += actual;
    totalIdealSecs += ideal;
  }

  const averageSpeedIndex = totalIdealSecs > 0 ? Number((totalActualSecs / totalIdealSecs).toFixed(2)) : 1.0;

  // Subject breakdowns
  const sMap = new Map(subjects.map((s) => [s.id, s.name]));
  const subjectCounts: Record<string, { total: number; correct: number }> = {};

  for (const r of responses) {
    const q = qMap.get(r.question_id);
    const sName = (q && sMap.get(q.subject_id)) || 'General';
    if (!subjectCounts[sName]) {
      subjectCounts[sName] = { total: 0, correct: 0 };
    }
    subjectCounts[sName].total++;
    if (r.is_correct) subjectCounts[sName].correct++;
  }

  const subjectBreakdowns = Object.entries(subjectCounts).map(([name, counts]) => ({
    subject_name: name,
    questions_attempted: counts.total,
    accuracy: Math.round((counts.correct / counts.total) * 100),
  }));

  // Error taxonomy breakdown
  const errorCounts: Record<string, number> = {};
  for (const r of responses) {
    if (r.is_correct === false && r.error_reason) {
      errorCounts[r.error_reason] = (errorCounts[r.error_reason] || 0) + 1;
    }
  }

  return {
    totalQuestions: total,
    accuracyPct,
    averageSpeedIndex,
    subjectBreakdowns,
    errorTaxonomyBreakdown: errorCounts,
  };
}

/**
 * Generate monthly digest for a given year & month (1-12).
 * Output is strictly monitor-facing with calm, factual wording.
 */
export function generateMonthlyDigest(
  responses: Response[],
  attempts: Attempt[],
  visits: Visit[],
  qMap: Map<string, Question>,
  subjects: Subject[],
  settings: Settings,
  year: number,
  month: number // 1 to 12
): MonthlyDigestMetrics {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const monthResponses = responses.filter((r) => {
    if (!r.submitted_at) return false;
    const t = new Date(r.submitted_at).getTime();
    return t >= startMs && t <= endMs;
  });

  const attMap = new Map(attempts.map((a) => [a.id, a]));
  let practiceCount = 0;
  let examCount = 0;
  const activeDays = new Set<string>();

  for (const r of monthResponses) {
    const att = attMap.get(r.attempt_id);
    if (att?.mode === 'exam') {
      examCount++;
    } else {
      practiceCount++;
    }
    if (r.submitted_at) {
      activeDays.add(r.submitted_at.substring(0, 10));
    }
  }

  const aggregates = computeReportAggregates(monthResponses, qMap, subjects, visits, settings);

  const topErrorReasons = Object.entries(aggregates.errorTaxonomyBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    period_start: startDate.toISOString(),
    period_end: endDate.toISOString(),
    total_questions_attempted: aggregates.totalQuestions,
    overall_accuracy: aggregates.accuracyPct,
    practice_questions_count: practiceCount,
    exam_questions_count: examCount,
    subject_breakdowns: aggregates.subjectBreakdowns,
    top_error_reasons: topErrorReasons,
    active_days_count: activeDays.size,
    average_speed_index: aggregates.averageSpeedIndex,
  };
}

/**
 * Format Monthly Digest as Markdown string for the monitor dashboard.
 */
export function formatMonthlyDigestMarkdown(digest: MonthlyDigestMetrics, monthName: string, year: number): string {
  let md = `# Monitor Digest: ${monthName} ${year}\n\n`;
  md += `**Observation Window:** ${digest.period_start.substring(0, 10)} to ${digest.period_end.substring(0, 10)}\n`;
  md += `**Active Practice Days:** ${digest.active_days_count} days\n`;
  md += `**Total Questions Practiced:** ${digest.total_questions_attempted} (${digest.practice_questions_count} practice, ${digest.exam_questions_count} exam)\n`;
  md += `**Overall Accuracy:** ${digest.overall_accuracy}%\n`;
  md += `**Average Speed Index:** ${digest.average_speed_index}x of ideal time\n\n`;

  md += `### Subject Breakdown\n`;
  if (digest.subject_breakdowns.length === 0) {
    md += `*No questions attempted in this period.*\n\n`;
  } else {
    for (const sb of digest.subject_breakdowns) {
      md += `- **${sb.subject_name}:** ${sb.questions_attempted} questions, ${sb.accuracy}% accuracy\n`;
    }
    md += `\n`;
  }

  md += `### Primary Mistake Patterns\n`;
  if (digest.top_error_reasons.length === 0) {
    md += `*No mistake patterns recorded.*\n`;
  } else {
    for (const er of digest.top_error_reasons) {
      md += `- **${er.reason}:** ${er.count} instances\n`;
    }
  }

  return md;
}

