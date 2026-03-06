'use client';

/**
 * InternalUsersTable - Displays all internal users with role badges
 *
 * Shows: Name/Email, Role (color-coded badge), Added Date, Added By, Actions
 * Remove button is hidden for the current user's own row.
 */

import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { InternalUser } from '../page';

interface InternalUsersTableProps {
  users: InternalUser[];
  currentUserId: string | null;
  onRemoveClick: (user: InternalUser) => void;
}

const roleBadgeStyles: Record<string, { bg: string; text: string; icon: typeof Shield }> = {
  super_admin: { bg: 'bg-red-50', text: 'text-red-700', icon: ShieldAlert },
  support_admin: { bg: 'bg-orange-50', text: 'text-orange-700', icon: ShieldCheck },
  support_agent: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Shield },
};

function RoleBadge({ role }: { role: string }) {
  const style = roleBadgeStyles[role] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: Shield };
  const Icon = style.icon;
  const label = role.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function UserAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const displayName = name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium">
      {initials}
    </div>
  );
}

export function InternalUsersTable({ users, currentUserId, onRemoveClick }: InternalUsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Shield className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">
          No internal users configured. Add a user above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Internal Users</h2>
        <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} with portal access</p>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Added
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Added By
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => {
            const isCurrentUser = user.user_id === currentUserId;

            return (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user.display_name} avatarUrl={user.avatar_url} />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.display_name || 'Unknown User'}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-gray-400">(you)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email || '--'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.created_by_email || '--'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {!isCurrentUser && (
                    <button
                      onClick={() => onRemoveClick(user)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
