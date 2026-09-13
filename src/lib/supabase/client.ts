import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    document.cookie = `${k}=1; Path=/; SameSite=None; Secure; Partitioned`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=None; Secure`;
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined' ? [] :
  document.cookie.split(';').filter(Boolean).map((c) => {
    const eqIdx = c.trim().indexOf('=');
    const name = eqIdx >= 0 ? c.trim().slice(0, eqIdx) : c.trim();
    const value = eqIdx >= 0 ? decodeURIComponent(c.trim().slice(eqIdx + 1)) : '';
    return { name: name.trim(), value };
  }).filter((c) => c.name);

const fromStorage = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch { return []; }
};

const setCookie = (name: string, value: string, options?: any) => {
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; SameSite=None; Secure; Partitioned`;
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=None; Secure',
    'Path=/; SameSite=None; Secure; Partitioned',
  ];
  variants.forEach((attrs) => {
    document.cookie = `${name}=; Max-Age=0; ${attrs}`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; Domain=${domain}; ${attrs}`;
    });
  });
};

const getToken = () =>
  (canUseCookies() ? fromCookies() : fromStorage())
    .find((c) => c.name.includes('auth-token'))?.value ?? null;

if (typeof window !== 'undefined' && !(window as any).__sb_patched__) {
  (window as any).__sb_patched__ = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const token = getToken();
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;
    if (token && (url.startsWith('/') || url.startsWith(window.location.origin))) {
      init = { ...(init || {}), headers: { ...(init?.headers || {}), 'x-sb-token': token } };
    }
    return orig(input, init);
  };
}

// Singleton instance to prevent multiple clients competing for the auth token lock
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Promise-chain mutex — the only pattern that is provably race-free in JS.
 *
 * Each lock name has a single "tail" promise. Every new acquirer appends to
 * the tail: it waits for the previous tail to settle, then runs its work,
 * then resolves its own promise so the next acquirer can proceed.
 *
 * This completely avoids the Web Locks API (which throws AbortError when
 * another tab/request uses the "steal" option).
 */
function buildCustomLock() {
  // tail: the promise that the *next* acquirer must wait for
  const tails: Record<string, Promise<void>> = {};

  return function acquireLock<T>(
    name: string,
    _acquireTimeout: number,
    fn: () => Promise<T>
  ): Promise<T> {
    // Grab the current tail (or a resolved promise if no one holds the lock)
    const prev = tails[name] ?? Promise.resolve();

    // Build a new tail: wait for prev, then run fn
    let releaseLock!: () => void;
    const next = new Promise<void>((resolve) => { releaseLock = resolve; });

    // The new tail is: wait for prev to finish, then wait for fn to finish
    tails[name] = prev.then(() => next);

    // Return the actual work promise to the caller
    return prev.then(async () => {
      try {
        return await fn();
      } finally {
        releaseLock();
        // Clean up if nothing else is waiting
        if (tails[name] === next || tails[name] === prev.then(() => next)) {
          delete tails[name];
        }
      }
    });
  };
}

export function createClient() {
  if (typeof window !== 'undefined' && browserClientInstance) {
    return browserClientInstance;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: buildCustomLock(),
      },
      cookies: {
        getAll: () => canUseCookies() ? fromCookies() : fromStorage(),
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          if (canUseCookies()) {
            cookiesToSet.forEach(({ name, value, options }) =>
              value ? setCookie(name, value, options)
                    : deleteCookie(name)
            );
          } else {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                value ? localStorage.setItem(`${PFX}${name}`, value)
                      : localStorage.removeItem(`${PFX}${name}`);
              } catch {}
              if (value) setCookie(name, value, options);
            });
          }
        },
      },
    }
  );

  if (typeof window !== 'undefined') {
    browserClientInstance = client;
  }

  return client;
}