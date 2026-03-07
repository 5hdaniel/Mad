/**
 * End Impersonation Session API Route
 *
 * Called when the support user clicks "End Session" in the impersonation banner.
 * Uses service role client to directly update the session status, since the
 * admin_end_impersonation RPC requires auth.uid() matching the admin user,
 * which is not available in the broker portal context.
 */

import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { getImpersonationSession, IMPERSONATION_COOKIE_NAME } from '@/lib/impersonation';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getImpersonationSession();

  if (session) {
    try {
      const supabase = createServiceClient();

      // Directly update the session status using service role (bypasses RLS)
      // We cannot use admin_end_impersonation RPC because it requires auth.uid()
      // to match the admin_user_id, and the admin is not authenticated here.
      const { error } = await supabase
        .from('impersonation_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', session.session_id)
        .eq('status', 'active');

      if (error) {
        console.error('Error ending impersonation session:', error);
      }

      // Also write an audit log entry for the end action
      await supabase.from('admin_audit_logs').insert({
        actor_id: session.admin_user_id,
        action: 'user.impersonate.end',
        target_type: 'user',
        target_id: session.target_user_id,
        metadata: {
          session_id: session.session_id,
          target_user_id: session.target_user_id,
          ended_from: 'broker_portal',
        },
      });
    } catch (e) {
      console.error('Error ending impersonation session:', e);
    }
  }

  // Clear the cookie regardless
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
