'use client';

import { SWRConfig } from 'swr';
import React, { useEffect } from 'react';
import { hydrateFromStorage } from '@/lib/cache';

/**
 * Global SWR configuration provider.
 *
 * Performance tuning:
 * - revalidateOnFocus: false — prevents refetch every time the user switches tabs
 * - revalidateOnReconnect: true — refresh when network comes back
 * - dedupingInterval: 30 s — collapse duplicate requests within 30 s window
 * - focusThrottleInterval: 60 s — even if focus revalidation were on, throttle to 1/min
 * - errorRetryCount: 2 — don't hammer the DB on errors
 * - errorRetryInterval: 5 s — wait 5 s between retries
 * - keepPreviousData: true — show previous page data while loading next page (no flash)
 * - revalidateIfStale: true — background revalidation when data is stale
 * - loadingTimeout: 3 s — warn in console if request takes > 3 s
 *
 * Also hydrates the in-memory cache from localStorage on first render
 * so cached data is available instantly before any DB calls.
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Hydrate in-memory cache from localStorage on app boot
    // This makes previously-fetched data available in <1ms on page reload
    hydrateFromStorage();
  }, []);

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        dedupingInterval: 30_000,
        focusThrottleInterval: 60_000,
        errorRetryCount: 2,
        errorRetryInterval: 5_000,
        keepPreviousData: true,
        loadingTimeout: 3_000,
        onLoadingSlow: (key) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[SWR] Slow request detected for key: ${key}`);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
