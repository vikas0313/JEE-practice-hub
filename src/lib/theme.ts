import type { UserPreferences } from './types';

export function isExamRoute(pathname: string): boolean {
  return /^\/exam\/[^/]+\/session/.test(pathname);
}

export function applyThemePreferences(
  prefs: UserPreferences,
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  targetElement?: any
): void {
  if (typeof document === 'undefined' && !targetElement) return;
  const root = targetElement || document.documentElement;

  // HARD CONSTRAINT: The CBT Exam interface is strictly exempt from custom themes
  if (isExamRoute(pathname)) {
    root.classList.remove('dark', 'high-contrast', 'reduced-motion');
    root.removeAttribute('data-font-size');
    return;
  }

  // 1. Dark Mode
  if (prefs.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 2. High Contrast
  if (prefs.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // 3. Reduced Motion
  if (prefs.reducedMotion) {
    root.classList.add('reduced-motion');
  } else {
    root.classList.remove('reduced-motion');
  }

  // 4. Font Size
  if (prefs.fontSize && prefs.fontSize !== 'normal') {
    root.setAttribute('data-font-size', prefs.fontSize);
  } else {
    root.removeAttribute('data-font-size');
  }
}
