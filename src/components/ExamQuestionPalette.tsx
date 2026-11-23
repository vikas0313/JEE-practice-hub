import React from 'react';
import type { Question, Response } from '../lib/types';

export interface ExamQuestionPaletteProps {
  questions: Question[];
  responses: Map<string, Response>;
  currentIndex: number;
  onSelect: (idx: number) => void;
}

export const ExamQuestionPalette = React.memo(function ExamQuestionPalette({
  questions,
  responses,
  currentIndex,
  onSelect,
}: ExamQuestionPaletteProps) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
      {questions.map((q, idx) => {
        const resp = responses.get(q.id);
        const st = resp?.palette_status || 'not_visited';
        const isCurrent = idx === currentIndex;

        let badgeColor = 'bg-gray-200 text-gray-700 border-gray-300';
        if (st === 'answered') badgeColor = 'bg-[#28a745] text-white border-[#28a745]';
        else if (st === 'not_answered') badgeColor = 'bg-[#dc3545] text-white border-[#dc3545]';
        else if (st === 'marked_for_review') badgeColor = 'bg-[#6f42c1] text-white rounded-full';
        else if (st === 'answered_marked_for_review') badgeColor = 'bg-[#6f42c1] text-white rounded-full ring-2 ring-emerald-400';

        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(idx)}
            className={`h-9 font-extrabold text-xs flex items-center justify-center rounded transition-all shadow-xs ${badgeColor} ${
              isCurrent ? 'ring-2 ring-blue-600 scale-105' : 'hover:opacity-90'
            }`}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
});
