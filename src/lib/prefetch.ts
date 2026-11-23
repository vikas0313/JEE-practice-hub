/**
 * Route & Content Prefetching Utilities (Module E9)
 *
 * Speeds up route transitions and question switching on throttled connections.
 */

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(routePath: string, loader: () => Promise<any>): void {
  if (prefetchedRoutes.has(routePath)) return;
  prefetchedRoutes.add(routePath);

  // Use requestIdleCallback if available, fallback to setTimeout
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      loader().catch(() => {});
    });
  } else {
    setTimeout(() => {
      loader().catch(() => {});
    }, 150);
  }
}

