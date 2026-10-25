'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { swrFetch, cacheSetPersisted, cacheGetStale } from '@/lib/cache';

interface UseCachedQueryOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  staleTtlMs?: number;
  /** Persist to localStorage for instant load on next page visit */
  persist?: boolean;
  /** Only fetch when true */
  enabled?: boolean;
}

interface UseCachedQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => void;
}

/**
 * Generic cached query hook with stale-while-revalidate.
 * - Serves stale data instantly from memory or localStorage
 * - Refreshes in background when data is stale
 * - Deduplicates concurrent requests for the same key
 *
 * Usage:
 *   const { data, loading, isStale } = useCachedQuery({
 *     key: 'staff-list:hr_admin',
 *     fetcher: () => supabase.from('staff').select('*'),
 *     ttlMs: TTL_STAFF_LIST,
 *     persist: true,
 *   });
 */
export function useCachedQuery<T>({
  key,
  fetcher,
  ttlMs = 60_000,
  staleTtlMs,
  persist = false,
  enabled = true,
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(() => {
    // Synchronously hydrate from in-memory cache on first render
    const stale = cacheGetStale<T>(key);
    return stale?.data ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isMounted = useRef(true);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;

      // Check stale cache first
      if (!force) {
        const staleResult = cacheGetStale<T>(key);
        if (staleResult) {
          if (isMounted.current) {
            setData(staleResult.data);
            setIsStale(staleResult.isStale);
          }
          if (!staleResult.isStale) return; // fresh — no DB call needed
          // Stale — continue to background refresh without showing loading spinner
        }
      }

      if (!data || force) {
        if (isMounted.current) setLoading(true);
      }

      try {
        const result = await swrFetch<T>(
          key,
          fetcher,
          ttlMs,
          (fresh) => {
            if (isMounted.current) {
              setData(fresh);
              setIsStale(false);
            }
            if (persist) {
              cacheSetPersisted(key, fresh, ttlMs, staleTtlMs);
            }
          },
          staleTtlMs
        );

        if (isMounted.current) {
          setData(result);
          setIsStale(false);
          setError(null);
        }

        if (persist) {
          cacheSetPersisted(key, result, ttlMs, staleTtlMs);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled, ttlMs, staleTtlMs, persist]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, isStale, refresh };
}
