/**
 * Permission constants and types for the admin portal RBAC system.
 *
 * Mirrors the admin_permissions table in Supabase.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_SEARCH: 'users.search',
  USERS_DETAIL: 'users.detail',
  USERS_EDIT: 'users.edit',
  USERS_SUSPEND: 'users.suspend',
  USERS_IMPERSONATE: 'users.impersonate',
  LICENSES_VIEW: 'licenses.view',
  LICENSES_EDIT: 'licenses.edit',
  ORGANIZATIONS_VIEW: 'organizations.view',
  ORGANIZATIONS_EDIT: 'organizations.edit',
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  AUDIT_VIEW: 'audit.view',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  INTERNAL_USERS_VIEW: 'internal_users.view',
  INTERNAL_USERS_MANAGE: 'internal_users.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Maps sidebar routes to required permissions */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  '/dashboard': PERMISSIONS.DASHBOARD_VIEW,
  '/dashboard/analytics': PERMISSIONS.ANALYTICS_VIEW,
  '/dashboard/users': PERMISSIONS.USERS_VIEW,
  '/dashboard/organizations': PERMISSIONS.ORGANIZATIONS_VIEW,
  '/dashboard/settings': PERMISSIONS.INTERNAL_USERS_VIEW,
  '/dashboard/audit-log': PERMISSIONS.AUDIT_VIEW,
};

/** Permission categories for the role management UI */
export const PERMISSION_CATEGORIES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'licenses', label: 'Licenses' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'audit', label: 'Audit' },
  { key: 'settings', label: 'Settings' },
] as const;
