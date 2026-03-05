import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Dashboard Home - Admin Portal
 *
 * Placeholder page showing welcome message and user's internal role.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'Admin';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome to Keepr Admin
        </h2>
        <p className="mt-2 text-gray-600">
          Hello, {displayName}. You are signed in as an internal administrator.
        </p>

        {/* Role Badge */}
        <div className="mt-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
            Role: {internalRole.role}
          </span>
        </div>

        {/* Placeholder content */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-500">Users</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-400">--</p>
            <p className="mt-1 text-xs text-gray-400">Coming in SPRINT-110</p>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-500">Organizations</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-400">--</p>
            <p className="mt-1 text-xs text-gray-400">Coming in SPRINT-110</p>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-500">Settings</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-400">--</p>
            <p className="mt-1 text-xs text-gray-400">Coming in SPRINT-111</p>
          </div>
        </div>
      </div>
    </div>
  );
}
