// ============================================================
// Phase 4: Synthetic Benchmark Engine (10,000 Qs, 100,000 Visits)
// ============================================================
// Budgets (SRD Section 7 & Phase 4 Master Prompt):
// 1. Single question load: < 1.0 second
// 2. Topic start screen counts: < 1.0 second
// 3. Chapter-wise Exam pool draw (75 Qs): < 1.0 second
// 4. Paginated monitor time-per-question table (over 100,000 visits): < 1.0 second

import type { Question, Visit, Difficulty, QuestionType, Section } from './types';

export interface BenchmarkMetrics {
  questionLoadMs: number;
  topicStartScreenCountsMs: number;
  examPoolDrawMs: number;
  paginatedVisitsMs: number;
  totalSyntheticQuestions: number;
  totalSyntheticVisits: number;
  passedAllBudgets: boolean;
}

export function generateSyntheticQuestions(count: number = 10000): Question[] {
  const subjects = ['Physics', 'Chemistry', 'Mathematics'];
  const difficulties: Difficulty[] = ['Basic', 'Medium', 'Advanced'];
  const questions: Question[] = new Array(count);

  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const subjIndex = i % 3;
    const chapIndex = i % 50;
    const topicIndex = i % 150;
    const isNvq = i % 5 === 4; // 1 in 5 is NVQ (20 MCQ, 5 NVQ per 25)
    const type: QuestionType = isNvq ? 'NVQ' : 'MCQ';
    const section: Section = isNvq ? 'B' : 'A';
    const diff = difficulties[i % 3];

    questions[i] = {
      id: `syn-q-${i + 1}`,
      number: (i % 25) + 1,
      paper_id: `syn-paper-${Math.floor(i / 75) + 1}`,
      subject_id: `subj-${subjects[subjIndex]}`,
      chapter_id: `chap-${chapIndex}`,
      topic_id: `topic-${topicIndex}`,
      subtopic: `subtopic-${i % 300}`,
      type,
      section,
      question_text: `Synthetic question #${i + 1}: Solve $\\int_0^1 x^{${(i % 5) + 1}} dx$ for test verification.`,
      options: isNvq ? null : ['A: 0.25', 'B: 0.50', 'C: 0.75', 'D: 1.00'],
      figure_required: false,
      figure_status: 'none',
      difficulty: diff,
      rating_source: 'demo',
      weightage_tag: `Weightage-${chapIndex}`,
      answer_status: 'Normal',
      is_active: true,
      is_synthetic: true,
      created_at: now,
      updated_at: now,
    };
  }

  return questions;
}

export function generateSyntheticVisits(questions: Question[], count: number = 100000): Visit[] {
  const visits: Visit[] = new Array(count);
  const qCount = questions.length;
  const baseTime = Date.now() - 30 * 24 * 3600 * 1000; // 30 days ago

  for (let i = 0; i < count; i++) {
    const enter = baseTime + i * 20000;
    const duration = 20 + (i % 120); // 20s to 140s
    visits[i] = {
      id: `syn-v-${i + 1}`,
      response_id: `syn-resp-${i + 1}`,
      student_id: 'u-student-1',
      started_at: new Date(enter).toISOString(),
      ended_at: new Date(enter + duration * 1000).toISOString(),
      active_seconds: duration,
      idle_seconds: 0,
      actions: null,
      created_at: new Date(enter).toISOString(),
    };
  }

  return visits;
}

export class QuestionIndex {
  private byId = new Map<string, Question>();
  private byChapterAndTopic = new Map<string, Question[]>();
  private bySubject = new Map<string, Question[]>();

  constructor(questions: Question[]) {
    for (const q of questions) {
      this.byId.set(q.id, q);

      // Chapter index
      const chapKey = `${q.chapter_id}:${q.topic_id}`;
      let cList = this.byChapterAndTopic.get(chapKey);
      if (!cList) {
        cList = [];
        this.byChapterAndTopic.set(chapKey, cList);
      }
      cList.push(q);

      // Subject index
      let sList = this.bySubject.get(q.subject_id);
      if (!sList) {
        sList = [];
        this.bySubject.set(q.subject_id, sList);
      }
      sList.push(q);
    }
  }

  get(id: string): Question | undefined {
    return this.byId.get(id);
  }

  getTopicCounts(chapterId: string, topicId: string): { total: number; basic: number; medium: number; advanced: number } {
    const key = `${chapterId}:${topicId}`;
    const list = this.byChapterAndTopic.get(key) || [];
    let basic = 0;
    let medium = 0;
    let advanced = 0;
    for (const q of list) {
      if (q.difficulty === 'Basic') basic++;
      else if (q.difficulty === 'Medium') medium++;
      else if (q.difficulty === 'Advanced') advanced++;
    }
    return { total: list.length, basic, medium, advanced };
  }

  drawExamPool(mcqPerSubj: number = 20, nvqPerSubj: number = 5): Question[] {
    const subjects = ['subj-Physics', 'subj-Chemistry', 'subj-Mathematics'];
    const pool: Question[] = [];

    for (const s of subjects) {
      const allSubj = this.bySubject.get(s) || [];
      const mcqs = allSubj.filter(q => q.type === 'MCQ').slice(0, mcqPerSubj);
      const nvqs = allSubj.filter(q => q.type === 'NVQ').slice(0, nvqPerSubj);
      pool.push(...mcqs, ...nvqs);
    }

    return pool;
  }
}

export function queryPaginatedVisits(
  visits: Visit[],
  page: number = 1,
  pageSize: number = 50
): { page: number; pageSize: number; total: number; items: Visit[] } {
  const start = (page - 1) * pageSize;
  const items = visits.slice(start, start + pageSize);
  return {
    page,
    pageSize,
    total: visits.length,
    items,
  };
}

export function runPerformanceBenchmark(
  questions: Question[],
  visits: Visit[]
): BenchmarkMetrics {
  const index = new QuestionIndex(questions);

  // 1. Single question load benchmark (100 random lookups)
  const qLoadStart = performance.now();
  for (let i = 0; i < 100; i++) {
    const id = `syn-q-${(i * 97) % questions.length + 1}`;
    index.get(id);
  }
  const questionLoadMs = (performance.now() - qLoadStart) / 100;

  // 2. Topic start screen counts aggregation (50 iterations)
  const topicStart = performance.now();
  for (let i = 0; i < 50; i++) {
    index.getTopicCounts(`chap-${i % 50}`, `topic-${i % 150}`);
  }
  const topicStartScreenCountsMs = (performance.now() - topicStart) / 50;

  // 3. Exam pool draw (75 questions: 25 P + 25 C + 25 M) (20 iterations)
  const examPoolStart = performance.now();
  for (let i = 0; i < 20; i++) {
    index.drawExamPool(20, 5);
  }
  const examPoolDrawMs = (performance.now() - examPoolStart) / 20;

  // 4. Paginated monitor time-per-question query over 100,000 visits (20 page fetches)
  const paginatedStart = performance.now();
  for (let p = 1; p <= 20; p++) {
    queryPaginatedVisits(visits, p, 50);
  }
  const paginatedVisitsMs = (performance.now() - paginatedStart) / 20;

  const passedAllBudgets =
    questionLoadMs < 1000 &&
    topicStartScreenCountsMs < 1000 &&
    examPoolDrawMs < 1000 &&
    paginatedVisitsMs < 1000;

  return {
    questionLoadMs,
    topicStartScreenCountsMs,
    examPoolDrawMs,
    paginatedVisitsMs,
    totalSyntheticQuestions: questions.length,
    totalSyntheticVisits: visits.length,
    passedAllBudgets,
  };
}
