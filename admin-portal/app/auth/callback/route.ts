/**
 * OAuth Callback Route - Admin Portal
 *
 * Handles the OAuth redirect from Supabase Auth:
 * 1. Exchanges authorization code for session
 * 2. Verifies user has an internal_roles entry
 * 3. Redirects to dashboard or login with error
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth exchange error:', error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Check for internal role
      const { data: internalRole } = await supabase
        .from('internal_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .single();

      if (internalRole) {
        // User has internal role - redirect to dashboard
        return NextResponse.redirect(`${origin}${next}`);
      }

      // User does not have an internal role - sign them out and reject
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_authorized`);
    }
  }

  // No code provided or auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
