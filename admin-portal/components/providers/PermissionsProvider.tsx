'use client';

/**
 * PermissionsProvider - Fetches and caches the current user's permissions.
 *
 * Uses get_user_permissions RPC to load all permission keys once,
 * then provides a `hasPermission` helper and the raw set.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './AuthProvider';
import type { PermissionKey } from '@/lib/permissions';

interface PermissionsContextType {
  permissions: Set<string>;
  roleName: string | null;
  roleSlug: string | null;
  loading: boolean;
  hasPermission: (key: PermissionKey) => boolean;
  hasAnyPermission: (...keys: PermissionKey[]) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: new Set(),
  roleName: null,
  roleSlug: null,
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState<string | null>(null);
  const [roleSlug, setRoleSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!user) {
      setPermissions(new Set());
      setRoleName(null);
      setRoleSlug(null);
      setLoading(false);
      return;
    }

    async function loadPermissions() {
      // Fetch permissions and role info in parallel
      const [permsResult, roleResult] = await Promise.all([
        supabase.rpc('get_user_permissions', { check_user_id: user!.id }),
        supabase
          .from('internal_roles')
          .select('role_id, role:admin_roles(name, slug)')
          .eq('user_id', user!.id)
          .single(),
      ]);

      if (permsResult.data) {
        const keys = (permsResult.data as Array<{ key: string }>).map((r) => r.key);
        setPermissions(new Set(keys));
      }

      if (roleResult.data) {
        const role = roleResult.data.role as unknown as { name: string; slug: string } | null;
        setRoleName(role?.name ?? null);
        setRoleSlug(role?.slug ?? null);
      }

      setLoading(false);
    }

    loadPermissions();
  }, [user, supabase]);

  const value = useMemo(() => ({
    permissions,
    roleName,
    roleSlug,
    loading,
    hasPermission: (key: PermissionKey) => permissions.has(key),
    hasAnyPermission: (...keys: PermissionKey[]) => keys.some((k) => permissions.has(k)),
  }), [permissions, roleName, roleSlug, loading]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
