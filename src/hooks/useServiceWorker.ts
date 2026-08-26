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

// ── Module-level singletons — registration happens exactly once ────────────
let _swRegistered = false;
let _swReady = false;
const _listeners = new Set<() => void>();

function _notifyListeners() {
  _listeners.forEach((fn) => fn());
}

function _triggerSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if ('sync' in reg) {
      (reg as any).sync.register('pms-review-approvals').catch(() => {});
    }
  });
}

function _ensureRegistered() {
  if (_swRegistered) return;
  _swRegistered = true;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      _swReady = true;
      _notifyListeners();
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

export function useServiceWorker(): ServiceWorkerState {
  const [isOnline, setIsOnline] = useState(true);
  const [swReady, setSwReady] = useState(_swReady);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingApprovals(count);
  }, []);

  const triggerSync = useCallback(() => {
    _triggerSync();
  }, []);

  useEffect(() => {
    // Sync swReady from module-level state
    setSwReady(_swReady);

    // Register a listener so this component re-syncs when SW becomes ready
    const onUpdate = () => setSwReady(_swReady);
    _listeners.add(onUpdate);

    // Online/offline detection — safe to add per-component, cleaned up on unmount
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      _triggerSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ensure SW is registered (no-op if already done)
    _ensureRegistered();

    // Initial pending count
    refreshPending();

    // Listen for synced approvals
    const unsubscribe = onApprovalSynced(() => refreshPending());

    return () => {
      _listeners.delete(onUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshPending]);

  return { isOnline, swReady, pendingApprovals, triggerSync };
}
