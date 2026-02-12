'use client';

/**
 * User Details Card Component
 *
 * Displays comprehensive information about an organization member
 * including their profile, membership info, activity, and management actions.
 *
 * TASK-1813: User details view
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import EditRoleModal from './EditRoleModal';
import DeactivateUserModal from './DeactivateUserModal';
import RemoveUserModal from './RemoveUserModal';
import type { Role, LicenseStatus, ProvisioningSource } from '@/lib/types/users';
import { ROLE_LABELS, LICENSE_STATUS_LABELS, PROVISIONING_SOURCE_LABELS } from '@/lib/types/users';
import { formatUserDisplayName, getUserInitials } from '@/lib/utils/userDisplay';
import { formatDate } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * User data from the users table (joined)
 */
interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  last_sso_login_at: string | null;
  last_sso_provider: string | null;
  is_managed: boolean;
}

/**
 * Inviter data (nested join)
 */
interface InviterData {
  user?: {
    email: string;
    display_name: string | null;
  };
}

/**
 * Full member data with joins
 */
export interface MemberDetailsData {
  id: string;
  user_id: string | null;
  role: Role;
  license_status: LicenseStatus;
  invited_email: string | null;
  invited_at: string | null;
  joined_at: string | null;
  provisioned_by: ProvisioningSource | null;
  provisioned_at: string | null;
  scim_synced_at: string | null;
  provisioning_metadata: Record<string, unknown> | null;
  idp_groups: string[] | null;
  invited_by: string | null;
  last_invited_at: string | null;
  created_at: string;
  updated_at: string;
  user?: UserData;
  inviter?: InviterData;
}

interface UserDetailsCardProps {
  member: MemberDetailsData;
  currentUserId: string;
  currentUserRole: Role;
}

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date and time for activity display
 */
function formatDateTime(date: string | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

// ============================================================================
// Component
// ============================================================================

export default function UserDetailsCard({
  member,
  currentUserId,
  currentUserRole,
}: UserDetailsCardProps) {
  const router = useRouter();
  const [showEditRole, setShowEditRole] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const isCurrentUser = member.user_id === currentUserId;
  const isPending = !member.user_id;
  const canManage = ['admin', 'it_admin'].includes(currentUserRole) && !isCurrentUser;
  const isSuspended = member.license_status === 'suspended';

  // Format display values
  const userOrNull = member.user ?? null;
  const displayName = formatUserDisplayName(userOrNull, member.invited_email);
  const initials = getUserInitials(userOrNull, member.invited_email);
  const email = member.user?.email || member.invited_email || '';

  // Handle modal close with refresh
  const handleModalClose = (shouldRefresh: boolean = false) => {
    setShowEditRole(false);
    setShowDeactivate(false);
    setShowRemove(false);
    if (shouldRefresh) {
      router.refresh();
    }
  };

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {member.user?.avatar_url ? (
                <Image
                  src={member.user.avatar_url}
                  alt={displayName}
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-gray-500 text-xl font-medium">
                  {initials}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {displayName}
                {isCurrentUser && (
                  <span className="text-gray-500 font-normal ml-2">(You)</span>
                )}
              </h1>
              <p className="text-gray-500">{email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}
                >
                  {ROLE_LABELS[member.role]}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[member.license_status]}`}
                >
                  {isPending ? 'Invited' : LICENSE_STATUS_LABELS[member.license_status]}
                </span>
                {member.user?.is_managed && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    IdP Managed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowEditRole(true)}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Change Role
              </button>
              {!isPending && !isSuspended && (
                <button
                  onClick={() => setShowDeactivate(true)}
                  className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
                >
                  Deactivate
                </button>
              )}
              <button
                onClick={() => setShowRemove(true)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                {isPending ? 'Revoke Invite' : 'Remove'}
              </button>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Membership Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Membership</h2>
            <dl className="space-y-2">
              {member.joined_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Joined</dt>
                  <dd className="text-sm text-gray-900">{formatDate(member.joined_at)}</dd>
                </div>
              )}
              {member.invited_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Invited</dt>
                  <dd className="text-sm text-gray-900">{formatDate(member.invited_at)}</dd>
                </div>
              )}
              {member.inviter?.user && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Invited by</dt>
                  <dd className="text-sm text-gray-900">
                    {member.inviter.user.display_name || member.inviter.user.email}
                  </dd>
                </div>
              )}
              {member.provisioned_by && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Added via</dt>
                  <dd className="text-sm text-gray-900">
                    {PROVISIONING_SOURCE_LABELS[member.provisioned_by]}
                  </dd>
                </div>
              )}
              {member.provisioned_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Provisioned</dt>
                  <dd className="text-sm text-gray-900">{formatDate(member.provisioned_at)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Member since</dt>
                <dd className="text-sm text-gray-900">{formatDate(member.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Activity Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Activity</h2>
            <dl className="space-y-2">
              {member.user?.last_login_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last login</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDateTime(member.user.last_login_at)}
                  </dd>
                </div>
              )}
              {member.user?.last_sso_login_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last SSO login</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDateTime(member.user.last_sso_login_at)}
                  </dd>
                </div>
              )}
              {member.user?.last_sso_provider && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">SSO provider</dt>
                  <dd className="text-sm text-gray-900 capitalize">
                    {member.user.last_sso_provider}
                  </dd>
                </div>
              )}
              {member.scim_synced_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last SCIM sync</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDateTime(member.scim_synced_at)}
                  </dd>
                </div>
              )}
              {isPending && !member.user?.last_login_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="text-sm text-yellow-600">Awaiting acceptance</dd>
                </div>
              )}
              {!isPending && !member.user?.last_login_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last login</dt>
                  <dd className="text-sm text-gray-500">Never</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* IdP Groups (if any) */}
        {member.idp_groups && member.idp_groups.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">IdP Groups</h2>
            <div className="flex flex-wrap gap-2">
              {member.idp_groups.map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <EditRoleModal
        isOpen={showEditRole}
        onClose={() => handleModalClose()}
        memberId={member.id}
        memberName={displayName}
        currentRole={member.role}
        currentUserRole={currentUserRole}
      />
      <DeactivateUserModal
        isOpen={showDeactivate}
        onClose={() => handleModalClose()}
        memberId={member.id}
        memberName={displayName}
      />
      <RemoveUserModal
        isOpen={showRemove}
        onClose={() => handleModalClose()}
        memberId={member.id}
        memberName={displayName}
        isPending={isPending}
      />
    </>
  );
}
