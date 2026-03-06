'use client';

/**
 * InternalUsersTable - Displays all internal users with role badges
 *
 * Features: sortable columns, role filter badges, checkboxes, bulk remove,
 * inline role change dropdown.
 */

import { useState, useMemo, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { InternalUser, AdminRole } from '../page';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

interface InternalUsersTableProps {
  users: InternalUser[];
  currentUserId: string | null;
  onRemoveClick: (user: InternalUser) => void;
  roles: AdminRole[];
  onRoleChange: () => void;
  externalRoleFilter?: string | null;
  onClearExternalRoleFilter?: () => void;
}

type SortField = 'name' | 'role' | 'added' | 'added_by';
type SortDir = 'asc' | 'desc';

const roleBadgeStyles: Record<string, { bg: string; text: string; icon: typeof Shield; ring: string }> = {
  'super-admin': { bg: 'bg-red-50', text: 'text-red-700', icon: ShieldAlert, ring: 'ring-red-400' },
  'support-supervisor': { bg: 'bg-orange-50', text: 'text-orange-700', icon: ShieldCheck, ring: 'ring-orange-400' },
  'support-agent': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Shield, ring: 'ring-blue-400' },
  'sales': { bg: 'bg-green-50', text: 'text-green-700', icon: Shield, ring: 'ring-green-400' },
  'executive': { bg: 'bg-purple-50', text: 'text-purple-700', icon: Shield, ring: 'ring-purple-400' },
  'marketing': { bg: 'bg-pink-50', text: 'text-pink-700', icon: Shield, ring: 'ring-pink-400' },
  'r-and-d': { bg: 'bg-cyan-50', text: 'text-cyan-700', icon: Shield, ring: 'ring-cyan-400' },
};

function RoleBadge({ slug, name }: { slug: string; name: string }) {
  const style = roleBadgeStyles[slug] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: Shield, ring: 'ring-gray-400' };
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className="h-3 w-3" />
      {name}
    </span>
  );
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
      <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
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

export function InternalUsersTable({ users, currentUserId, onRemoveClick, roles, onRoleChange, externalRoleFilter, onClearExternalRoleFilter }: InternalUsersTableProps) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.INTERNAL_USERS_MANAGE);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role_slug] = (counts[u.role_slug] || 0) + 1;
    }
    return counts;
  }, [users]);

  const uniqueRoleSlugs = useMemo(() => Object.keys(roleCounts).sort(), [roleCounts]);

  const effectiveRoleFilter = externalRoleFilter ?? roleFilter;

  const filteredUsers = useMemo(() => {
    let list = users;
    if (effectiveRoleFilter) {
      list = list.filter((u) => u.role_slug === effectiveRoleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.display_name?.toLowerCase().includes(q) ?? false) ||
          (u.email?.toLowerCase().includes(q) ?? false),
      );
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
            aVal = a.role_name;
            bVal = b.role_name;
            break;
          case 'added':
            aVal = a.created_at;
            bVal = b.created_at;
            break;
          case 'added_by':
            aVal = (a.created_by_email || '').toLowerCase();
            bVal = (b.created_by_email || '').toLowerCase();
            break;
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [users, effectiveRoleFilter, searchQuery, sortField, sortDir]);

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

  const toggleFilter = useCallback((slug: string) => {
    setRoleFilter((prev) => (prev === slug ? null : slug));
    setSelected(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
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

  const handleRoleChange = useCallback(async (userId: string, newRoleSlug: string) => {
    setChangingRole(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('admin_update_internal_user_role', {
        p_user_id: userId,
        p_role_slug: newRoleSlug,
      });
      if (error) {
        console.error('Failed to change role:', error.message);
      } else {
        onRoleChange();
      }
    } finally {
      setChangingRole(null);
    }
  }, [onRoleChange]);

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

  const trimmedSearch = searchQuery.trim();

  return (
    <>
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSelected(new Set()); }}
          placeholder="Search by name or email..."
          className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        />
      </div>

      {/* Role filter badges */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by role:</span>
        {uniqueRoleSlugs.map((slug) => {
          const style = roleBadgeStyles[slug] || { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-400' };
          const isActive = effectiveRoleFilter === slug;
          const roleName = users.find((u) => u.role_slug === slug)?.role_name || slug;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => {
                if (externalRoleFilter !== undefined && externalRoleFilter !== null) {
                  // Clear external filter first, then apply local filter
                  onClearExternalRoleFilter?.();
                }
                toggleFilter(slug);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${style.bg} ${style.text} ${
                isActive ? `ring-2 ${style.ring}` : 'ring-1 ring-transparent hover:shadow-sm'
              }`}
            >
              {roleName}
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px]">{roleCounts[slug]}</span>
            </button>
          );
        })}
        {effectiveRoleFilter && (
          <button
            type="button"
            onClick={() => {
              setRoleFilter(null);
              onClearExternalRoleFilter?.();
            }}
            className="text-xs text-primary-600 hover:text-primary-800 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && canManage && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-50 border border-primary-200 px-4 py-2.5">
          <span className="text-sm font-medium text-primary-800">{selected.size} selected</span>
          <div className="h-4 w-px bg-primary-200" />
          <button
            type="button"
            onClick={() => {
              const usersToRemove = filteredUsers.filter((u) => selected.has(u.id));
              if (usersToRemove.length > 0) onRemoveClick(usersToRemove[0]);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
          >
            Remove ({selected.size})
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-primary-600 hover:text-primary-800">
            Clear
          </button>
        </div>
      )}

      {(effectiveRoleFilter || trimmedSearch) && (
        <div className="mb-3 text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
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
              {canManage && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all users"
                  />
                </th>
              )}
              <th onClick={() => toggleSort('name')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                <span className="inline-flex items-center">User<SortIcon field="name" currentField={sortField} dir={sortDir} /></span>
              </th>
              <th onClick={() => toggleSort('role')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                <span className="inline-flex items-center">Role<SortIcon field="role" currentField={sortField} dir={sortDir} /></span>
              </th>
              <th onClick={() => toggleSort('added')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                <span className="inline-flex items-center">Added<SortIcon field="added" currentField={sortField} dir={sortDir} /></span>
              </th>
              <th onClick={() => toggleSort('added_by')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                <span className="inline-flex items-center">Added By<SortIcon field="added_by" currentField={sortField} dir={sortDir} /></span>
              </th>
              {canManage && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 4} className="px-6 py-12 text-center text-sm text-gray-500">
                  {trimmedSearch
                    ? `No users matching "${trimmedSearch}"`
                    : 'No users match the selected filter.'}
                </td>
              </tr>
            )}
            {filteredUsers.map((user) => {
              const isCurrentUser = user.user_id === currentUserId;
              return (
                <tr key={user.id} className={`hover:bg-gray-50 ${selected.has(user.id) ? 'bg-primary-50/50' : ''}`}>
                  {canManage && (
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
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.display_name} avatarUrl={user.avatar_url} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.display_name || 'Unknown User'}
                          {isCurrentUser && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                        </div>
                        <div className="text-sm text-gray-500">{user.email || '--'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canManage && !isCurrentUser ? (
                      <select
                        value={user.role_slug}
                        onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                        disabled={changingRole === user.user_id}
                        className="text-xs rounded-md border border-gray-300 px-2 py-1 text-gray-900 bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      >
                        {roles.map((r) => (
                          <option key={r.slug} value={r.slug}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge slug={user.role_slug} name={user.role_name} />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.created_by_email || '--'}</td>
                  {canManage && (
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
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
