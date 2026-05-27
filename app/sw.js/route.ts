/**
 * GET /sw.js — Service Worker dinâmico com cache busting por build.
 *
 * Sprint 12 c3 — B-005 resolve: utilizador via versão antiga após deploy porque
 * o sw.js estático em public/ tinha CACHE_NAME hardcoded. Cada deploy não
 * mudava o nome → browser não detectava update → cache shell antigo permanecia.
 *
 * Solução:
 * 1. Servir o SW via route handler com NEXT_PUBLIC_BUILD_TAG injectado no
 *    CACHE_NAME (YYMMDD_HHmm Lisbon, definido em next.config.ts).
 * 2. Cache-Control: no-store no próprio sw.js → browser fetcha sempre fresco.
 * 3. SKIP_WAITING handler dentro do SW para responder ao postMessage do
 *    ServiceWorkerRegister.tsx (estava ausente, causava "waiting" infinito).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const buildTag = process.env.NEXT_PUBLIC_BUILD_TAG || 'dev';

  const sw = `/* eslint-disable no-restricted-globals */
// Foco Imo Service Worker — gerado dinamicamente por /sw.js route.
// Build: ${buildTag}

const CACHE_NAME = 'foco-imo-shell-${buildTag}';
const SHELL_URLS = [
  '/',
  '/login',
  '/boards',
  '/inbox',
  '/contacts',
  '/activities',
  '/icons/icon.svg',
  '/icons/maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// Resposta a postMessage({type:'SKIP_WAITING'}) do ServiceWorkerRegister.tsx.
// Sem isto, novo SW ficava "waiting" para sempre e utilizador via versão velha.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first para navegações, fallback cache se offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate para assets estáticos.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
`;

  return new Response(sw, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'service-worker-allowed': '/',
    },
  });
}
