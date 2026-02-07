'use client';

/**
 * User Card Component
 *
 * Displays a single organization member with their details.
 * Shows avatar, name, email, role badge, status badge, and dates.
 *
 * TASK-1809: User list component implementation
 * TASK-1812: Added user actions dropdown for deactivate/remove
 * TASK-1813: Added link to user details page
 */

import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import UserActionsDropdown from './UserActionsDropdown';
import type { OrganizationMember, Role, LicenseStatus } from '@/lib/types/users';
import { ROLE_LABELS, LICENSE_STATUS_LABELS } from '@/lib/types/users';
import { formatUserDisplayName, getUserInitials } from '@/lib/utils/userDisplay';
import { formatDate } from '@/lib/utils';

interface UserCardProps {
  member: OrganizationMember;
  isCurrentUser: boolean;
  canManage: boolean;
  onEditRole?: (member: OrganizationMember) => void;
  onDeactivate?: (member: OrganizationMember) => void;
  onRemove?: (member: OrganizationMember) => void;
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800',
  it_admin: 'bg-blue-100 text-blue-800',
  broker: 'bg-green-100 text-green-800',
  agent: 'bg-gray-100 text-gray-800',
};

const STATUS_COLORS: Record<LicenseStatus, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

export default function UserCard({
  member,
  isCurrentUser,
  canManage,
  onEditRole,
  onDeactivate,
  onRemove,
}: UserCardProps) {
  // Convert undefined to null for utility functions
  const userOrNull = member.user ?? null;
  const displayName = formatUserDisplayName(userOrNull, member.invited_email);
  const initials = getUserInitials(userOrNull, member.invited_email);
  const email = member.user?.email || member.invited_email || '';
  const isPending = !member.user_id;

  return (
    <Card hover padding="sm" className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {member.user?.avatar_url ? (
              <Image
                src={member.user.avatar_url}
                alt={displayName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="text-gray-500 text-sm font-medium">
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <Link
                href={`/dashboard/users/${member.id}`}
                className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate transition-colors"
              >
                {displayName}
              </Link>
              {isCurrentUser && (
                <span className="text-xs text-gray-500 flex-shrink-0">(You)</span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{email}</p>
          </div>
        </div>

        {/* Actions dropdown - only for admin/it_admin, not for self */}
        {canManage && !isCurrentUser && (
          <UserActionsDropdown
            memberId={member.id}
            memberName={displayName}
            isPending={isPending}
            isCurrentUser={isCurrentUser}
            invitationToken={member.invitation_token}
            onEditRole={() => onEditRole?.(member)}
            onDeactivate={() => onDeactivate?.(member)}
            onRemove={() => onRemove?.(member)}
          />
        )}
      </div>

      {/* Badges */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Role badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}
        >
          {ROLE_LABELS[member.role]}
        </span>

        {/* Status badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[member.license_status]}`}
        >
          {isPending ? 'Invited' : LICENSE_STATUS_LABELS[member.license_status]}
        </span>
      </div>

      {/* Dates */}
      <div className="mt-3 text-xs text-gray-500">
        {member.joined_at ? (
          <p>Joined {formatDate(member.joined_at)}</p>
        ) : member.invited_at ? (
          <p>Invited {formatDate(member.invited_at)}</p>
        ) : (
          <p>Created {formatDate(member.created_at)}</p>
        )}
      </div>

      {/* Actions - edit role (only for members with user_id, not pending invites) */}
      {canManage && !isCurrentUser && member.user_id && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => onEditRole?.(member)}
            className="text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none focus:underline transition-colors"
          >
            Change Role
          </button>
        </div>
      )}
    </Card>
  );
}
