import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OrganizationsTable, type OrganizationRow } from './components/OrganizationsTable';

export const dynamic = 'force-dynamic';

/**
 * Organizations List Page - Admin Portal
 *
 * Server component that fetches all organizations with member counts.
 * Uses existing admin RLS policies for cross-org read access.
 */
export default async function OrganizationsPage() {
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
    .select('role_id')
    .eq('user_id', adminUser.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  // Fetch all organizations with member counts
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, created_at, organization_members(count)')
    .order('name');

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-danger-500/20 p-8 text-center">
          <p className="text-danger-600 text-sm">Failed to load organizations: {error.message}</p>
        </div>
      </div>
    );
  }

  // Transform data to extract member counts from the nested aggregate
  const organizations: OrganizationRow[] = (orgs ?? []).map((org) => {
    const memberAgg = org.organization_members as unknown as { count: number }[];
    const memberCount = memberAgg?.[0]?.count ?? 0;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      created_at: org.created_at,
      member_count: memberCount,
    };
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <p className="mt-1 text-sm text-gray-500">
          {organizations.length} organization{organizations.length !== 1 ? 's' : ''} total
        </p>
      </div>

      <OrganizationsTable organizations={organizations} />
    </div>
  );
}
