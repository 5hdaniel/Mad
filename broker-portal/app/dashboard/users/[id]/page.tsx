/**
 * User Details Page
 *
 * Shows detailed information about a specific organization member.
 * Only accessible to admin and it_admin roles.
 *
 * TASK-1808: Placeholder for user details (full implementation in TASK-1813)
 */

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

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

  // Only admin and it_admin can access user details
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

export default async function UserDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const access = await checkUserAccess();

  if (!access.allowed) {
    redirect('/dashboard');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Users
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
          <p className="mt-1 text-sm text-gray-500">
            User ID: {id}
          </p>
        </div>
      </div>

      {/* Placeholder - Full implementation in TASK-1813 */}
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          User Details Coming Soon
        </h3>
        <p className="text-sm text-gray-500">
          The user details view will be implemented in TASK-1813.
        </p>
      </div>
    </div>
  );
}
