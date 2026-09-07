/**
 * Enhanced in-memory + localStorage cache with TTL support.
 * Features:
 * - In-memory primary cache (fast, no serialization)
 * - localStorage persistence (survives page refresh)
 * - Background revalidation (stale-while-revalidate)
 * - Increased TTLs for rarely-changing data
 */

'use client';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const LS_PREFIX = 'pms_cache:';
const LS_MAX_AGE = 24 * 60 * 60_000; // 24 h max localStorage age

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGet<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    // Reject entries older than 24 h regardless of TTL
    if (Date.now() - entry.createdAt > LS_MAX_AGE) {
      localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function lsSet<T>(key: string, entry: CacheEntry<T>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded — silently skip
  }
}

function lsDelete(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {}
}

// ─── Core cache API ───────────────────────────────────────────────────────────

export function cacheGet<T>(key: string): T | null {
  // 1. Check in-memory first (fastest)
  const memEntry = store.get(key) as CacheEntry<T> | undefined;
  if (memEntry) {
    if (Date.now() <= memEntry.expiresAt) return memEntry.data;
    store.delete(key);
  }

  // 2. Fall back to localStorage
  const lsEntry = lsGet<T>(key);
  if (lsEntry) {
    if (Date.now() <= lsEntry.expiresAt) {
      // Warm the in-memory cache from localStorage
      store.set(key, lsEntry as CacheEntry<unknown>);
      return lsEntry.data;
    }
    lsDelete(key);
  }

  return null;
}

export function cacheGetStale<T>(key: string): T | null {
  // Returns stale data even if expired (for stale-while-revalidate)
  const memEntry = store.get(key) as CacheEntry<T> | undefined;
  if (memEntry) return memEntry.data;

  const lsEntry = lsGet<T>(key);
  if (lsEntry) {
    store.set(key, lsEntry as CacheEntry<unknown>);
    return lsEntry.data;
  }
  return null;
}

export function cacheSet<T>(key: string, data: T, ttlMs = 60_000): void {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  };
  store.set(key, entry as CacheEntry<unknown>);
  lsSet(key, entry);
}

export function cacheDelete(key: string): void {
  store.delete(key);
  lsDelete(key);
}

export function cacheClear(): void {
  store.clear();
  if (typeof window !== 'undefined') {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Fetch-or-cache helper.
 * Returns cached value immediately if fresh; otherwise fetches, stores, and returns.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000
): Promise<T> {
  if (ttlMs === 0) {
    // Force refresh — skip cache
    const data = await fetcher();
    cacheSet(key, data, 60_000);
    return data;
  }

  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
}

/**
 * Stale-while-revalidate fetch.
 * Returns stale data immediately (if any), then revalidates in the background.
 * onRevalidated is called with fresh data once the background fetch completes.
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
  onRevalidated?: (data: T) => void
): Promise<T> {
  const stale = cacheGetStale<T>(key);
  const fresh = cacheGet<T>(key);

  if (fresh !== null) return fresh;

  if (stale !== null) {
    // Return stale immediately, revalidate in background
    Promise.resolve().then(async () => {
      try {
        const data = await fetcher();
        cacheSet(key, data, ttlMs);
        onRevalidated?.(data);
      } catch {
        // Background revalidation failed — keep stale
      }
    });
    return stale;
  }

  // No cache at all — must fetch synchronously
  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
}

// ─── Role-keyed cache TTLs ────────────────────────────────────────────────────
/** Staff list: 10 min — changes infrequently */
export const TTL_STAFF_LIST = 10 * 60_000;
/** Dashboard metrics: 3 min — needs to feel live but avoids hammering DB */
export const TTL_DASHBOARD_METRICS = 3 * 60_000;
/** Workplan list: 3 min */
export const TTL_WORKPLAN_LIST = 3 * 60_000;
/** Role permissions: 30 min — very rarely changes */
export const TTL_ROLE_PERMISSIONS = 30 * 60_000;
/** BSC perspectives: 30 min */
export const TTL_BSC_PERSPECTIVES = 30 * 60_000;
/** Reference data (departments, directorates): 30 min */
export const TTL_REFERENCE_DATA = 30 * 60_000;

/**
 * Build a role-scoped cache key.
 */
export function roleKey(base: string, role: string, scopeId?: string | null): string {
  const parts = [base, role];
  if (scopeId) parts.push(scopeId);
  return parts.join(':');
}

/**
 * Role-aware cachedFetch.
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
 * Invalidate all cache entries for a given role.
 */
export function invalidateRoleCache(role: string): void {
  for (const key of store.keys()) {
    if (key.includes(`:${role}:`) || key.endsWith(`:${role}`)) {
      store.delete(key);
      lsDelete(key);
    }
  }
}

/**
 * Invalidate a specific base key across all roles.
 */
export function invalidateByBase(base: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${base}:`) || key === base) {
      store.delete(key);
      lsDelete(key);
    }
  }
  // Also clear from localStorage for keys not in memory
  if (typeof window !== 'undefined') {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX + base))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}
