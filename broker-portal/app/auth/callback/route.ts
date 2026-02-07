/**
 * OAuth Callback Route
 *
 * Handles the OAuth redirect from Supabase Auth:
 * 1. Exchanges authorization code for session
 * 2. Verifies user has broker/admin/it_admin role
 * 3. Auto-provisions IT admins from Microsoft OAuth (creates org + user)
 * 4. Redirects to dashboard or login with error
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { extractEmail, orgNameFromEmail } from '@/lib/auth/helpers';

// Allowed roles for broker portal access
const ALLOWED_ROLES = ['broker', 'admin', 'it_admin'];

/**
 * Auto-provision organization and user for Microsoft IT admins
 * Uses the auto_provision_it_admin RPC function which has elevated permissions
 */
async function autoProvisionITAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User
): Promise<{ success: boolean; organizationId?: string }> {
  // Extract Microsoft tenant ID from user metadata
  const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
  const tenantId = customClaims?.tid;

  if (!tenantId) {
    console.warn('No Microsoft tenant ID found for user');
    return { success: false };
  }

  const email = extractEmail(user) || '';
  const orgName = orgNameFromEmail(email);
  const slug = orgName.toLowerCase().replace(/\s+/g, '-');

  if (process.env.NODE_ENV === 'development') {
    console.log(`Auto-provisioning IT admin: ${email}, tenant: ${tenantId}, org: ${orgName}`);
  }

  // Call the RPC function which handles all provisioning with elevated permissions
  const { data, error } = await supabase.rpc('auto_provision_it_admin', {
    p_tenant_id: tenantId,
    p_org_name: orgName,
    p_org_slug: slug,
  });

  if (error) {
    console.error('Auto-provision RPC failed:', error);
    return { success: false };
  }

  if (!data?.success) {
    console.error('Auto-provision failed:', data?.error);
    return { success: false };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`Successfully provisioned: org=${data.organization_id}, user=${data.user_id}`);
  }
  return { success: true, organizationId: data.organization_id };
}

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
      // Check for existing membership (any role)
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (membership) {
        if (ALLOWED_ROLES.includes(membership.role)) {
          // Portal user (broker/admin/it_admin) - go to dashboard
          return NextResponse.redirect(`${origin}${next}`);
        }
        // Agent or other non-portal role - redirect to download page
        return NextResponse.redirect(`${origin}/download`);
      }

      // No membership with allowed role - try to claim a pending invite via RPC
      // The RPC uses SECURITY DEFINER to bypass RLS (invite rows have user_id = NULL)
      const { data: claimResult, error: claimError } = await supabase.rpc('claim_pending_invite');

      if (claimError) {
        console.error('claim_pending_invite RPC error:', claimError);
      }

      if (claimResult?.success) {
        const claimedRole = claimResult.role as string;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Claimed invite: role=${claimedRole}, org=${claimResult.organization_id}`);
        }

        if (ALLOWED_ROLES.includes(claimedRole)) {
          // Portal user (broker/admin/it_admin) - go to dashboard
          return NextResponse.redirect(`${origin}${next}`);
        }

        // Agent or other non-portal role - redirect to download page
        return NextResponse.redirect(`${origin}/download`);
      }

      // No membership and no pending invite - check if this is a Microsoft user for auto-provisioning
      const provider = user.app_metadata?.provider;

      if (provider === 'azure') {
        // Auto-provision as IT admin
        const result = await autoProvisionITAdmin(supabase, user);

        if (result.success) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Successfully provisioned IT admin');
          }
          return NextResponse.redirect(`${origin}${next}`);
        }
      }

      // User not authorized and not auto-provisionable - sign them out
      console.warn('User attempted portal access without valid role');
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_authorized`);
    }
  }

  // No code provided or auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
