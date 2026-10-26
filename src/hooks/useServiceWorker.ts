'use client';

import { useEffect, useState } from 'react';

export interface ServiceWorkerState {
  /** True when the browser has a working network connection */
  isOnline: boolean;
}

/**
 * Online/offline detection, plus one-time cleanup of any legacy service worker
 * and its caches. An old service worker cached Supabase REST reads and caused
 * stale data / failed workplan saves, so we actively remove it here.
 */
export function useServiceWorker(): ServiceWorkerState {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Retire legacy service workers + caches (safe to run on every load)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== 'undefined') {
      caches
        .keys()
        .then((keys) => keys.filter((k) => k.startsWith('pms-')).forEach((k) => caches.delete(k)))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
