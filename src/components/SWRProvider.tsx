'use client';

import { SWRConfig } from 'swr';
import React from 'react';

/**
 * Global SWR configuration provider.
 * - revalidateOnFocus: false — prevents refetch every time the user switches tabs
 * - revalidateOnReconnect: true — refresh when network comes back
 * - dedupingInterval: 30 s — collapse duplicate requests within 30 s window
 * - errorRetryCount: 2 — don't hammer the DB on errors
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
