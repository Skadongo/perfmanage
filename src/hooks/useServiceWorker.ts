'use client';

import { useEffect, useState, useCallback } from 'react';
import { getPendingCount, onApprovalSynced } from '@/lib/offlineApprovals';

export interface ServiceWorkerState {
  /** True when the browser has a working network connection */
  isOnline: boolean;
  /** True once the service worker is registered and active */
  swReady: boolean;
  /** Number of review approvals queued for sync */
  pendingApprovals: number;
  /** Manually trigger a sync attempt */
  triggerSync: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [isOnline, setIsOnline] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingApprovals(count);
  }, []);

  const triggerSync = useCallback(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if ('sync' in reg) {
        (reg as any).sync.register('pms-review-approvals').catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    // Online/offline detection
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          setSwReady(true);
          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(() => {});
    }

    // Initial pending count
    refreshPending();

    // Listen for synced approvals
    const unsubscribe = onApprovalSynced(() => refreshPending());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshPending, triggerSync]);

  return { isOnline, swReady, pendingApprovals, triggerSync };
}
