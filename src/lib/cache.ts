/**
 * Enhanced in-memory cache with:
 * - TTL (time-to-live) expiry
 * - LRU (Least Recently Used) eviction — max 200 entries
 * - Stale-While-Revalidate (SWR) — serve stale data instantly, refresh in background
 * - Request deduplication — concurrent identical fetches share one in-flight promise
 * - localStorage persistence — survives page reloads for non-sensitive data
 * - Cache stats — monitor hit/miss rates
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  /** SWR: serve stale data until this timestamp, then evict */
  staleUntil: number;
  /** LRU: last access time */
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  evictions: number;
  size: number;
}

const MAX_ENTRIES = 200;
const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const stats: CacheStats = { hits: 0, misses: 0, staleHits: 0, evictions: 0, size: 0 };

// ─── LRU Eviction ─────────────────────────────────────────────────────────────
function evictLRU(): void {
  if (store.size < MAX_ENTRIES) return;

  // Remove expired entries first
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.staleUntil) {
      store.delete(key);
      stats.evictions++;
    }
  }

  // If still over limit, evict least recently used
  if (store.size >= MAX_ENTRIES) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      store.delete(oldestKey);
      stats.evictions++;
    }
  }

  stats.size = store.size;
}

// ─── Core get/set/delete ──────────────────────────────────────────────────────
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    stats.misses++;
    return null;
  }

  const now = Date.now();

  // Fully expired (past staleUntil) — evict and return null
  if (now > entry.staleUntil) {
    store.delete(key);
    stats.misses++;
    stats.size = store.size;
    return null;
  }

  // Update LRU timestamp
  entry.lastAccessed = now;
  stats.hits++;
  return entry.data;
}

/**
 * Returns stale data even if TTL has expired (but within staleUntil window).
 * Used by stale-while-revalidate pattern.
 */
export function cacheGetStale<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.staleUntil) {
    store.delete(key);
    stats.size = store.size;
    return null;
  }

  entry.lastAccessed = now;
  const isStale = now > entry.expiresAt;
  if (isStale) stats.staleHits++;
  else stats.hits++;

  return { data: entry.data, isStale };
}

export function cacheSet<T>(
  key: string,
  data: T,
  ttlMs = 60_000,
  /** How long to serve stale data after TTL expires (default: 2× TTL) */
  staleTtlMs?: number
): void {
  evictLRU();
  const now = Date.now();
  store.set(key, {
    data,
    expiresAt: now + ttlMs,
    staleUntil: now + (staleTtlMs ?? ttlMs * 2),
    lastAccessed: now,
  });
  stats.size = store.size;
}

export function cacheDelete(key: string): void {
  store.delete(key);
  stats.size = store.size;
}

export function cacheClear(): void {
  store.clear();
  inFlight.clear();
  stats.size = 0;
}

export function getCacheStats(): Readonly<CacheStats> {
  return { ...stats };
}

// ─── Fetch-or-cache with deduplication ───────────────────────────────────────
/**
 * Fetch-or-cache helper with request deduplication.
 * - If cached and fresh → return immediately (0 DB calls)
 * - If in-flight → join the existing promise (deduplication)
 * - Otherwise → fetch, cache, return
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
  staleTtlMs?: number
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  // Deduplication: if same key is already being fetched, wait for it
  if (inFlight.has(key)) {
    return inFlight.get(key) as Promise<T>;
  }

  const promise = fetcher().then((data) => {
    cacheSet(key, data, ttlMs, staleTtlMs);
    inFlight.delete(key);
    return data;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Stale-While-Revalidate fetch helper.
 * - Returns stale data immediately if available
 * - Triggers background refresh when data is stale
 * - `onUpdate` callback fires when fresh data arrives
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
  onUpdate?: (data: T) => void,
  staleTtlMs?: number
): Promise<T> {
  const staleResult = cacheGetStale<T>(key);

  if (staleResult) {
    if (staleResult.isStale && !inFlight.has(key)) {
      // Background revalidation — don't await
      const promise = fetcher().then((data) => {
        cacheSet(key, data, ttlMs, staleTtlMs);
        inFlight.delete(key);
        onUpdate?.(data);
        return data;
      }).catch(() => { inFlight.delete(key); });
      inFlight.set(key, promise as Promise<unknown>);
    }
    return staleResult.data;
  }

  // No cache at all — fetch and wait
  return cachedFetch(key, fetcher, ttlMs, staleTtlMs);
}

// ─── localStorage persistence ─────────────────────────────────────────────────
const LS_PREFIX = 'pms_cache:';
const LS_PERSIST_KEYS = new Set<string>();

/**
 * Mark a cache key for localStorage persistence.
 * On next page load, data will be available instantly before the first DB call.
 * Only use for non-sensitive, role-scoped data.
 */
export function persistKey(key: string): void {
  LS_PERSIST_KEYS.add(key);
}

export function cacheSetPersisted<T>(
  key: string,
  data: T,
  ttlMs = 60_000,
  staleTtlMs?: number
): void {
  cacheSet(key, data, ttlMs, staleTtlMs);
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      data,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + (staleTtlMs ?? ttlMs * 2),
    });
    localStorage.setItem(`${LS_PREFIX}${key}`, payload);
  } catch {
    // localStorage quota exceeded or unavailable — silently skip
  }
}

/**
 * Hydrate in-memory cache from localStorage on startup.
 * Call once at app boot (e.g. in SWRProvider or layout).
 */
export function hydrateFromStorage(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const lsKey = localStorage.key(i);
      if (!lsKey?.startsWith(LS_PREFIX)) continue;
      const key = lsKey.slice(LS_PREFIX.length);
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as {
          data: unknown;
          expiresAt: number;
          staleUntil: number;
        };
        // Only hydrate if not fully expired
        if (now < parsed.staleUntil) {
          store.set(key, {
            data: parsed.data,
            expiresAt: parsed.expiresAt,
            staleUntil: parsed.staleUntil,
            lastAccessed: now,
          });
        } else {
          localStorage.removeItem(lsKey);
        }
      } catch {
        localStorage.removeItem(lsKey);
      }
    }
    stats.size = store.size;
  } catch {
    // localStorage unavailable
  }
}

/**
 * Remove all persisted cache entries from localStorage.
 */
export function clearPersistedCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// ─── Role-keyed cache TTLs ────────────────────────────────────────────────────
/** Staff list: 5 min — changes infrequently */
export const TTL_STAFF_LIST = 5 * 60_000;
/** Dashboard metrics: 2 min — needs to feel live but avoids hammering DB */
export const TTL_DASHBOARD_METRICS = 2 * 60_000;
/** Workplan list: 2 min */
export const TTL_WORKPLAN_LIST = 2 * 60_000;
/** Role permissions: 10 min — very rarely changes */
export const TTL_ROLE_PERMISSIONS = 10 * 60_000;
/** BSC perspectives: 10 min */
export const TTL_BSC_PERSPECTIVES = 10 * 60_000;
/** Analytics/reports: 5 min — heavy queries, cache aggressively */
export const TTL_ANALYTICS = 5 * 60_000;

/**
 * Build a role-scoped cache key.
 */
export function roleKey(base: string, role: string, scopeId?: string | null): string {
  const parts = [base, role];
  if (scopeId) parts.push(scopeId);
  return parts.join(':');
}

/**
 * Role-aware cachedFetch with deduplication.
 */
export async function roleCachedFetch<T>(
  base: string,
  role: string,
  fetcher: () => Promise<T>,
  ttlMs = TTL_DASHBOARD_METRICS,
  scopeId?: string | null
): Promise<T> {
  const key = roleKey(base, role, scopeId);
  return cachedFetch(key, fetcher, ttlMs);
}

/**
 * Role-aware SWR fetch — serves stale data instantly, revalidates in background.
 */
export async function roleSwrFetch<T>(
  base: string,
  role: string,
  fetcher: () => Promise<T>,
  ttlMs = TTL_DASHBOARD_METRICS,
  onUpdate?: (data: T) => void,
  scopeId?: string | null
): Promise<T> {
  const key = roleKey(base, role, scopeId);
  return swrFetch(key, fetcher, ttlMs, onUpdate);
}

/**
 * Invalidate all cache entries for a given role.
 */
export function invalidateRoleCache(role: string): void {
  for (const key of store.keys()) {
    if (key.includes(`:${role}:`) || key.endsWith(`:${role}`)) {
      store.delete(key);
    }
  }
  stats.size = store.size;
}

/**
 * Invalidate a specific base key across all roles.
 */
export function invalidateByBase(base: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${base}:`) || key === base) {
      store.delete(key);
    }
  }
  // Also clear from localStorage
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`${LS_PREFIX}${base}`)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
  stats.size = store.size;
}
