// ============================================================
// JEE Practice Hub — Module E3: Revision Cards & Formula Sheets
// ============================================================

import { v4 as uuid } from 'uuid';
import type { ChapterNote, PrintableFormulaSheet } from './types';
import {
  getChapters,
  getSubjects,
  getVerifiedChapterNotes,
  saveChapterNote,
} from './db';

/**
 * Extracts formula cards from markdown notes containing KaTeX blocks.
 */
export function extractFormulasFromMarkdown(
  markdown: string
): { title: string; latex: string; explanation?: string }[] {
  const formulas: { title: string; latex: string; explanation?: string }[] = [];
  const lines = markdown.split('\n');

  let currentTitle = 'Key Formula';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('**Formula:')) {
      currentTitle = line.replace(/^[#*]+\s*/, '').replace(/[*:]/g, '').trim();
    } else if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      const latex = line.slice(2, -2).trim();
      formulas.push({ title: currentTitle, latex });
    } else if (line.includes('$') && line.split('$').length >= 3) {
      const parts = line.split('$');
      formulas.push({ title: currentTitle, latex: parts[1].trim(), explanation: parts[2]?.trim() });
    }
  }

  return formulas;
}

/**
 * Builds a printable formula sheet for a given chapter.
 */
export function getPrintableFormulaSheet(chapterId: string): PrintableFormulaSheet | null {
  const chapters = getChapters();
  const subjects = getSubjects();
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;

  const subject = subjects.find((s) => s.id === chapter.subject_id);
  const notes = getVerifiedChapterNotes(chapterId);

  const allFormulas: { title: string; latex: string; explanation?: string }[] = [];
  for (const n of notes) {
    allFormulas.push(...extractFormulasFromMarkdown(n.content_markdown));
  }

  return {
    chapter_id: chapterId,
    chapter_name: chapter.name,
    subject_name: subject?.name ?? 'Physics',
    formulas: allFormulas,
    verified: notes.some((n) => n.verified_at !== null),
  };
}

/**
 * Seeds high-yield verified chapter notes if none exist.
 */
export function seedDefaultChapterNotesIfEmpty(): void {
  const existing = getVerifiedChapterNotes();
  if (existing.length > 0) return;

  const chapters = getChapters();
  if (chapters.length === 0) return;

  const sampleNote: ChapterNote = {
    id: uuid(),
    chapter_id: chapters[0].id,
    title: `${chapters[0].name} — Core Formula Sheet`,
    content_markdown: `# ${chapters[0].name} Revision Summary

### Equation of Motion
$$v = u + at$$

### Position Displacement
$$s = ut + \\frac{1}{2}at^2$$

### Velocity Squared Relation
$$v^2 = u^2 + 2as$$
`,
    verified_at: new Date().toISOString(),
    verified_by: 'system',
    created_at: new Date().toISOString(),
  };

  saveChapterNote(sampleNote);
}

