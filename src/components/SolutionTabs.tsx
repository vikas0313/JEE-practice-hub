import React, { useState } from 'react';
import { KaTeXText } from '../lib/katex-render';
import { VerificationBadge } from './VerificationBadge';
import type { Solution, ResourceType } from '../lib/types';
import { Flag, Lightbulb, BookOpen, ExternalLink, Video, FileText, HelpCircle, Link2, Sparkles } from 'lucide-react';
import { getResourceLinksForQuestion, getSettings, getAllQuestions } from '../lib/db';
import { findSimilarQuestions } from '../lib/questionSearch';

interface SolutionTabsProps {
  solution: Solution;
  questionId?: string;
  studentId?: string;
  onFlag?: () => void;
  onViewSteps?: () => void;
  onViewShortcut?: () => void;
}

export function SolutionTabs({ solution, questionId, studentId, onFlag, onViewSteps, onViewShortcut }: SolutionTabsProps) {
  const [tab, setTab] = useState<'steps' | 'shortcut'>('steps');

  const settings = getSettings();
  const resourceLinks = questionId ? getResourceLinksForQuestion(questionId, studentId) : [];

  const similarQuestions = React.useMemo(() => {
    if (!settings.flag_e4_question_search_embeddings || !questionId) return [];
    const all = getAllQuestions();
    const currentQ = all.find((q) => q.id === questionId);
    if (!currentQ) return [];
    return findSimilarQuestions(currentQ, all, 3);
  }, [settings.flag_e4_question_search_embeddings, questionId]);

  const handleTabChange = (t: 'steps' | 'shortcut') => {
    setTab(t);
    if (t === 'steps' && onViewSteps) onViewSteps();
    if (t === 'shortcut' && onViewShortcut) onViewShortcut();
  };

  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'video':
        return <Video size={14} className="text-red-600 shrink-0" />;
      case 'notes':
        return <FileText size={14} className="text-emerald-600 shrink-0" />;
      case 'solution':
        return <HelpCircle size={14} className="text-blue-600 shrink-0" />;
      default:
        return <ExternalLink size={14} className="text-purple-600 shrink-0" />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden mt-6">
      {/* Tab header */}
      <div className="flex border-b border-gray-200 bg-gray-50/70">
        <button
          type="button"
          onClick={() => handleTabChange('steps')}
          className={`flex items-center justify-center gap-2 flex-1 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
            tab === 'steps'
              ? 'bg-white text-blue-700 border-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 border-transparent'
          }`}
        >
          <BookOpen size={16} />
          Step-by-step Solution
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('shortcut')}
          className={`flex items-center justify-center gap-2 flex-1 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
            tab === 'shortcut'
              ? 'bg-white text-blue-700 border-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 border-transparent'
          }`}
        >
          <Lightbulb size={16} />
          Shortcut
        </button>
      </div>

      {/* Verification status and Flag */}
      <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
        <VerificationBadge status={solution.verification_status} />
        {onFlag && (
          <button
            type="button"
            onClick={onFlag}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            <Flag size={13} />
            Flag incorrect solution
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'steps' ? (
          <div className="text-gray-800 leading-relaxed">
            <KaTeXText text={solution.steps} />
          </div>
        ) : (
          <div className="text-gray-800 leading-relaxed">
            {solution.shortcut ? (
              <div className="space-y-3">
                <KaTeXText text={solution.shortcut} />
                {solution.shortcut_type && (
                  <div className="pt-2 text-xs text-blue-800 font-medium inline-block bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                    Shortcut type: {solution.shortcut_type}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic bg-amber-50/60 p-4 rounded-lg border border-amber-200/50">
                {solution.shortcut_note || 'The direct standard method is already the fastest approach for this question.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Curated Resources (Phase 6 M5) */}
      {resourceLinks.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/70 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            <Link2 size={14} className="text-indigo-600" />
            Curated Resources & Explanations
          </div>
          <div className="space-y-2">
            {resourceLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-xs transition-all text-xs group"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {getResourceIcon(link.resource_type)}
                  <span className="font-medium text-gray-800 group-hover:text-indigo-600 truncate">
                    {link.title}
                  </span>
                  <span className="text-[10px] text-gray-400 capitalize border border-gray-100 px-1.5 py-0.5 rounded">
                    {link.resource_type}
                  </span>
                </div>
                <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 shrink-0 ml-2" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Enhancement E4: More Like This (post-submission only) */}
      {settings.flag_e4_question_search_embeddings && similarQuestions.length > 0 && (
        <div className="border-t border-gray-100 bg-indigo-50/40 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">
            <Sparkles size={14} className="text-indigo-600" />
            More Like This (Semantic Similarity)
          </div>
          <div className="space-y-2">
            {similarQuestions.map((sq, idx) => (
              <div key={sq.id} className="p-3 bg-white border border-indigo-100 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                  <span>Similar Practice #{idx + 1}</span>
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">{sq.difficulty}</span>
                </div>
                <div className="text-gray-800 line-clamp-2">
                  <KaTeXText text={sq.question_text} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

