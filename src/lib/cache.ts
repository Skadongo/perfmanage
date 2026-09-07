/**
 * Lightweight in-memory cache with TTL support.
 * Used for rarely-changing data: staff list, BSC perspectives, role permissions.
 * Role-keyed helpers ensure managers, directors, and staff see role-specific data
 * without database hits on revisits (target: <500ms).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttlMs = 60_000): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
}

/**
 * Fetch-or-cache helper.
 * If the key is in cache (and not expired) it returns immediately.
 * Otherwise it calls `fetcher`, stores the result, and returns it.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
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

/**
 * Build a role-scoped cache key.
 * Ensures managers, directors, and staff each get their own cache bucket
 * so role-specific data never bleeds across roles.
 *
 * @param base    - logical key, e.g. "staff-list", "dashboard-metrics" * @param role    - systemRole from UserProfile, e.g."programme_manager"
 * @param scopeId - optional staff/user id for per-user scoping
 */
export function roleKey(base: string, role: string, scopeId?: string | null): string {
  const parts = [base, role];
  if (scopeId) parts.push(scopeId);
  return parts.join(':');
}

/**
 * Role-aware cachedFetch.
 * Wraps cachedFetch with a role-scoped key so each role bucket is cached
 * independently — revisits load from memory in <1ms.
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
 * Call this when a user's role changes or when an admin forces a refresh.
 */
export function invalidateRoleCache(role: string): void {
  for (const key of store.keys()) {
    if (key.includes(`:${role}:`) || key.endsWith(`:${role}`)) {
      store.delete(key);
    }
  }
}

/**
 * Invalidate a specific base key across all roles.
 * Useful when underlying data changes (e.g. new staff member added).
 */
export function invalidateByBase(base: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${base}:`) || key === base) {
      store.delete(key);
    }
  }
}
