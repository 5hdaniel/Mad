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

// Allowed roles for broker portal access
const ALLOWED_ROLES = ['broker', 'admin', 'it_admin'];

/**
 * Extract organization name from email domain
 * e.g., "daniel@izzyrescue.org" -> "Izzy Rescue"
 */
function orgNameFromEmail(email: string): string {
  const domain = email.split('@')[1];
  if (!domain) return 'Unknown Organization';

  // Get the main part of the domain (before TLD)
  const name = domain.split('.')[0];

  // Convert to title case with spaces
  // e.g., "izzyrescue" -> "Izzy Rescue", "acme-corp" -> "Acme Corp"
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Auto-provision organization and user for Microsoft IT admins
 * Uses the auto_provision_it_admin RPC function which has elevated permissions
 */
async function autoProvisionITAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string; user_metadata: Record<string, unknown> }
): Promise<{ success: boolean; organizationId?: string }> {
  // Extract Microsoft tenant ID from user metadata
  const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
  const tenantId = customClaims?.tid;

  if (!tenantId) {
    console.warn('No Microsoft tenant ID found for user:', user.id);
    return { success: false };
  }

  const email = user.email || '';
  const orgName = orgNameFromEmail(email);
  const slug = orgName.toLowerCase().replace(/\s+/g, '-');

  console.log(`Auto-provisioning IT admin: ${email}, tenant: ${tenantId}, org: ${orgName}`);

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

  console.log(`Successfully provisioned: org=${data.organization_id}, user=${data.user_id}`);
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
      // Check for existing membership with allowed role
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .in('role', ALLOWED_ROLES)
        .limit(1)
        .single();

      if (membership) {
        // User has valid role - redirect to dashboard
        // IT admins go to a limited view (handled by dashboard)
        return NextResponse.redirect(`${origin}${next}`);
      }

      // No membership - check if this is a Microsoft user for auto-provisioning
      const provider = user.app_metadata?.provider;

      if (provider === 'azure') {
        // Auto-provision as IT admin
        const result = await autoProvisionITAdmin(supabase, user);

        if (result.success) {
          console.log(`Successfully provisioned IT admin: ${user.email}`);
          return NextResponse.redirect(`${origin}${next}`);
        }
      }

      // User not authorized and not auto-provisionable - sign them out
      console.warn(`User ${user.id} attempted portal access without valid role`);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_authorized`);
    }
  }

  // No code provided or auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
