/**
 * Setup Callback Route
 *
 * Dedicated callback for IT admin organization setup flow.
 * Supports both Google and Azure providers.
 * - Azure: validates tenant ID, blocks consumer accounts
 * - Google: validates work domain, blocks personal email domains
 * Extracts email, provisions org + IT admin.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { extractEmail, orgNameFromEmail } from '@/lib/auth/helpers';

// Microsoft consumer tenant ID (personal Outlook/Hotmail accounts)
const CONSUMER_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

// Personal email domains blocked from org setup
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.de',
  'hotmail.fr',
  'outlook.com',
  'outlook.co.uk',
  'outlook.de',
  'outlook.fr',
  'live.com',
  'live.co.uk',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'hey.com',
  'tutanota.com',
  'fastmail.com',
]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Setup auth exchange error:', error.message);
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/setup?error=auth_failed`);
  }

  const provider = user.app_metadata?.provider;

  // Only allow Google and Azure providers
  if (provider !== 'azure' && provider !== 'google') {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=unsupported_provider`);
  }

  // Extract email (works for both providers)
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
    // If IT admin and consent not yet granted, redirect to consent page
    if (membership.role === 'it_admin' || membership.role === 'admin') {
      const { data: org } = await supabase
        .from('organizations')
        .select('graph_admin_consent_granted, microsoft_tenant_id')
        .eq('id', membership.organization_id)
        .single();

      if (org && !org.graph_admin_consent_granted) {
        return NextResponse.redirect(
          `${origin}/setup/consent?tenant=${encodeURIComponent(org.microsoft_tenant_id || tenantId)}&org=${encodeURIComponent(membership.organization_id)}`
        );
      }
    }

    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const orgName = orgNameFromEmail(email);
  const slug = orgName.toLowerCase().replace(/\s+/g, '-');

  if (provider === 'azure') {
    // Azure-specific: validate tenant ID
    const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
    const tenantId = customClaims?.tid;

    if (!tenantId) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/setup?error=no_tenant`);
    }

    if (tenantId === CONSUMER_TENANT_ID) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/setup?error=consumer_account`);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Setup provisioning (Azure): ${email}, tenant: ${tenantId}, org: ${orgName}`);
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
      console.log(`Setup complete (Azure): org=${data.organization_id}, user=${data.user_id}`);
    }

    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Google-specific: validate work domain
  const domain = email.split('@')[1]?.toLowerCase();

  if (!domain || PERSONAL_DOMAINS.has(domain)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/setup?error=consumer_account`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`Setup provisioning (Google): ${email}, domain: ${domain}, org: ${orgName}`);
  }

  const { data, error: rpcError } = await supabase.rpc('auto_provision_google_it_admin', {
    p_google_domain: domain,
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
    console.log(`Setup complete (Google): org=${data.organization_id}, user=${data.user_id}`);
  }

  // After successful provisioning, redirect to admin consent page
  // so IT admin can pre-approve Graph API permissions for all tenant users
  return NextResponse.redirect(
    `${origin}/setup/consent?tenant=${encodeURIComponent(tenantId)}&org=${encodeURIComponent(data.organization_id)}`
  );
}
