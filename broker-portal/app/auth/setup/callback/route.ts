/**
 * Setup Callback Route
 *
 * Dedicated callback for IT admin organization setup flow.
 * Validates Azure provider, blocks consumer accounts,
 * extracts email with fallback chain, and provisions org + IT admin.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { extractEmail, orgNameFromEmail } from '@/lib/auth/helpers';

// Microsoft consumer tenant ID (personal Outlook/Hotmail accounts)
const CONSUMER_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  const supabase = await createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Setup auth exchange error:', error.message);
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  // Capture provider tokens BEFORE any validation/provisioning logic.
  // This must happen first because early returns below would bypass token storage.
  if (sessionData.session) {
    const { provider_token, provider_refresh_token } = sessionData.session;
    const sessionUser = sessionData.session.user;

    if (provider_token && sessionUser.app_metadata?.provider === 'azure') {
      try {
        const { encrypt } = await import('@/lib/auth/provider-tokens');
        await supabase.from('provider_tokens').upsert(
          {
            user_id: sessionUser.id,
            provider: 'microsoft',
            access_token_encrypted: encrypt(provider_token),
            refresh_token_encrypted: provider_refresh_token
              ? encrypt(provider_refresh_token)
              : null,
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // ~1 hour (approximate)
            scopes: 'Contacts.Read offline_access',
          },
          { onConflict: 'user_id,provider' }
        );
      } catch (tokenError) {
        // Log but do not block setup flow -- tokens can be re-captured on next login
        console.error('Failed to store provider tokens:', tokenError);
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  // Validate Azure provider (reject Google or other providers)
  const provider = user.app_metadata?.provider;
  if (provider !== 'azure') {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=azure_only`);
  }

  // Extract tenant ID from Microsoft claims
  const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
  const tenantId = customClaims?.tid;

  if (!tenantId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=no_tenant`);
  }

  // Block consumer tenant (personal Microsoft accounts)
  if (tenantId === CONSUMER_TENANT_ID) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=consumer_account`);
  }

  // Extract email with fallback chain
  const email = extractEmail(user);
  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=no_email`);
  }

  // Check if user already has a membership (redirect to dashboard)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (membership) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Provision organization and IT admin
  const orgName = orgNameFromEmail(email);
  const slug = orgName.toLowerCase().replace(/\s+/g, '-');

  if (process.env.NODE_ENV === 'development') {
    console.log(`Setup provisioning: ${email}, tenant: ${tenantId}, org: ${orgName}`);
  }

  const { data, error: rpcError } = await supabase.rpc('auto_provision_it_admin', {
    p_tenant_id: tenantId,
    p_org_name: orgName,
    p_org_slug: slug,
  });

  if (rpcError) {
    console.error('Setup provision RPC failed:', rpcError.message);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=provision_failed`);
  }

  if (!data?.success) {
    console.error('Setup provision failed:', data?.error);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=provision_failed`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`Setup complete: org=${data.organization_id}, user=${data.user_id}`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
