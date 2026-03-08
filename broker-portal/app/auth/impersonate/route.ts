/**
 * Impersonation Entry Route
 *
 * Validates an impersonation token via the admin_validate_impersonation_token RPC,
 * sets an HTTP-only cookie with session metadata, and redirects to the dashboard.
 *
 * Flow:
 * 1. Admin portal generates token via admin_start_impersonation RPC
 * 2. Admin portal opens this URL in a new tab: /auth/impersonate?token=<UUID>
 * 3. This route validates the token using service role client (no user session needed)
 * 4. On success: sets impersonation cookie and redirects to /dashboard
 * 5. On failure: redirects to /login with error
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { IMPERSONATION_COOKIE_NAME, type ImpersonationSession } from '@/lib/impersonation';
import { signCookieValue } from '@/lib/cookie-signing';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  // Validate hex token format to prevent injection (64-char hex from gen_random_bytes(32))
  const hexRegex = /^[0-9a-f]{64}$/i;
  if (!hexRegex.test(token)) {
    return NextResponse.redirect(`${origin}/login?error=impersonation_invalid_token`);
  }

  try {
    // Use service role client — the RPC is restricted to service_role only
    // (BACKLOG-910 revoked access from authenticated role)
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('admin_validate_impersonation_token', {
      p_token: token,
    });

    if (error) {
      // BACKLOG-906: Log full error server-side only; never expose details in redirect URL
      console.error('Impersonation token validation error:', JSON.stringify(error));
      return NextResponse.redirect(`${origin}/login?error=impersonation_validation_failed`);
    }

    if (!data?.valid) {
      const errorCode = data?.error || 'invalid_token';
      return NextResponse.redirect(`${origin}/login?error=impersonation_${errorCode}`);
    }

    // Build impersonation session data for the cookie
    const impersonationData: ImpersonationSession = {
      session_id: data.session_id,
      target_user_id: data.target_user_id,
      admin_user_id: data.admin_user_id,
      target_email: data.target_email,
      target_name: data.target_name || '',
      expires_at: data.expires_at,
      started_at: data.started_at,
    };

    // TASK-2131: Sign the cookie payload with HMAC-SHA256 to prevent tampering
    const signedValue = signCookieValue(JSON.stringify(impersonationData));

    const response = NextResponse.redirect(`${origin}/dashboard`);
    response.cookies.set(IMPERSONATION_COOKIE_NAME, signedValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: new Date(data.expires_at),
    });

    return response;
  } catch (err) {
    // BACKLOG-906: Log full error server-side only; never expose details in redirect URL
    console.error('Impersonation route error:', err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(`${origin}/login?error=impersonation_server_error`);
  }
}
