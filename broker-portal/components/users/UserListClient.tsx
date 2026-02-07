'use client';

/**
 * User List Client Component
 *
 * Main client component for displaying and filtering organization members.
 * Provides search, role filter, status filter, card/list view toggle,
 * and bulk actions.
 *
 * TASK-1809: User list component implementation
 * TASK-1810: Added invite user modal integration
 * TASK-1812: Added deactivate/remove user modals
 */

import { useState, useMemo } from 'react';
import UserCard from './UserCard';
import UserTableRow from './UserTableRow';
import UserSearchFilter from './UserSearchFilter';
import InviteUserModal from './InviteUserModal';
import EditRoleModal from './EditRoleModal';
import BulkEditRoleModal from './BulkEditRoleModal';
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

type ViewMode = 'cards' | 'list';

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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editRoleMember, setEditRoleMember] = useState<OrganizationMember | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [deactivateMember, setDeactivateMember] = useState<OrganizationMember | null>(null);
  const [removeMember, setRemoveMember] = useState<OrganizationMember | null>(null);

  const filteredMembers = useMemo(() => {
    return initialMembers.filter((member) => {
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

      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' || member.license_status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [initialMembers, searchQuery, roleFilter, statusFilter]);

  const hasFilters =
    searchQuery !== '' || roleFilter !== 'all' || statusFilter !== 'all';
  const canManage =
    currentUserRole === 'admin' || currentUserRole === 'it_admin';

  // Bulk selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const allSelected =
    filteredMembers.length > 0 && selectedIds.size === filteredMembers.length;

  // Only count non-self selected members for bulk actions
  const selectedNonSelf = filteredMembers.filter(
    (m) => selectedIds.has(m.id) && m.user_id !== currentUserId
  );

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-200 rounded-md p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            aria-label="List view"
            title="List view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => { setViewMode('cards'); setSelectedIds(new Set()); }}
            className={`p-2 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            aria-label="Card view"
            title="Card view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          {canManage && selectedNonSelf.length > 0 && (
            <button
              onClick={() => setIsBulkEditOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 text-sm transition-colors"
            >
              Change Role ({selectedNonSelf.length})
            </button>
          )}

          {/* Invite button */}
          {canManage && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Invite User
            </button>
          )}
        </div>
      </div>

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

          {viewMode === 'cards' ? (
            /* Card grid view */
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
          ) : (
            /* Table/list view */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {canManage && (
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    {canManage && <th className="w-12 px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <UserTableRow
                      key={member.id}
                      member={member}
                      isSelected={selectedIds.has(member.id)}
                      isCurrentUser={member.user_id === currentUserId}
                      canManage={canManage}
                      onToggleSelect={() => toggleSelect(member.id)}
                      onEditRole={() => setEditRoleMember(member)}
                      onDeactivate={() => setDeactivateMember(member)}
                      onRemove={() => setRemoveMember(member)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        organizationId={organizationId}
      />

      {/* Edit Role Modal (single user) */}
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

      {/* Bulk Edit Role Modal */}
      <BulkEditRoleModal
        isOpen={isBulkEditOpen}
        onClose={() => { setIsBulkEditOpen(false); setSelectedIds(new Set()); }}
        memberIds={selectedNonSelf.map((m) => m.id)}
        memberCount={selectedNonSelf.length}
        currentUserRole={currentUserRole}
      />

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
