/**
 * Users Management Page
 *
 * Main page for viewing and managing organization members.
 * Only accessible to admin and it_admin roles.
 *
 * TASK-1808: Initial route structure
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface AccessCheck {
  allowed: boolean;
  reason?: 'unauthenticated' | 'unauthorized';
  organizationId?: string;
  role?: string;
}

async function checkUserAccess(): Promise<AccessCheck> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { allowed: false, reason: 'unauthenticated' };

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Only admin and it_admin can access users management
  const allowedRoles = ['admin', 'it_admin'];
  if (!membership || !allowedRoles.includes(membership.role)) {
    return { allowed: false, reason: 'unauthorized' };
  }

  return {
    allowed: true,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}

export default async function UsersPage() {
  const access = await checkUserAccess();

  if (!access.allowed) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your organization&apos;s team members
          </p>
        </div>
        {/* Invite button will be added in TASK-1810 */}
      </div>

      {/* Placeholder - UserListClient will be added in TASK-1809 */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v1"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Users List Coming Soon
        </h3>
        <p className="text-sm text-gray-500">
          The user list component will be implemented in TASK-1809.
        </p>
      </div>
    </div>
  );
}
