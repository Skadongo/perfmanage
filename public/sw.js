/**
 * PMS Service Worker
 * - Caches dashboard pages and API responses for offline access
 * - Queues review approval actions when offline (background sync)
 * - Managers and directors can view cached dashboards and approve reviews without connectivity
 */

const CACHE_VERSION = 'pms-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const SYNC_TAG = 'pms-review-approvals';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/performance-dashboard',
  '/manager-review',
  '/mid-year-reviews',
  '/offline',
];

// ── Install: pre-cache shell pages ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently ignore pre-cache failures (pages may not exist yet)
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('pms-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for API, cache-first for pages ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (except Supabase)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('supabase.co')) return;

  // Never intercept Supabase auth endpoints — these use navigator locks and
  // SW interception causes "Lock broken by steal" AbortErrors
  if (url.hostname.includes('supabase.co') && (
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/token') ||
    url.pathname.includes('/user') ||
    url.pathname.includes('/logout') ||
    url.pathname.includes('/session')
  )) {
    return; // Let the browser handle auth requests directly
  }

  // Supabase REST API — network-first, cache fallback (role-scoped key)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 2 * 60 * 1000));
    return;
  }

  // Next.js pages — stale-while-revalidate
  if (url.origin === self.location.origin && !url.pathname.startsWith('/_next/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Static assets (_next/static) — cache-first, long TTL
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

// ── Background Sync: flush queued review approvals ──────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushApprovalQueue());
  }
});

// ── Message: manual cache invalidation from app ─────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INVALIDATE_CACHE') {
    const base = event.data.base;
    caches.open(API_CACHE).then((cache) => {
      cache.keys().then((keys) => {
        keys
          .filter((req) => req.url.includes(base))
          .forEach((req) => cache.delete(req));
      });
    });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function networkFirstWithCache(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cloned = response.clone();
      // Store with timestamp header for TTL enforcement
      const headers = new Headers(cloned.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const body = await cloned.arrayBuffer();
      cache.put(request, new Response(body, { status: cloned.status, headers }));
    }
    return response;
  } catch {
    // Offline — serve from cache if available
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
      if (Date.now() - cachedAt < maxAgeMs) return cached;
    }
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request.clone()).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await fetchPromise) || offlineFallback();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

function offlineFallback() {
  return new Response(
    '<!DOCTYPE html><html><body><h1>You are offline</h1><p>Please reconnect to continue.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ── Approval queue (IndexedDB-backed) ────────────────────────────────────────

const DB_NAME = 'pms-offline';
const STORE_NAME = 'approval-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function flushApprovalQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const items = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (response.ok) {
        store.delete(item.id);
        // Notify all clients that an approval was synced
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'APPROVAL_SYNCED', reviewId: item.reviewId })
        );
      }
    } catch {
      // Will retry on next sync
    }
  }
}
