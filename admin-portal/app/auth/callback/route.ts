/**
 * OAuth Callback Route - Admin Portal
 *
 * Handles the OAuth redirect from Supabase Auth:
 * 1. Exchanges authorization code for session
 * 2. Processes pending internal invitations (auto-assigns role on first login)
 * 3. Verifies user has an internal_roles entry
 * 4. Redirects to dashboard or login with error
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
      // Process any pending internal invitation for this user
      await processPendingInvitation(supabase, user.id, user.email ?? '');

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
  email: string
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
        oauth_provider: 'azure',
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
