/**
 * Offline approval queue helper.
 * Stores pending review approvals in IndexedDB when offline,
 * then flushes them via the service worker background sync.
 */

const DB_NAME = 'pms-offline';
const STORE_NAME = 'approval-queue';
const SYNC_TAG = 'pms-review-approvals';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      });
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export interface QueuedApproval {
  reviewId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  queuedAt: number;
}

/** Queue a review approval for later sync when offline */
export async function queueApproval(approval: Omit<QueuedApproval, 'queuedAt'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({ ...approval, queuedAt: Date.now() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Register background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register(SYNC_TAG);
  }
}

/** Get count of pending queued approvals */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** Listen for synced approvals from the service worker */
export function onApprovalSynced(callback: (reviewId: string) => void): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'APPROVAL_SYNCED') {
      callback(event.data.reviewId);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/** Invalidate a cache base key in the service worker */
export function invalidateSWCache(base: string): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'INVALIDATE_CACHE', base });
  });
}
