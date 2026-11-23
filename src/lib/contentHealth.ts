// ============================================================
// JEE Practice Hub — Content Health & Diagnostics Engine (Phase 6 M9)
// ============================================================

import {
  getAllQuestions,
  getAllQuestionAnswers,
  getAllSolutions,
  getPapers,
  getChapters,
  getSubjects,
  getResourceLinks,
  validateResourceUrl,
} from './db';
import type { Question, Paper, Chapter, Subject, ResourceLink } from './types';

export interface ContentHealthReport {
  generatedAt: string;
  totalQuestions: number;
  totalPapers: number;
  totalChapters: number;
  brokenFigures: Question[];
  unverifiedSolutions: { question: Question; reason: string }[];
  incompletePapers: { paper: Paper; questionCount: number; missingKeysCount: number }[];
  zeroQuestionChapters: { chapter: Chapter; subjectName: string }[];
  brokenResourceLinks: ResourceLink[];
  overallStatus: 'healthy' | 'warning' | 'action_needed';
  healthScorePct: number;
}

export function generateContentHealthReport(): ContentHealthReport {
  const questions = getAllQuestions();
  const answers = getAllQuestionAnswers();
  const solutions = getAllSolutions();
  const papers = getPapers();
  const chapters = getChapters();
  const subjects = getSubjects();
  const resourceLinks = getResourceLinks();

  const ansMap = new Map(answers.map(a => [a.question_id, a]));
  const solMap = new Map(solutions.map(s => [s.question_id, s]));
  const subMap = new Map(subjects.map(s => [s.id, s.name]));

  // 1. Broken / missing figures
  const brokenFigures = questions.filter(q => {
    if (q.figure_required) {
      if (q.figure_status !== 'attached' && q.figure_status !== 'redrawn') {
        return true;
      }
    }
    return false;
  });

  // 2. Unverified or missing solutions
  const unverifiedSolutions: { question: Question; reason: string }[] = [];
  for (const q of questions) {
    const sol = solMap.get(q.id);
    if (!sol) {
      unverifiedSolutions.push({ question: q, reason: 'Missing solution record' });
    } else if (sol.verification_status !== 'Reviewed' && sol.verification_status !== 'Key-matched') {
      unverifiedSolutions.push({
        question: q,
        reason: `Verification status is "${sol.verification_status}"`,
      });
    }
  }

  // 3. Incomplete papers
  const incompletePapers: { paper: Paper; questionCount: number; missingKeysCount: number }[] = [];
  for (const paper of papers) {
    const paperQuestions = questions.filter(q => q.paper_id === paper.id);
    const missingKeys = paperQuestions.filter(q => !ansMap.has(q.id));

    // NTA JEE Main papers normally have 75 or 90 questions; incomplete if < 75 or missing answer keys
    if (paperQuestions.length < 75 || missingKeys.length > 0) {
      incompletePapers.push({
        paper,
        questionCount: paperQuestions.length,
        missingKeysCount: missingKeys.length,
      });
    }
  }

  // 4. Zero-question chapters in syllabus taxonomy
  const zeroQuestionChapters: { chapter: Chapter; subjectName: string }[] = [];
  for (const chapter of chapters) {
    const count = questions.filter(q => q.chapter_id === chapter.id).length;
    if (count === 0) {
      zeroQuestionChapters.push({
        chapter,
        subjectName: subMap.get(chapter.subject_id) || 'Unknown Subject',
      });
    }
  }

  // 5. Broken or invalid resource links
  const brokenResourceLinks = resourceLinks.filter(l => !validateResourceUrl(l.url).valid);

  // Overall score computation
  const totalIssues =
    brokenFigures.length +
    unverifiedSolutions.length +
    incompletePapers.length +
    zeroQuestionChapters.length +
    brokenResourceLinks.length;

  let overallStatus: 'healthy' | 'warning' | 'action_needed' = 'healthy';
  if (brokenFigures.length > 0 || incompletePapers.length > 0 || zeroQuestionChapters.length > 5) {
    overallStatus = 'action_needed';
  } else if (totalIssues > 0) {
    overallStatus = 'warning';
  }

  const denominator = Math.max(1, questions.length);
  const penalty = (brokenFigures.length * 2 + unverifiedSolutions.length + incompletePapers.length * 5) / denominator;
  const healthScorePct = Math.max(0, Math.min(100, Math.round((1 - penalty) * 100)));

  return {
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    totalPapers: papers.length,
    totalChapters: chapters.length,
    brokenFigures,
    unverifiedSolutions,
    incompletePapers,
    zeroQuestionChapters,
    brokenResourceLinks,
    overallStatus,
    healthScorePct,
  };
}
