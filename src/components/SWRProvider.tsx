'use client';

import { SWRConfig } from 'swr';
import React from 'react';

/**
 * Global SWR configuration provider.
 * - revalidateOnFocus: false — prevents refetch every time the user switches tabs
 * - revalidateOnReconnect: true — refresh when network comes back
 * - dedupingInterval: 60 s — collapse duplicate requests within 60 s window
 * - errorRetryCount: 2 — don't hammer the DB on errors
 * - keepPreviousData: true — show stale data while revalidating (optimistic UI)
 * - revalidateIfStale: true — background revalidation of stale data
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 60_000,
        errorRetryCount: 2,
        keepPreviousData: true,
        revalidateIfStale: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
