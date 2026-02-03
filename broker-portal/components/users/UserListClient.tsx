'use client';

/**
 * User List Client Component
 *
 * Main client component for displaying and filtering organization members.
 * Provides search, role filter, and status filter with client-side filtering
 * for instant response.
 *
 * TASK-1809: User list component implementation
 * TASK-1810: Added invite user modal integration
 * TASK-1812: Added deactivate/remove user modals
 */

import { useState, useMemo } from 'react';
import UserCard from './UserCard';
import UserSearchFilter from './UserSearchFilter';
import InviteUserModal from './InviteUserModal';
import EditRoleModal from './EditRoleModal';
import DeactivateUserModal from './DeactivateUserModal';
import RemoveUserModal from './RemoveUserModal';
import { EmptyState, SearchIcon } from '@/components/ui/EmptyState';
import { formatUserDisplayName } from '@/lib/utils/userDisplay';
import type { OrganizationMember, Role } from '@/lib/types/users';

/**
 * Users Icon for empty state
 */
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'w-12 h-12'}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v1"
      />
    </svg>
  );
}

interface UserListClientProps {
  initialMembers: OrganizationMember[];
  currentUserId: string;
  currentUserRole: Role;
  organizationId: string;
}

export default function UserListClient({
  initialMembers,
  currentUserId,
  currentUserRole,
  organizationId,
}: UserListClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editRoleMember, setEditRoleMember] = useState<OrganizationMember | null>(null);
  const [deactivateMember, setDeactivateMember] = useState<OrganizationMember | null>(null);
  const [removeMember, setRemoveMember] = useState<OrganizationMember | null>(null);

  const filteredMembers = useMemo(() => {
    return initialMembers.filter((member) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const displayName =
        member.user?.display_name ||
        `${member.user?.first_name || ''} ${member.user?.last_name || ''}`.trim() ||
        '';
      const email = member.user?.email || member.invited_email || '';
      const invitedEmail = member.invited_email || '';

      const matchesSearch =
        !searchQuery ||
        displayName.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        invitedEmail.toLowerCase().includes(searchLower);

      // Role filter
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || member.license_status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [initialMembers, searchQuery, roleFilter, statusFilter]);

  const hasFilters =
    searchQuery !== '' || roleFilter !== 'all' || statusFilter !== 'all';
  const canManage =
    currentUserRole === 'admin' || currentUserRole === 'it_admin';

  return (
    <div className="space-y-4">
      {/* Action bar with invite button */}
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Invite User
          </button>
        </div>
      )}

      <UserSearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <EmptyState
            icon={hasFilters ? <SearchIcon /> : <UsersIcon />}
            title={hasFilters ? 'No users found' : 'No users yet'}
            description={
              hasFilters
                ? 'Try adjusting your search or filters'
                : 'No users in this organization yet. Invite team members to get started.'
            }
          />
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="text-sm text-gray-500">
            Showing {filteredMembers.length} of {initialMembers.length} user
            {initialMembers.length !== 1 ? 's' : ''}
          </div>

          {/* User cards grid - responsive layout */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <UserCard
                key={member.id}
                member={member}
                isCurrentUser={member.user_id === currentUserId}
                canManage={canManage}
                onEditRole={setEditRoleMember}
                onDeactivate={setDeactivateMember}
                onRemove={setRemoveMember}
              />
            ))}
          </div>
        </>
      )}

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        organizationId={organizationId}
      />

      {/* Edit Role Modal */}
      {editRoleMember && (
        <EditRoleModal
          isOpen={!!editRoleMember}
          onClose={() => setEditRoleMember(null)}
          memberId={editRoleMember.id}
          memberName={formatUserDisplayName(editRoleMember.user ?? null, editRoleMember.invited_email)}
          currentRole={editRoleMember.role}
          currentUserRole={currentUserRole}
        />
      )}

      {/* Deactivate User Modal */}
      {deactivateMember && (
        <DeactivateUserModal
          isOpen={!!deactivateMember}
          onClose={() => setDeactivateMember(null)}
          memberId={deactivateMember.id}
          memberName={formatUserDisplayName(deactivateMember.user ?? null, deactivateMember.invited_email)}
        />
      )}

      {/* Remove User Modal */}
      {removeMember && (
        <RemoveUserModal
          isOpen={!!removeMember}
          onClose={() => setRemoveMember(null)}
          memberId={removeMember.id}
          memberName={formatUserDisplayName(removeMember.user ?? null, removeMember.invited_email)}
          isPending={!removeMember.user_id}
        />
      )}
    </div>
  );
}
