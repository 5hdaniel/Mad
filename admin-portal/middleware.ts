/**
 * Next.js Middleware - Admin Portal
 *
 * Handles:
 * 1. Session refresh via Supabase SSR
 * 2. Auth protection for dashboard routes
 * 3. Internal role verification (rejects non-internal users)
 * 4. Permission-based route gating via RBAC
 * 5. Redirect logic for authenticated/unauthenticated users
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** Maps route prefixes to required permission keys (any one grants access) */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/analytics': ['analytics.view'],
  '/dashboard/users': ['users.view'],
  '/dashboard/organizations': ['organizations.view'],
  '/dashboard/audit-log': ['audit.view'],
  '/dashboard/settings': ['internal_users.view', 'roles.view', 'audit.view'],
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith('/dashboard');
  const isAuthRoute = pathname === '/login';

  try {
    // Refresh session (important for token refresh)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users from protected routes
    if (isProtectedRoute && !user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify internal role for protected routes
    if (isProtectedRoute && user) {
      const { data: internalRole } = await supabase
        .from('internal_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .single();

      if (!internalRole) {
        // User is authenticated but does not have an internal role
        return NextResponse.redirect(new URL('/login?error=not_authorized', request.url));
      }

      // Check route-level permissions (skip for /dashboard root — always allowed for internal users)
      for (const [routePrefix, requiredPermissions] of Object.entries(ROUTE_PERMISSIONS)) {
        if (pathname.startsWith(routePrefix)) {
          let hasAnyPerm = false;
          for (const perm of requiredPermissions) {
            const { data: hasPerm } = await supabase.rpc('has_permission', {
              check_user_id: user.id,
              required_permission: perm,
            });
            if (hasPerm) {
              hasAnyPerm = true;
              break;
            }
          }

          if (!hasAnyPerm) {
            return NextResponse.redirect(new URL('/dashboard?error=insufficient_permissions', request.url));
          }
          break;
        }
      }
    }

    // Redirect authenticated internal users from login page to dashboard
    if (isAuthRoute && user) {
      const { data: internalRole } = await supabase
        .from('internal_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .single();

      if (internalRole) {
        const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/dashboard';
        return NextResponse.redirect(new URL(redirectTo, request.url));
      }
    }
  } catch {
    // If Supabase calls fail (timeout, network), let the request through
    // rather than showing a 500 error. The page-level auth checks will
    // handle protection as a fallback.
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
