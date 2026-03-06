'use client';

/**
 * Sidebar Navigation - Admin Portal
 *
 * Left sidebar with navigation items.
 * Items are permission-gated based on the user's RBAC role.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Users, Building2, Settings, LogOut, PanelLeftClose, PanelLeftOpen, FileText } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import type { PermissionKey } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW },
  { label: 'Users', href: '/dashboard/users', icon: Users, permission: PERMISSIONS.USERS_VIEW },
  { label: 'Organizations', href: '/dashboard/organizations', icon: Building2, permission: PERMISSIONS.ORGANIZATIONS_VIEW },
  { label: 'Audit Log', href: '/dashboard/audit-log', icon: FileText, permission: PERMISSIONS.AUDIT_VIEW },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, permission: PERMISSIONS.INTERNAL_USERS_VIEW },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { hasPermission, roleName, loading } = usePermissions();

  return (
    <aside className={`sticky top-0 h-screen flex flex-col bg-gray-900 text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo + Toggle */}
      <div className={`flex items-center border-b border-gray-800 ${collapsed ? 'justify-center px-2 py-5' : 'justify-between px-6 py-5'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Keepr.</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          // While permissions are loading, show all items to prevent flash
          if (!loading && !hasPermission(item.permission)) return null;

          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-md text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
              } ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Role badge + Sign Out */}
      <div className={`border-t border-gray-800 ${collapsed ? 'px-2 py-4' : 'px-3 py-4'}`}>
        {!collapsed && roleName && (
          <div className="px-3 py-1.5 mb-2">
            <span className="text-xs text-gray-500">{roleName}</span>
          </div>
        )}
        <button
          onClick={signOut}
          className={`flex items-center w-full rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${
            collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
          }`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
