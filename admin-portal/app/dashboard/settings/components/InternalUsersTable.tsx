'use client';

/**
 * InternalUsersTable - Displays all internal users with role badges
 *
 * Features: sortable columns, role filter badges, checkboxes, bulk remove.
 */

import { useState, useMemo, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { InternalUser } from '../page';

interface InternalUsersTableProps {
  users: InternalUser[];
  currentUserId: string | null;
  onRemoveClick: (user: InternalUser) => void;
}

type SortField = 'name' | 'role' | 'added';
type SortDir = 'asc' | 'desc';

const roleBadgeStyles: Record<string, { bg: string; text: string; icon: typeof Shield; ring: string }> = {
  super_admin: { bg: 'bg-red-50', text: 'text-red-700', icon: ShieldAlert, ring: 'ring-red-400' },
  support_admin: { bg: 'bg-orange-50', text: 'text-orange-700', icon: ShieldCheck, ring: 'ring-orange-400' },
  support_agent: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Shield, ring: 'ring-blue-400' },
  sales: { bg: 'bg-green-50', text: 'text-green-700', icon: Shield, ring: 'ring-green-400' },
};

function RoleBadge({ role }: { role: string }) {
  const style = roleBadgeStyles[role] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: Shield, ring: 'ring-gray-400' };
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
  return new Date(dateStr).toLocaleDateString('en-US', {
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

function SortIcon({ field, currentField, dir }: { field: SortField; currentField: SortField | null; dir: SortDir }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function InternalUsersTable({ users, currentUserId, onRemoveClick }: InternalUsersTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Role counts for filter badges
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1;
    }
    return counts;
  }, [users]);

  const uniqueRoles = useMemo(() => Object.keys(roleCounts).sort(), [roleCounts]);

  // Filter + sort
  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        switch (sortField) {
          case 'name':
            aVal = (a.display_name || a.email || '').toLowerCase();
            bVal = (b.display_name || b.email || '').toLowerCase();
            break;
          case 'role':
            aVal = a.role;
            bVal = b.role;
            break;
          case 'added':
            aVal = a.created_at;
            bVal = b.created_at;
            break;
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [users, roleFilter, sortField, sortDir]);

  const selectableUsers = filteredUsers.filter((u) => u.user_id !== currentUserId);
  const allSelected = selectableUsers.length > 0 && selected.size === selectableUsers.length;
  const someSelected = selected.size > 0;

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const toggleFilter = useCallback((role: string) => {
    setRoleFilter((prev) => (prev === role ? null : role));
    setSelected(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      // Select all except current user
      setSelected(new Set(filteredUsers.filter((u) => u.user_id !== currentUserId).map((u) => u.id)));
    }
  }, [allSelected, filteredUsers, currentUserId]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    <>
      {/* Role filter badges */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by role:</span>
        {uniqueRoles.map((role) => {
          const style = roleBadgeStyles[role] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: Shield, ring: 'ring-gray-400' };
          const isActive = roleFilter === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleFilter(role)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${style.bg} ${style.text} ${
                isActive ? `ring-2 ${style.ring}` : 'ring-1 ring-transparent hover:shadow-sm'
              }`}
            >
              {role.replace(/_/g, ' ')}
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px]">{roleCounts[role]}</span>
            </button>
          );
        })}
        {roleFilter && (
          <button
            type="button"
            onClick={() => setRoleFilter(null)}
            className="text-xs text-primary-600 hover:text-primary-800 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-50 border border-primary-200 px-4 py-2.5">
          <span className="text-sm font-medium text-primary-800">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-primary-200" />
          <button
            type="button"
            onClick={() => {
              const usersToRemove = filteredUsers.filter((u) => selected.has(u.id));
              // Remove one at a time via the existing dialog
              if (usersToRemove.length > 0) {
                onRemoveClick(usersToRemove[0]);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
          >
            Remove ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-primary-600 hover:text-primary-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filter indicator */}
      {roleFilter && (
        <div className="mb-3 text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Internal Users</h2>
          <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} with portal access</p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  aria-label="Select all users"
                />
              </th>
              <th
                onClick={() => toggleSort('name')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
              >
                <span className="inline-flex items-center">
                  User
                  <SortIcon field="name" currentField={sortField} dir={sortDir} />
                </span>
              </th>
              <th
                onClick={() => toggleSort('role')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
              >
                <span className="inline-flex items-center">
                  Role
                  <SortIcon field="role" currentField={sortField} dir={sortDir} />
                </span>
              </th>
              <th
                onClick={() => toggleSort('added')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
              >
                <span className="inline-flex items-center">
                  Added
                  <SortIcon field="added" currentField={sortField} dir={sortDir} />
                </span>
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
            {filteredUsers.map((user) => {
              const isCurrentUser = user.user_id === currentUserId;

              return (
                <tr key={user.id} className={`hover:bg-gray-50 ${selected.has(user.id) ? 'bg-primary-50/50' : ''}`}>
                  <td className="px-3 py-4">
                    {!isCurrentUser ? (
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggleOne(user.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select ${user.display_name || user.email}`}
                      />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                  </td>
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
    </>
  );
}
