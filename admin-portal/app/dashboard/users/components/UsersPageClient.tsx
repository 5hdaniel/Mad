'use client';

/**
 * User Search Page - Admin Portal (Client Component)
 *
 * Provides a search interface for finding users across all organizations.
 * Uses debounced client-side search via the admin_search_users RPC.
 */

import { useState, useCallback } from 'react';
import { UserSearchBar } from './UserSearchBar';
import { UserResultsTable } from './UserResultsTable';
import { searchUsers, type AdminSearchUser } from '@/lib/admin-queries';

export function UsersPageClient() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminSearchUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    setError(null);

    if (!searchQuery) {
      setUsers(null);
      setIsLoading(false);
      return;
    }

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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search and view users across all organizations.
        </p>
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
    </div>
  );
}
