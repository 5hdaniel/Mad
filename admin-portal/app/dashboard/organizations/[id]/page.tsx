import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { MembersTable, type MemberRow } from './components/MembersTable';

export const dynamic = 'force-dynamic';

/**
 * Organization Detail Page - Admin Portal
 *
 * Server component that loads organization details and members.
 * Uses existing admin RLS policies for cross-org read access.
 */
export default async function OrganizationDetailPage({
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

  // Fetch org details and members in parallel
  const [orgResult, membersResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, plan, max_seats, created_at')
      .eq('id', id)
      .single(),
    supabase
      .from('organization_members')
      .select('user_id, role, license_status, joined_at, users(id, email, display_name, status, suspended_at)')
      .eq('organization_id', id)
      .order('joined_at', { ascending: false }),
  ]);

  if (!orgResult.data) {
    notFound();
  }

  const org = orgResult.data;

  // Transform members to include user info
  const members: MemberRow[] = (membersResult.data ?? []).map((m) => {
    const user = m.users as unknown as { id: string; email: string | null; display_name: string | null; status: string | null; suspended_at: string | null } | null;
    return {
      user_id: m.user_id ?? user?.id ?? '',
      display_name: user?.display_name ?? null,
      email: user?.email ?? null,
      role: m.role,
      license_status: m.license_status,
      joined_at: m.joined_at,
      status: user?.status ?? null,
    };
  });

  // License summary from member license_status
  const licenseSummary = members.reduce(
    (acc, m) => {
      const status = (m.license_status || 'none').toLowerCase();
      if (status === 'active' || status === 'assigned') acc.active++;
      else if (status === 'expired' || status === 'revoked') acc.expired++;
      else if (status === 'pending' || status === 'trial') acc.trial++;
      else acc.none++;
      return acc;
    },
    { active: 0, expired: 0, trial: 0, none: 0 }
  );

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back navigation */}
      <Link
        href="/dashboard/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Organizations
      </Link>

      {/* Organization header card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{org.slug}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</dt>
            <dd className="mt-1 text-sm text-gray-900">{org.plan || 'None'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Seats</dt>
            <dd className="mt-1 text-sm text-gray-900">{org.max_seats ?? 'Unlimited'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Members</dt>
            <dd className="mt-1 text-sm text-gray-900">{members.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(org.created_at)}</dd>
          </div>
        </div>
      </div>

      {/* License summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">License Summary</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-success-50 p-4 text-center">
            <p className="text-2xl font-bold text-success-600">{licenseSummary.active}</p>
            <p className="text-xs text-success-600 mt-1">Active</p>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{licenseSummary.trial}</p>
            <p className="text-xs text-yellow-700 mt-1">Trial / Pending</p>
          </div>
          <div className="rounded-lg bg-danger-50 p-4 text-center">
            <p className="text-2xl font-bold text-danger-600">{licenseSummary.expired}</p>
            <p className="text-xs text-danger-600 mt-1">Expired / Revoked</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{licenseSummary.none}</p>
            <p className="text-xs text-gray-500 mt-1">No License</p>
          </div>
        </div>
      </div>

      {/* Members table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Members ({members.length})
        </h2>
        <MembersTable members={members} />
      </div>
    </div>
  );
}
