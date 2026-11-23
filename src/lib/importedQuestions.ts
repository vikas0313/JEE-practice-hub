import type { Question, QuestionAnswer, Solution } from './types';
import { getSyllabusChapters, getSyllabusSubjects } from './db';
import questionsData from '../../data/imported_jee_mocks_questions.json';
import answersData from '../../data/imported_jee_mocks_answers.json';
import solutionsData from '../../data/imported_jee_mocks_solutions.json';

let cachedResolvedQuestions: Question[] | null = null;
let cachedImportedMap: Map<string, Question> | null = null;
let cachedAnswersMap: Map<string, QuestionAnswer> | null = null;
let cachedSolutionsMap: Map<string, Solution> | null = null;
let lastChapterCount = 0;
let lastFirstChapterId = '';

export function clearImportedCache(): void {
  cachedResolvedQuestions = null;
  cachedImportedMap = null;
  cachedAnswersMap = null;
  cachedSolutionsMap = null;
  lastChapterCount = 0;
  lastFirstChapterId = '';
}

export function getImportedQuestion(id: string): Question | null {
  if (!cachedImportedMap) {
    const list = getImportedQuestions();
    cachedImportedMap = new Map(list.map(q => [q.id, q]));
  }
  return cachedImportedMap.get(id) ?? null;
}

export function getImportedAnswer(questionId: string): QuestionAnswer | null {
  if (!cachedAnswersMap) {
    const list = getImportedQuestionAnswers();
    cachedAnswersMap = new Map(list.map(a => [a.question_id, a]));
  }
  return cachedAnswersMap.get(questionId) ?? null;
}

export function getImportedSolution(questionId: string): Solution | null {
  if (!cachedSolutionsMap) {
    const list = getImportedSolutions();
    cachedSolutionsMap = new Map(list.map(s => [s.question_id, s]));
  }
  return cachedSolutionsMap.get(questionId) ?? null;
}

export function getImportedQuestions(): Question[] {
  const chapters = getSyllabusChapters();
  const firstId = chapters[0]?.id || '';

  if (
    cachedResolvedQuestions &&
    chapters.length === lastChapterCount &&
    firstId === lastFirstChapterId &&
    chapters.length > 0
  ) {
    return cachedResolvedQuestions;
  }

  lastFirstChapterId = firstId;
  lastChapterCount = chapters.length;

  const subjects = getSyllabusSubjects();
  const chMap = new Map(chapters.map(c => [c.external_id, c.id]));
  const subMap = new Map(subjects.map(s => [s.name, s.id]));

  const rawList = questionsData as unknown as Question[];
  const resolved: Question[] = new Array(rawList.length);

  for (let i = 0; i < rawList.length; i++) {
    const q = rawList[i];
    const liveChapterId = chMap.get(q.primary_chapter_id || '') || q.primary_chapter_id || '';
    const liveSubjectId = subMap.get(q.subject_id) || q.subject_id;

    resolved[i] = {
      ...q,
      primary_chapter_id: liveChapterId,
      chapter_id: liveChapterId,
      subject_id: liveSubjectId,
    };
  }

  cachedResolvedQuestions = resolved;
  return resolved;
}

export function getImportedQuestionAnswers(): QuestionAnswer[] {
  return answersData as unknown as QuestionAnswer[];
}

export function getImportedSolutions(): Solution[] {
  return solutionsData as unknown as Solution[];
}
