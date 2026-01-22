/**
 * Next.js Middleware
 *
 * Handles:
 * 1. Session refresh
 * 2. Auth protection for dashboard routes
 */

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Update session (refresh tokens if needed)
  const response = await updateSession(request);

  // Protected routes check
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith('/dashboard');
  const isAuthRoute = pathname === '/login';

  if (isProtectedRoute || isAuthRoute) {
    // Get session from cookie
    const supabaseAccessToken = request.cookies.get('sb-access-token')?.value;
    const hasSession = !!supabaseAccessToken;

    // Redirect unauthenticated users from protected routes
    if (isProtectedRoute && !hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users from auth routes
    if (isAuthRoute && hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
