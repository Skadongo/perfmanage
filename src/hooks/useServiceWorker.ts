'use client';

import { useEffect, useState } from 'react';

export interface ServiceWorkerState {
  /** True when the browser has a working network connection */
  isOnline: boolean;
}

/**
 * Simplified service worker hook — online/offline detection only.
 * The unused offline approval queue (pendingApprovals, triggerSync, swReady)
 * has been removed since offlineApprovals.ts is no longer in use.
 */
export function useServiceWorker(): ServiceWorkerState {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
