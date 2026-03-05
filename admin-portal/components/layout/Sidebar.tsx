'use client';

/**
 * Sidebar Navigation - Admin Portal
 *
 * Left sidebar with navigation items.
 * Disabled items are greyed out for future sprints.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Building2, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
  { label: 'Users', href: '/dashboard/users', icon: Users, enabled: false },
  { label: 'Organizations', href: '/dashboard/organizations', icon: Building2, enabled: false },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <aside className="flex flex-col w-64 bg-gray-900 text-white min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold">Keepr.</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-500 cursor-not-allowed"
                title="Coming soon"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-xs text-gray-600">Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
