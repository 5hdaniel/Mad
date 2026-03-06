'use client';

/**
 * SettingsManager - Tabbed settings page with Internal Users and Role Management.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, ShieldCheck, FileText } from 'lucide-react';
import type { InternalUser, AdminRole, AdminPermission } from '../page';
import { InternalUsersTable } from './InternalUsersTable';
import { AddInternalUserForm } from './AddInternalUserForm';
import { RemoveUserDialog } from './RemoveUserDialog';
import { RoleManagement } from './RoleManagement';
import { AuditLogContent } from '@/app/dashboard/audit-log/AuditLogContent';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'users' | 'roles' | 'audit';

interface SettingsManagerProps {
  initialUsers: InternalUser[];
  currentUserId: string | null;
  initialRoles: AdminRole[];
  permissions: AdminPermission[];
}

export function SettingsManager({ initialUsers, currentUserId, initialRoles, permissions }: SettingsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const canViewAudit = hasPermission(PERMISSIONS.AUDIT_VIEW);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Handle tab from URL query param (e.g., ?tab=roles from sidebar)
  // useSearchParams is reactive to Next.js client-side navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'roles' && canViewRoles) setActiveTab('roles');
    else if (tab === 'audit' && canViewAudit) setActiveTab('audit');
    else if (tab === 'users') setActiveTab('users');
  }, [searchParams, canViewRoles, canViewAudit]);

  const tabs = [
    { key: 'users' as Tab, label: 'Internal Users', icon: Users },
    ...(canViewRoles ? [{ key: 'roles' as Tab, label: 'Roles & Permissions', icon: ShieldCheck }] : []),
    ...(canViewAudit ? [{ key: 'audit' as Tab, label: 'Audit Log', icon: FileText }] : []),
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

      {activeTab === 'audit' && canViewAudit && (
        <AuditLogContent embedded />
      )}
    </div>
  );
}
