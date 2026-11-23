import React, { useState } from 'react';
import { Sun, Moon, Type, Eye, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getUserPreferences, saveUserPreferences } from '../lib/db';
import { applyThemePreferences, isExamRoute } from '../lib/theme';
import type { UserPreferences } from '../lib/types';

export function ThemeToggle() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // If in an exam, theme toggle is completely hidden
  if (typeof window !== 'undefined' && isExamRoute(window.location.pathname)) {
    return null;
  }

  if (!user) return null;

  const currentPrefs = getUserPreferences(user.id);

  const update = (patch: Partial<UserPreferences>) => {
    const updated = saveUserPreferences(user.id, patch);
    applyThemePreferences(updated);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white rounded-md transition"
        title="Display & Theme Options"
        aria-label="Display and theme options"
      >
        {currentPrefs.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 z-50 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700 mb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <SlidersHorizontal size={14} />
              Display Options
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Done
            </button>
          </div>

          {/* Theme Mode */}
          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-200 block mb-1.5">
                Appearance
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update({ theme: 'light' })}
                  className={`py-1.5 px-3 rounded-lg border text-center font-medium flex items-center justify-center gap-1.5 transition ${
                    currentPrefs.theme !== 'dark'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => update({ theme: 'dark' })}
                  className={`py-1.5 px-3 rounded-lg border text-center font-medium flex items-center justify-center gap-1.5 transition ${
                    currentPrefs.theme === 'dark'
                      ? 'bg-blue-600 border-blue-500 text-white font-bold'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-200 block mb-1.5 flex items-center gap-1">
                <Type size={13} /> Text Size
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {(['normal', 'large', 'xlarge'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => update({ fontSize: size })}
                    className={`py-1 px-2 rounded border text-xs capitalize transition ${
                      currentPrefs.fontSize === size || (!currentPrefs.fontSize && size === 'normal')
                        ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300 font-bold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {size === 'normal' ? 'Standard' : size === 'large' ? 'Large' : 'X-Large'}
                  </button>
                ))}
              </div>
            </div>

            {/* High Contrast */}
            <div className="pt-2 border-t border-gray-150 dark:border-gray-700 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                <Eye size={13} /> High Contrast
              </span>
              <input
                type="checkbox"
                checked={Boolean(currentPrefs.highContrast)}
                onChange={(e) => update({ highContrast: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

