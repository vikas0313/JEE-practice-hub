// ============================================================
// JEE Practice Hub — PWA and Standalone Environment Utilities (Phase 6 M6)
// ============================================================

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const mobileWidth = window.innerWidth <= 768;
  const touchPoints = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  return mobileWidth || touchPoints;
}

export function shouldShowInstallBanner(completedPracticesCount: number): boolean {
  if (typeof window === 'undefined') return false;
  if (!isMobileDevice()) return false; // Never show on desktop
  if (isStandaloneMode()) return false; // Already installed / standalone
  if (completedPracticesCount < 3) return false; // Gate: must have completed 3 practice sessions

  try {
    return localStorage.getItem('jph_pwa_dismissed') !== 'true';
  } catch {
    return false;
  }
}

export function dismissInstallBannerForever(): void {
  try {
    localStorage.setItem('jph_pwa_dismissed', 'true');
  } catch {}
}

export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if ((window as unknown as { __VITEST__?: boolean }).__VITEST__) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA service worker registration failed:', err);
      });
    });
  }
}
