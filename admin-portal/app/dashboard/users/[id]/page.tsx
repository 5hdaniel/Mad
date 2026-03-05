import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UserProfileCard } from './components/UserProfileCard';
import { OrganizationCard } from './components/OrganizationCard';
import { LicenseCard } from './components/LicenseCard';
import { DevicesTable } from './components/DevicesTable';
import { AuditLogTable } from './components/AuditLogTable';
import { SentryErrorsCard } from './components/SentryErrorsCard';

export const dynamic = 'force-dynamic';

/**
 * User Detail Page - Admin Portal
 *
 * Server component that loads all user data in parallel and renders
 * a unified detail view. Sentry data is loaded client-side via
 * the SentryErrorsCard component to avoid blocking SSR.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify admin auth
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();

  if (!adminUser) {
    redirect('/login');
  }

  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role')
    .eq('user_id', adminUser.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  // Fetch target user profile from auth.users via admin RPC or profiles table
  // Using parallel queries for performance
  const [profileResult, orgsResult, licensesResult, devicesResult, auditResult] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, email, display_name, avatar_url, oauth_provider, status, subscription_tier, created_at, last_login_at')
        .eq('id', id)
        .single(),
      supabase
        .from('organization_members')
        .select('organization_id, role, joined_at, organizations(name)')
        .eq('user_id', id),
      supabase
        .from('licenses')
        .select('id, license_type, license_key, status, trial_status, trial_expires_at, transaction_count, transaction_limit, expires_at, created_at')
        .eq('user_id', id),
      supabase
        .from('devices')
        .select('id, device_name, os, app_version, last_seen_at, created_at')
        .eq('user_id', id)
        .order('last_seen_at', { ascending: false }),
      supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, metadata, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (!profileResult.data) {
    notFound();
  }

  const profile = profileResult.data;

  // Transform org memberships to include org name
  const orgMemberships = (orgsResult.data ?? []).map((m) => {
    const org = m.organizations as unknown as { name: string } | null;
    return {
      organization_id: m.organization_id,
      org_name: org?.name ?? null,
      role: m.role,
      joined_at: m.joined_at,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back navigation */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Profile card */}
      <UserProfileCard user={profile} />

      {/* Two-column grid for org + license */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrganizationCard memberships={orgMemberships} />
        <LicenseCard licenses={licensesResult.data ?? []} />
      </div>

      {/* Devices */}
      <DevicesTable devices={devicesResult.data ?? []} />

      {/* Audit log */}
      <AuditLogTable entries={auditResult.data ?? []} />

      {/* Sentry errors - client component, fetched separately */}
      {profile.email && <SentryErrorsCard email={profile.email} />}
    </div>
  );
}
