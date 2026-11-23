// ============================================================
// JEE Practice Hub — Minimal Shell-Only Service Worker (Phase 6 M6)
//
// STRICT INTEGRITY RULES:
// 1. Caches application shell ONLY (HTML, JS, CSS, icons, fonts).
// 2. NEVER caches question content, answers, solutions, API responses,
//    Supabase endpoints, or student telemetry.
// 3. Fails closed when offline on dynamic content with a clear, calm message.
// ============================================================

const CACHE_NAME = 'jph-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// URLs or path substrings that MUST NEVER be cached
const NEVER_CACHE_PATTERNS = [
  '/rest/v1/',
  '/auth/v1/',
  '/storage/v1/',
  '/functions/v1/',
  '/api/',
  'pilot_jee_main',
  'question',
  'solution',
  'answer',
  'attempt',
  'response',
  'telemetry',
  'audit_log',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching some shell assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only intercept GET requests
  if (req.method !== 'GET') {
    return;
  }

  // 2. Check if URL matches any non-cacheable data/telemetry pattern
  const isForbidden = NEVER_CACHE_PATTERNS.some((pattern) => url.pathname.includes(pattern) || url.search.includes(pattern));
  if (isForbidden) {
    // Pass directly through to network without caching
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'Practice Hub needs an internet connection for practice questions and exams. Your streak and progress are safe.',
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 3. For navigation requests (HTML pages)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/index.html').then((cached) => {
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>JEE Practice Hub — Offline</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; padding: 1.5rem; }
                .card { background: white; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #e2e8f0; max-width: 28rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.75rem; }
                p { font-size: 0.95rem; color: #475569; line-height: 1.5; margin: 0; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Internet Connection Required</h1>
                <p>Practice Hub needs an internet connection for practice questions and exams. Your streak and progress are safe.</p>
              </div>
            </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html' },
            }
          );
        });
      })
    );
    return;
  }

  // 4. For static shell assets (JS, CSS, static fonts, icons)
  const isStaticShell =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff');

  if (isStaticShell) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: pass through to network
  event.respondWith(fetch(req));
});

