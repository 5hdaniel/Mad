/**
 * Next.js Middleware
 *
 * Handles:
 * 1. Session refresh via Supabase SSR
 * 2. Auth protection for dashboard routes
 * 3. Redirect logic for authenticated/unauthenticated users
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { IMPERSONATION_COOKIE_NAME } from '@/lib/constants';

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
  const isAuthRoute = pathname === '/login' || pathname === '/setup';
  const isImpersonationRoute = pathname === '/auth/impersonate';

  // Allow impersonation entry route without any auth check
  if (isImpersonationRoute) {
    return response;
  }

  // TASK-2133: Lightweight cookie-exists check only.
  // Middleware runs in Edge Runtime where DB access is limited.
  // The page-level getImpersonationSession() is the authoritative check
  // (validates signature via TASK-2131 and DB session via TASK-2133).
  const impersonationCookie = request.cookies.get(IMPERSONATION_COOKIE_NAME);
  if (isProtectedRoute && impersonationCookie?.value) {
    // Cookie exists -- allow access through to the page, where full
    // signature + DB validation will occur via getImpersonationSession().
    return response;
  }

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

    // Redirect agent-role users away from dashboard to download page
    if (isProtectedRoute && user) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (membership && !['admin', 'it_admin', 'broker'].includes(membership.role)) {
        return NextResponse.redirect(new URL('/download', request.url));
      }
    }

    // Redirect authenticated users from login page
    if (isAuthRoute && user) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
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
