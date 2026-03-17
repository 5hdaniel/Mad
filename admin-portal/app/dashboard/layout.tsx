'use client';

/**
 * Dashboard Layout - Admin Portal
 *
 * Wraps all /dashboard/* routes with sidebar navigation and header.
 */

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Suspense>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 bg-gray-50 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
