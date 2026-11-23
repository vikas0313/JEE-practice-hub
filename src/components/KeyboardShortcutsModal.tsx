import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Exam & Practice Interface',
      items: [
        { key: '1, 2, 3, 4', desc: 'Select option A, B, C, or D for MCQ' },
        { key: 'Enter', desc: 'Save answer and move to Next question' },
        { key: 'M', desc: 'Mark current question for Review & Next' },
        { key: 'C', desc: 'Clear chosen response' },
        { key: 'P / ←', desc: 'Navigate to Previous question' },
        { key: 'N / →', desc: 'Navigate to Next question' },
      ],
    },
    {
      category: 'Global Navigation',
      items: [
        { key: '?', desc: 'Toggle this keyboard shortcuts dialog' },
        { key: 'Esc', desc: 'Close dialogs and modals' },
        { key: 'Tab', desc: 'Navigate focus through interactive controls' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-800">
            <Keyboard size={20} className="text-blue-600" />
            <h3 className="font-bold text-base">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-150 transition"
            aria-label="Close keyboard shortcuts dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {shortcuts.map((group, idx) => (
            <div key={idx}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-gray-600">{item.desc}</span>
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
          <span className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">Esc</kbd> anytime to close this dialog.
          </span>
        </div>
      </div>
    </div>
  );
}

