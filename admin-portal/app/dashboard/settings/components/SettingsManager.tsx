'use client';

/**
 * SettingsManager - Tabbed settings page with Internal Users and Role Management.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ShieldCheck } from 'lucide-react';
import type { InternalUser, AdminRole, AdminPermission } from '../page';
import { InternalUsersTable } from './InternalUsersTable';
import { AddInternalUserForm } from './AddInternalUserForm';
import { RemoveUserDialog } from './RemoveUserDialog';
import { RoleManagement } from './RoleManagement';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'users' | 'roles';

interface SettingsManagerProps {
  initialUsers: InternalUser[];
  currentUserId: string | null;
  initialRoles: AdminRole[];
  permissions: AdminPermission[];
}

export function SettingsManager({ initialUsers, currentUserId, initialRoles, permissions }: SettingsManagerProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<InternalUser[]>(initialUsers);
  const [userToRemove, setUserToRemove] = useState<InternalUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const handleNavigateToUsersWithRole = useCallback((roleSlug: string) => {
    setRoleFilter(roleSlug);
    setActiveTab('users');
  }, []);

  // Sync local state when the server component passes fresh data after router.refresh()
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const canManageUsers = hasPermission(PERMISSIONS.INTERNAL_USERS_MANAGE);
  const canViewRoles = hasPermission(PERMISSIONS.ROLES_VIEW) || hasPermission(PERMISSIONS.ROLES_MANAGE);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const tabs = [
    { key: 'users' as Tab, label: 'Internal Users', icon: Users, count: users.length },
    ...(canViewRoles ? [{ key: 'roles' as Tab, label: 'Roles & Permissions', icon: ShieldCheck, count: initialRoles.length }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {canManageUsers && (
            <AddInternalUserForm onSuccess={handleRefresh} roles={initialRoles} />
          )}
          <InternalUsersTable
            users={users}
            currentUserId={currentUserId}
            onRemoveClick={(user) => setUserToRemove(user)}
            roles={initialRoles}
            onRoleChange={handleRefresh}
            externalRoleFilter={roleFilter}
            onClearExternalRoleFilter={() => setRoleFilter(null)}
          />
          {userToRemove && (
            <RemoveUserDialog
              user={userToRemove}
              onConfirm={() => { setUserToRemove(null); router.refresh(); }}
              onCancel={() => setUserToRemove(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'roles' && canViewRoles && (
        <RoleManagement
          roles={initialRoles}
          permissions={permissions}
          onRefresh={handleRefresh}
          users={initialUsers}
          onNavigateToUsersWithRole={handleNavigateToUsersWithRole}
        />
      )}
    </div>
  );
}
