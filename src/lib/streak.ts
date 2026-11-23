// ============================================================
// Daily Goal, Streak & Exam Countdown (Phase 3: SRD 4.15)
// All date bucketing strictly uses Indian Standard Time (Asia/Kolkata)
// ============================================================

import { getPracticedQuestions, getTargets, getStudentProfile } from './db';

/**
 * Formats a Date object or ISO string into YYYY-MM-DD in Asia/Kolkata (UTC+5:30).
 */
export function getKolkataDateString(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  // Format in en-CA gives YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns previous calendar date in YYYY-MM-DD format safely in Asia/Kolkata.
 */
export function getPreviousKolkataDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  return getKolkataDateString(dt);
}

export interface StreakStats {
  todayDateStr: string;
  dailyGoal: number;
  todayCount: number;
  todayGoalMet: boolean;
  currentStreakDays: number;
  nearestTarget: {
    name: string;
    examDate: string;
    daysRemaining: number;
  } | null;
}

export interface StreakOptions {
  studentId?: string;
  dailyGoal?: number;
  as_of?: string; // Optional clock injection
}

/**
 * Computes daily count, goal attainment, and consecutive day streak in Asia/Kolkata.
 */
export function calculateStreakAndGoal(options: StreakOptions = {}): StreakStats {
  const asOf = options.as_of ? new Date(options.as_of) : new Date();
  const student = options.studentId ? { id: options.studentId } : getStudentProfile();
  const dailyGoal = options.dailyGoal ?? 20;

  if (!student) {
    return {
      todayDateStr: getKolkataDateString(asOf),
      dailyGoal,
      todayCount: 0,
      todayGoalMet: false,
      currentStreakDays: 0,
      nearestTarget: null,
    };
  }

  const studentId = student.id;
  const todayDateStr = getKolkataDateString(asOf);
  const practiced = getPracticedQuestions(studentId);

  // Group distinct questions by Kolkata calendar date
  const dateDistinctMap = new Map<string, Set<string>>();

  practiced.forEach(pq => {
    if (!pq.first_practiced_at) return;
    const itemDate = new Date(pq.first_practiced_at);
    // Ignore future events if as_of is injected
    if (itemDate.getTime() > asOf.getTime()) return;

    const dateStr = getKolkataDateString(itemDate);
    if (!dateDistinctMap.has(dateStr)) {
      dateDistinctMap.set(dateStr, new Set());
    }
    dateDistinctMap.get(dateStr)!.add(pq.question_id);
  });

  const todayCount = dateDistinctMap.get(todayDateStr)?.size ?? 0;
  const todayGoalMet = todayCount >= dailyGoal;

  // Streak calculation:
  // Walk backward calendar day by calendar day from yesterday (or today if today met goal)
  let streak = 0;
  let checkDateStr = todayDateStr;

  if (todayGoalMet) {
    streak = 1;
    checkDateStr = getPreviousKolkataDateString(todayDateStr);
  } else {
    checkDateStr = getPreviousKolkataDateString(todayDateStr);
    const yesterdayCount = dateDistinctMap.get(checkDateStr)?.size ?? 0;
    if (yesterdayCount < dailyGoal) {
      streak = 0;
    }
  }

  // Count backwards day by day as long as goal was met
  while (true) {
    const count = dateDistinctMap.get(checkDateStr)?.size ?? 0;
    if (count >= dailyGoal) {
      if (!todayGoalMet && streak === 0) {
        streak = 1;
      } else {
        streak++;
      }
      checkDateStr = getPreviousKolkataDateString(checkDateStr);
    } else {
      break;
    }
  }

  // Nearest Target countdown
  const targets = getTargets().filter(t => t.student_id === studentId);
  let nearestTarget: StreakStats['nearestTarget'] = null;

  const validUpcoming = targets
    .map(t => {
      const examTime = new Date(t.exam_date + 'T00:00:00+05:30').getTime();
      const asOfTime = asOf.getTime();
      const diffDays = Math.ceil((examTime - asOfTime) / (24 * 60 * 60 * 1000));
      return { name: t.name, examDate: t.exam_date, daysRemaining: diffDays };
    })
    .filter(t => t.daysRemaining >= 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  if (validUpcoming.length > 0) {
    nearestTarget = validUpcoming[0];
  }

  return {
    todayDateStr,
    dailyGoal,
    todayCount,
    todayGoalMet,
    currentStreakDays: streak,
    nearestTarget,
  };
}
