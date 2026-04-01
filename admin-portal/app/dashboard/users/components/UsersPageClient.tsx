'use client';

/**
 * User Search Page - Admin Portal (Client Component)
 *
 * Provides a search interface for finding users across all organizations.
 * Uses debounced client-side search via the admin_search_users RPC.
 *
 * BACKLOG-1492: Added Invite User button gated on users.edit permission.
 */

import { useState, useCallback, useEffect } from 'react';
import { UserSearchBar } from './UserSearchBar';
import { UserResultsTable } from './UserResultsTable';
import { InviteUserDialog } from './InviteUserDialog';
import { searchUsers, type AdminSearchUser } from '@/lib/admin-queries';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';

export function UsersPageClient() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminSearchUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { hasPermission } = usePermissions();

  const canInvite = hasPermission(PERMISSIONS.USERS_EDIT);

  // Load all users on mount
  const loadUsers = useCallback(async (searchQuery = '') => {
    setError(null);
    setIsLoading(true);
    const { data, error: searchError } = await searchUsers(searchQuery);
    if (searchError) {
      setError(searchError.message);
      setUsers(null);
    } else {
      setUsers(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    await loadUsers(searchQuery);
  }, [loadUsers]);

  const handleInvited = useCallback(() => {
    // Refresh the user list after a successful invite
    loadUsers(query);
  }, [loadUsers, query]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Search and view users across all organizations.
          </p>
        </div>
        {canInvite && (
          <button
            type="button"
            onClick={() => setShowInviteDialog(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Invite User
          </button>
        )}
      </div>

      <div className="space-y-6">
        <UserSearchBar onSearch={handleSearch} isLoading={isLoading} />
        <UserResultsTable
          users={users}
          query={query}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {showInviteDialog && (
        <InviteUserDialog
          onClose={() => setShowInviteDialog(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}
