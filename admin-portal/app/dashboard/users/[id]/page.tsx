import { getAuthenticatedUser } from '@/lib/supabase/server';
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
  const { supabase, user: adminUser } = await getAuthenticatedUser();

  if (!adminUser) {
    redirect('/login');
  }

  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', adminUser.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  // Defense-in-depth: verify page-level permission
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: adminUser.id,
    required_permission: 'users.view',
  });
  if (!hasPerm) {
    redirect('/dashboard?error=insufficient_permissions');
  }

  // Fetch target user profile and check permissions in parallel
  const [profileResult, orgsResult, licensesResult, devicesResult, auditResult, impersonatePermResult] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, email, display_name, avatar_url, oauth_provider, status, subscription_tier, created_at, last_login_at')
        .eq('id', id)
        .single(),
      supabase
        .from('organization_members')
        .select('organization_id, role, joined_at, organizations(name, organization_plans(plan_id, plans(id, name, tier)))')
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
      supabase.rpc('has_permission', {
        check_user_id: adminUser.id,
        required_permission: 'users.impersonate',
      }),
    ]);

  if (!profileResult.data) {
    notFound();
  }

  const profile = profileResult.data;

  // Transform org memberships to include org name and plan info
  const orgMemberships = (orgsResult.data ?? []).map((m) => {
    const org = m.organizations as unknown as {
      name: string;
      organization_plans: Array<{
        plan_id: string;
        plans: { id: string; name: string; tier: string };
      }>;
    } | null;
    const orgPlan = org?.organization_plans?.[0] ?? null;
    return {
      organization_id: m.organization_id,
      org_name: org?.name ?? null,
      role: m.role,
      joined_at: m.joined_at,
      plan_id: orgPlan?.plan_id ?? null,
      plan_name: orgPlan?.plans?.name ?? null,
      plan_tier: orgPlan?.plans?.tier ?? null,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back navigation */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      {/* Profile card */}
      <UserProfileCard
        user={profile}
        canImpersonate={impersonatePermResult.data === true}
        isOwnProfile={adminUser.id === id}
      />

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
