import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

// Routes that do NOT require authentication
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/auth-code-error', '/change-password'];

// Role level map (mirrors AuthContext ROLE_HIERARCHY)
const ROLE_LEVELS: Record<string, number> = {
  superuser:           120,
  support_admin:       110,
  executive_director:  100,
  deputy_director:      90,
  hr_admin_officer:     80,
  programme_manager:    70,
  finance_manager:      70,
  programme_officer:    50,
  finance_officer:      50,
  admin_officer:        50,
  project_coordinator:  40,
  staff_member:         30,
};

/**
 * Route access rules.
 * minLevel: minimum role level required to access the route.
 * allowedRoles (optional): explicit allowlist — if set, minLevel is ignored.
 */
const ROUTE_RULES: Array<{ path: string; minLevel: number; allowedRoles?: string[] }> = [
  // HR Configuration — HR Officer and above only
  {
    path: '/hr-configuration',
    minLevel: 80,
    allowedRoles: [
      'superuser', 'support_admin',
      'executive_director', 'deputy_director',
      'hr_admin_officer',
    ],
  },
  // Performance Dashboard — all authenticated staff (level ≥ 30)
  {
    path: '/performance-dashboard',
    minLevel: 30,
  },
  // Evaluation Reviews — all authenticated staff (level ≥ 30)
  {
    path: '/evaluation-reviews',
    minLevel: 30,
  },
  // Analytics & Reports — managers and above
  {
    path: '/analytics-reports',
    minLevel: 70,
  },
  // Admin Dashboard — HR Officer and above
  {
    path: '/admin-dashboard',
    minLevel: 80,
  },
  // Staff Management — HR Officer and above
  {
    path: '/staff-management',
    minLevel: 80,
  },
  // Permissions — Directors and above
  {
    path: '/permissions',
    minLevel: 90,
  },
  // Appraisal Audit Trail — HR Officer and above
  {
    path: '/appraisal-audit-trail',
    minLevel: 80,
  },
];

function getRoleLevel(systemRole: string): number {
  return ROLE_LEVELS[systemRole] ?? 30;
}

function isRouteAllowed(pathname: string, systemRole: string): boolean {
  const rule = ROUTE_RULES.find((r) => pathname.startsWith(r.path));
  if (!rule) return true; // no rule = open to all authenticated users

  const level = getRoleLevel(systemRole);

  // Explicit allowlist takes priority
  if (rule.allowedRoles) {
    return rule.allowedRoles.includes(systemRole);
  }

  return level >= rule.minLevel;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast-path: skip middleware entirely for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // static files with extensions
  ) {
    return NextResponse.next({ request });
  }

  injectTokenFromHeader(request);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public paths
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access /login, redirect to dashboard
  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/performance-dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // Role-based access control for authenticated users
  if (user && !isPublic) {
    // Fetch the user's system_role from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('system_role')
      .eq('id', user.id)
      .maybeSingle();

    const systemRole =
      profile?.system_role ||
      user.user_metadata?.system_role ||
      user.app_metadata?.system_role ||
      'staff_member';

    if (!isRouteAllowed(pathname, systemRole)) {
      // Redirect to access-denied page (performance-dashboard with a query param)
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = '/performance-dashboard';
      deniedUrl.searchParams.set('access_denied', '1');
      deniedUrl.searchParams.set('attempted', pathname);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     * - files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot)$).*)',
  ],
};
