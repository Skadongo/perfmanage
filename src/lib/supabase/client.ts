import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';

// On https (including when embedded in the platform iframe) use cross-site-capable cookies.
// On plain http (local dev) fall back to Lax.
const cookieAttrs = () => {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
};

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    document.cookie = `${k}=1; Path=/; ${cookieAttrs()}`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; ${cookieAttrs()}`;
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined' ? [] :
  document.cookie.split(';').filter(Boolean).map((c) => {
    const eqIdx = c.trim().indexOf('=');
    const name = eqIdx >= 0 ? c.trim().slice(0, eqIdx) : c.trim();
    let value = '';
    if (eqIdx >= 0) {
      const raw = c.trim().slice(eqIdx + 1);
      try { value = decodeURIComponent(raw); } catch { value = raw; }
    }
    return { name: name.trim(), value };
  }).filter((c) => c.name);

const fromStorage = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch { return []; }
};

// Standard first-party cookie: SameSite=Lax (+ Secure on https). No Partitioned attribute.
// Cookie attributes adapt to the protocol so login works both in the preview iframe and on the published site.
const setCookie = (name: string, value: string, options?: any) => {
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; ${cookieAttrs()}`;
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);

  // Also clears cookies written by earlier versions (SameSite=None / Partitioned)
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=Lax; Secure',
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

// Singleton instance so only one client manages the auth token
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;

// In-process lock: serialises auth operations inside this tab without using
// navigator.locks, which can be "stolen" by another request and throw
// "AbortError: Lock broken by another request with the 'steal' option".
const lockQueues: Record<string, Promise<unknown>> = {};
async function inProcessLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const previous = lockQueues[name] ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  lockQueues[name] = tail;
  try {
    await previous.catch(() => undefined);
    return await fn();
  } finally {
    release();
    if (lockQueues[name] === tail) delete lockQueues[name];
  }
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
        lock: inProcessLock,
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