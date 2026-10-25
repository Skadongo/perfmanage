/**
 * Shared useDataFetch hook.
 * Consolidates the repeated fetch → loading → error → cache pattern
 * used by ReviewStatsDashboard, DashboardMetricCards, KPIYearOnYearChart,
 * AtRiskStaffTable, and other dashboard components.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheGet, cacheSet } from '@/lib/cache';

interface UseDataFetchOptions<T> {
  /** Unique cache key — set to null/undefined to skip caching */
  cacheKey?: string;
  /** Cache TTL in ms (default: 2 min) */
  ttlMs?: number;
  /** Whether to skip the initial fetch (useful for conditional fetching) */
  skip?: boolean;
}

interface UseDataFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data-fetch hook with built-in loading/error/cache state.
 *
 * @param fetcher  - async function that returns the data
 * @param deps     - dependency array (like useEffect deps) — refetches when these change
 * @param options  - optional caching and skip configuration
 */
export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: UseDataFetchOptions<T> = {}
): UseDataFetchResult<T> {
  const { cacheKey, ttlMs = 2 * 60_000, skip = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  // Keep a stable ref to the fetcher to avoid stale closures
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async (forceRefresh = false) => {
      if (skip) return;

      // Return cached value immediately if available
      if (cacheKey && !forceRefresh) {
        const cached = cacheGet<T>(cacheKey);
        if (cached !== null) {
          if (isMounted.current) {
            setData(cached);
            setLoading(false);
          }
          return;
        }
      }

      if (isMounted.current) setLoading(true);
      try {
        const result = await fetcherRef.current();
        if (!isMounted.current) return;
        if (cacheKey) cacheSet(cacheKey, result, ttlMs);
        setData(result);
        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, ttlMs, skip, ...deps]
  );

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => { isMounted.current = false; };
  }, [run]);

  const refetch = useCallback(() => run(true), [run]);

  return { data, loading, error, refetch };
}
