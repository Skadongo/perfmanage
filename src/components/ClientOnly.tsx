'use client';

import { useEffect, useState, ReactNode } from 'react';

/**
 * Renders children only after the component has mounted on the client.
 * Use this to wrap any UI that depends on browser-only state (auth, navigator,
 * localStorage, Date.now(), etc.) to prevent SSR/client hydration mismatches.
 *
 * The `fallback` prop (default: null) is rendered during SSR and on the first
 * client render before mount — it must produce the same markup as the server.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
