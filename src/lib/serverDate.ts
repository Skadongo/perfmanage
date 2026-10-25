/**
 * serverDate.ts
 *
 * Fetches the current timestamp from the host server's /api/server-time endpoint.
 * Falls back to the local client clock only if the network request fails.
 *
 * Usage:
 *   import { getServerNow } from '@/lib/serverDate';
 *   const now = await getServerNow();   // ISO string from server
 */

let _cachedServerOffset: number | null = null;

/**
 * Fetches the server clock once per session and caches the offset
 * between server time and client time. Subsequent calls use the
 * cached offset so they are instant.
 */
async function getServerOffset(): Promise<number> {
  if (_cachedServerOffset !== null) return _cachedServerOffset;

  try {
    const clientBefore = Date.now();
    const res = await fetch('/api/server-time', { cache: 'no-store' });
    const clientAfter = Date.now();
    if (!res.ok) throw new Error('server-time fetch failed');
    const { iso } = await res.json() as { iso: string };
    const serverMs = new Date(iso).getTime();
    // Use midpoint of round-trip to estimate server time at call moment
    const clientMid = (clientBefore + clientAfter) / 2;
    _cachedServerOffset = serverMs - clientMid;
  } catch {
    // Network unavailable — offset stays 0 (use client clock)
    _cachedServerOffset = 0;
  }

  return _cachedServerOffset;
}

/**
 * Returns the current server time as an ISO 8601 string.
 * On first call it fetches the server clock; subsequent calls are instant.
 */
export async function getServerNow(): Promise<string> {
  const offset = await getServerOffset();
  return new Date(Date.now() + offset).toISOString();
}

/**
 * Returns the current server year (number).
 */
export async function getServerYear(): Promise<number> {
  const iso = await getServerNow();
  return new Date(iso).getFullYear();
}

/**
 * Resets the cached offset (useful in tests or after long idle periods).
 */
export function resetServerDateCache(): void {
  _cachedServerOffset = null;
}
