/**
 * PMS Service Worker — RETIRED.
 *
 * An earlier version of this file cached Supabase REST responses for 2 minutes
 * (without a per-user key) and served stale pages. That produced stale
 * "no workplan yet" reads and failed workplan saves. This version removes every
 * cache it ever created, unregisters itself and stops intercepting requests.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.postMessage({ type: 'SW_RETIRED' }));
      } catch (e) {
        // ignore
      }
    })()
  );
});

// No fetch handler: every request goes straight to the network.
