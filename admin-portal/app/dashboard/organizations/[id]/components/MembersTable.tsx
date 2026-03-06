'use client';

/**
 * MembersTable - Displays organization members with their details
 *
 * Each row is clickable and navigates to the user detail page.
 */

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';

export interface MemberRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  license_status: string | null;
  joined_at: string | null;
}

interface MembersTableProps {
  members: MemberRow[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800';
    case 'admin':
      return 'bg-primary-100 text-primary-800';
    case 'member':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function LicenseStatusBadge({ status }: { status: string | null }) {
  const statusText = status || 'none';
  const colorMap: Record<string, string> = {
    active: 'bg-success-50 text-success-600',
    assigned: 'bg-blue-100 text-blue-800',
    expired: 'bg-danger-50 text-danger-600',
    revoked: 'bg-danger-50 text-danger-600',
    pending: 'bg-yellow-100 text-yellow-800',
    none: 'bg-gray-100 text-gray-600',
  };
  const color = colorMap[statusText.toLowerCase()] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {statusText}
    </span>
  );
}

function UserInitials({ name }: { name: string | null }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
      {initials}
    </div>
  );
}

export function MembersTable({ members }: MembersTableProps) {
  const router = useRouter();

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">
          No members found for this organization.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              License
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {members.map((member) => (
            <tr
              key={member.user_id}
              onClick={() => router.push(`/dashboard/users/${member.user_id}`)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <UserInitials name={member.display_name} />
                  <span className="text-sm font-medium text-gray-900">
                    {member.display_name || 'Unnamed User'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {member.email || '--'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <LicenseStatusBadge status={member.license_status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(member.joined_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
