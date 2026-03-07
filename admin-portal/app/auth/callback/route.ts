/**
 * OAuth Callback Route - Admin Portal
 *
 * Handles the OAuth redirect from Supabase Auth:
 * 1. Exchanges authorization code for session
 * 2. Logs authentication events (success/failure) for SOC 2 CC6.2
 * 3. Processes pending internal invitations (auto-assigns role on first login)
 * 4. Verifies user has an internal_roles entry
 * 5. Redirects to dashboard or login with error
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Log an authentication event to admin_audit_logs.
 * Never blocks the auth flow - failures are caught and logged to console.
 */
async function logAuthEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>
) {
  try {
    await supabase.rpc('log_admin_action', {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_metadata: metadata,
    });
  } catch (err) {
    // Never block auth flow for audit logging failures
    console.error('[auth-callback] Failed to log auth event:', err);
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const next = /^\/[a-zA-Z0-9\-_\/\?\&\=\#\.]+$/.test(rawNext) ? rawNext : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth exchange error:', error);
      // Log failed auth exchange
      await logAuthEvent(supabase, 'auth.login_failed', 'auth', 'unknown', {
        error: error.message,
        source: 'admin_portal',
        stage: 'code_exchange',
      });
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Log successful login
      await logAuthEvent(supabase, 'auth.login', 'user', user.id, {
        email: user.email,
        source: 'admin_portal',
        provider: user.app_metadata?.provider || 'unknown',
      });

      // Process any pending internal invitation for this user
      const oauthProvider = user.app_metadata?.provider ?? 'azure';
      await processPendingInvitation(supabase, user.id, user.email ?? '', oauthProvider);

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
      await logAuthEvent(supabase, 'auth.login_denied', 'user', user.id, {
        email: user.email,
        source: 'admin_portal',
        reason: 'no_internal_role',
      });
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_authorized`);
    }
  }

  // No code provided or auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

/**
 * Check for a pending invitation and auto-assign the internal role.
 *
 * When an admin invites a user who doesn't have a Keepr account yet,
 * we store the invitation in pending_internal_invitations. On first
 * SSO login, this function picks it up:
 *   1. Ensures public.users record exists
 *   2. Assigns the internal role
 *   3. Deletes the invitation
 */
async function processPendingInvitation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string,
  provider: string
) {
  if (!email) return;

  try {
    // Check for pending invitation
    const { data: invitation } = await supabase
      .from('pending_internal_invitations')
      .select('id, role_id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!invitation) return;

    // Ensure public.users record exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingUser) {
      // Create public.users record for this user
      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        email: email.toLowerCase(),
        oauth_provider: provider,
        oauth_id: userId,
        status: 'active',
        is_active: true,
      });

      if (insertError) {
        console.error('[auth-callback] Failed to create public.users record:', insertError.message);
        return;
      }
    }

    // Look up the role slug for the RPC
    const { data: role } = await supabase
      .from('admin_roles')
      .select('slug')
      .eq('id', invitation.role_id)
      .single();

    if (!role) {
      console.error('[auth-callback] Invitation references unknown role_id:', invitation.role_id);
      return;
    }

    // Assign the internal role via RPC
    const { error: rpcError } = await supabase.rpc('admin_add_internal_user', {
      p_email: email.toLowerCase(),
      p_role: role.slug,
    });

    if (rpcError) {
      console.error('[auth-callback] Failed to assign internal role:', rpcError.message);
      return;
    }

    // Delete the processed invitation
    await supabase
      .from('pending_internal_invitations')
      .delete()
      .eq('id', invitation.id);

    console.log(`[auth-callback] Processed invitation: ${email} assigned role ${role.slug}`);
  } catch (err) {
    console.error('[auth-callback] Error processing pending invitation:', err);
  }
}
