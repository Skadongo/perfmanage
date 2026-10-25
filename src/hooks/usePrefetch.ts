'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Route prefetching hook.
 * Silently preloads the most visited pages after the dashboard mounts
 * so subsequent navigation feels instant (no loading delay).
 *
 * Next.js router.prefetch() downloads the JS bundle for the route
 * in the background without triggering a navigation.
 */

const HIGH_TRAFFIC_ROUTES = [
  '/evaluation-reviews',
  '/self-assessment',
  '/mid-year-reviews',
  '/manager-review',
  '/analytics-reports',
];

export function usePrefetchRoutes(routes: string[] = HIGH_TRAFFIC_ROUTES) {
  const router = useRouter();

  useEffect(() => {
    // Delay prefetching slightly so it doesn't compete with the initial page render
    const timer = setTimeout(() => {
      routes.forEach((route) => {
        try {
          router.prefetch(route);
        } catch {
          // Prefetch failures are non-critical — ignore silently
        }
      });
    }, 2000); // 2 s after mount — page is fully interactive by then

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
