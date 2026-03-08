/**
 * Logout Route - Admin Portal
 *
 * Server-side logout handler that:
 * 1. Logs the auth.logout event to admin_audit_logs (SOC 2 CC6.2)
 * 2. Signs the user out of Supabase
 * 3. Returns success/failure status
 *
 * Called from AuthProvider.signOut() on the client side.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Get the current user before signing out
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Extract IP and user-agent for SOC 2 CC6.1 audit trail
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || null;

    // Log the logout event - never block signOut if this fails
    try {
      await supabase.rpc('log_admin_action', {
        p_action: 'auth.logout',
        p_target_type: 'user',
        p_target_id: user.id,
        p_metadata: {
          email: user.email,
          source: 'admin_portal',
        },
        p_ip_address: ip,
        p_user_agent: userAgent,
      });
    } catch (err) {
      console.error('[auth-logout] Failed to log logout event:', err);
    }
  }

  // Sign out regardless of audit log success
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
