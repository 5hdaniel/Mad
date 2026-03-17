'use client';

/**
 * PM Dashboard - Landing Page
 *
 * Overview page showing aggregate stats, quick navigation links,
 * and recent activity for the Project Management module.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  KanbanSquare,
  Calendar,
  UserCheck,
  FolderKanban,
  Activity,
} from 'lucide-react';
import { getMyNotifications } from '@/lib/pm-queries';
import type { PmNotification } from '@/lib/pm-types';
import { TaskStatsCards } from './components/TaskStatsCards';

// ---------------------------------------------------------------------------
// Quick Links configuration
// ---------------------------------------------------------------------------

const quickLinks = [
  {
    label: 'Backlog',
    description: 'Browse and manage all work items',
    href: '/dashboard/pm/backlog',
    icon: ListChecks,
    ready: true,
  },
  {
    label: 'Board',
    description: 'Kanban board view',
    href: '/dashboard/pm/board',
    icon: KanbanSquare,
    ready: false,
  },
  {
    label: 'Sprints',
    description: 'Sprint planning and tracking',
    href: '/dashboard/pm/sprints',
    icon: Calendar,
    ready: false,
  },
  {
    label: 'My Tasks',
    description: 'Items assigned to you',
    href: '/dashboard/pm/my-tasks',
    icon: UserCheck,
    ready: false,
  },
  {
    label: 'Projects',
    description: 'Manage project groupings',
    href: '/dashboard/pm/projects',
    icon: FolderKanban,
    ready: false,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PmDashboardPage() {
  const [recentActivity, setRecentActivity] = useState<PmNotification[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      try {
        const since = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const data = await getMyNotifications(since);
        setRecentActivity(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch (err) {
        console.error('Failed to load activity:', err);
      } finally {
        setLoadingActivity(false);
      }
    }
    loadActivity();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Project Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of backlog items, sprints, and projects
        </p>
      </div>

      {/* Stats Cards */}
      <TaskStatsCards />

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 mb-8">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const inner = (
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">
                  {link.label}
                  {!link.ready && (
                    <span className="ml-2 text-xs text-gray-400">
                      (Coming Soon)
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">{link.description}</div>
              </div>
            </div>
          );

          if (!link.ready) {
            return (
              <div
                key={link.href}
                className="block p-4 rounded-lg border border-gray-100 opacity-60 cursor-not-allowed transition-all"
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-400" />
          Recent Activity
        </h2>
        {loadingActivity ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((event) => (
              <div
                key={event.event_id}
                className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-50"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <div className="flex-1 text-sm text-gray-700">
                  {event.event_type.replace(/_/g, ' ')}
                  {event.item_title && (
                    <span className="font-medium"> &mdash; {event.item_title}</span>
                  )}
                  {event.new_value && (
                    <span className="font-medium"> {event.new_value}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(event.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
