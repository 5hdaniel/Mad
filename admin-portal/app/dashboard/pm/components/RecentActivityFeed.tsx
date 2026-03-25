'use client';

/**
 * RecentActivityFeed - PM Dashboard
 *
 * Shows a timeline of recent project activity with toggles to filter
 * by event type (status changes, comments, assignments) and scope
 * (all activity vs. only items assigned to current user).
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Activity, Filter } from 'lucide-react';
import { getRecentActivity, getMyNotifications } from '@/lib/pm-queries';
import type { PmNotification } from '@/lib/pm-types';
import { getPmEventIcon, getPmEventDescription } from '@/lib/pm-timeline-utils';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type EventFilter = 'all' | 'status' | 'comments' | 'assignments';
type ScopeFilter = 'all' | 'mine';

const EVENT_FILTER_CONFIG: { key: EventFilter; label: string; types: string[] | null }[] = [
  { key: 'all', label: 'All', types: null },
  { key: 'status', label: 'Status', types: ['status_changed'] },
  { key: 'comments', label: 'Comments', types: ['commented'] },
  { key: 'assignments', label: 'Assignments', types: ['assigned'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getEventDescription(event: PmNotification): string {
  // Adapt PmNotification to the shape getPmEventDescription expects
  return getPmEventDescription(event as unknown as Parameters<typeof getPmEventDescription>[0]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentActivityFeed() {
  const [events, setEvents] = useState<PmNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const filterConfig = EVENT_FILTER_CONFIG.find((f) => f.key === eventFilter);
      const eventTypes = filterConfig?.types ?? null;

      let data: PmNotification[];
      if (scopeFilter === 'mine') {
        // Use existing notifications RPC (only assigned items)
        const all = await getMyNotifications(since);
        // Client-side filter by event type since the RPC doesn't support it
        data = eventTypes
          ? all.filter((e) => eventTypes.includes(e.event_type))
          : all;
      } else {
        data = await getRecentActivity(since, eventTypes, 50);
      }

      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load activity:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, scopeFilter]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-400" />
          Recent Activity
        </h2>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Scope Toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1.5 transition-colors ${
              scopeFilter === 'all'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setScopeFilter('mine')}
            className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${
              scopeFilter === 'mine'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            My Items
          </button>
        </div>

        {/* Event Type Filters */}
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-gray-400 mr-1" />
          {EVENT_FILTER_CONFIG.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setEventFilter(filter.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                eventFilter === filter.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event List */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No recent activity
          {eventFilter !== 'all' && ' for this filter'}
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event) => {
            const icon = getPmEventIcon(event.event_type);
            const description = getEventDescription(event);
            const actorName = event.actor_name || null;

            return (
              <div
                key={event.event_id}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Icon */}
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 ${icon.color}`}
                >
                  {icon.symbol}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">
                    {actorName && (
                      <span className="font-medium text-gray-900">
                        {actorName}{' '}
                      </span>
                    )}
                    <span>{description}</span>
                  </div>
                  {event.item_title && (
                    <Link
                      href={`/dashboard/pm/backlog/${event.item_id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block mt-0.5"
                    >
                      {event.item_legacy_id && (
                        <span className="text-gray-400 mr-1">{event.item_legacy_id}</span>
                      )}
                      {event.item_title}
                    </Link>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
