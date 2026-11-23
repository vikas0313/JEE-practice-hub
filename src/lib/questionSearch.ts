// ============================================================
// Enhancement E4: Question Search & "More Like This" Engine
// Full-text token matching, pseudo-embedding cosine similarity,
// and strictly post-submit "More Like This" recommendations.
// ============================================================

import { Question, QuestionSearchResult } from './types';

/**
 * Tokenize plain text or KaTeX markdown into normalized tokens.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  // Extract alphanumeric tokens and words, naturally separating symbols, underscores, and LaTeX slashes
  const matches = text.toLowerCase().match(/[a-zA-Z0-9]+/g);
  return matches || [];
}

/**
 * Generate a deterministic normalized vector embedding of text (dim = 64)
 * using term frequency hash projection.
 */
export function generatePseudoEmbedding(text: string, dim: number = 64): number[] {
  const vec = new Array(dim).fill(0);
  const tokens = tokenizeText(text);

  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }

  // Normalize to unit length
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

/**
 * Compute cosine similarity between two unit-normalized vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Number(Math.max(0, Math.min(1, dot)).toFixed(4));
}

/**
 * Full-text keyword search across question texts.
 */
export function searchQuestionsByText(
  query: string,
  questions: Question[],
  limit: number = 10
): QuestionSearchResult[] {
  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0) return [];

  const results: QuestionSearchResult[] = [];

  for (const q of questions) {
    if (q.is_active === false) continue;

    const qTokens = tokenizeText(q.question_text);
    if (qTokens.length === 0) continue;

    const tokenSet = new Set(qTokens);
    let matchedCount = 0;
    for (const qt of queryTokens) {
      if (tokenSet.has(qt)) {
        matchedCount++;
      }
    }

    if (matchedCount > 0) {
      const matchScore = Number((matchedCount / queryTokens.length).toFixed(3));
      results.push({
        question: q,
        match_score: matchScore,
        highlight_snippet: q.question_text.slice(0, 150) + (q.question_text.length > 150 ? '...' : ''),
      });
    }
  }

  return results.sort((a, b) => b.match_score - a.match_score).slice(0, limit);
}

/**
 * Find questions similar to a given target question ("More Like This").
 * Hard rule: Only accessible post-submission. Never during an active exam.
 */
export function findSimilarQuestions(
  targetQuestion: Question,
  pool: Question[],
  limit: number = 3
): Question[] {
  const targetTokens = new Set(tokenizeText(targetQuestion.question_text));
  const targetEmbedding = generatePseudoEmbedding(targetQuestion.question_text);

  const scoredCandidates: { question: Question; score: number }[] = [];

  for (const candidate of pool) {
    // Exclude self and inactive questions
    if (candidate.id === targetQuestion.id || candidate.is_active === false) {
      continue;
    }

    let score = 0;

    // Subject match is prerequisite
    if (candidate.subject_id === targetQuestion.subject_id) {
      score += 0.3;
    } else {
      continue; // Skip different subjects
    }

    // Chapter match
    if (candidate.chapter_id === targetQuestion.chapter_id) {
      score += 0.3;
    }

    // Subtopic match
    if (candidate.subtopic && targetQuestion.subtopic && candidate.subtopic === targetQuestion.subtopic) {
      score += 0.2;
    }

    // Semantic cosine similarity
    const candEmbedding = generatePseudoEmbedding(candidate.question_text);
    const cosSim = cosineSimilarity(targetEmbedding, candEmbedding);
    score += cosSim * 0.2;

    scoredCandidates.push({
      question: candidate,
      score: Number(score.toFixed(3)),
    });
  }

  return scoredCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((sc) => sc.question);
}
