/**
 * Timeline utility functions for the PM module activity timeline.
 *
 * Pure functions extracted for testability -- no JSX, no React dependencies.
 * Follows the same pattern as timeline-utils.ts (support module).
 */

import type { PmComment, PmEvent, PmTimelineEntry } from './pm-types';

/**
 * Merge comments and events into a single chronological timeline.
 * Filters out `commented` events (the comment itself is shown separately).
 * Sorted newest-first for natural activity feed order.
 */
export function buildPmTimeline(
  comments: PmComment[],
  events: PmEvent[],
): PmTimelineEntry[] {
  const entries: PmTimelineEntry[] = [
    ...comments.map((c) => ({
      type: 'comment' as const,
      data: c,
      timestamp: c.created_at,
    })),
    ...events
      .filter((e) => e.event_type !== 'commented')
      .map((e) => ({
        type: 'event' as const,
        data: e,
        timestamp: e.created_at,
      })),
  ];
  // Sort newest first (most recent activity at top)
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Get icon symbol and Tailwind color class for a PM event type.
 */
export function getPmEventIcon(eventType: string): { symbol: string; color: string } {
  switch (eventType) {
    case 'created':
      return { symbol: '+', color: 'bg-green-100 text-green-700' };
    case 'status_changed':
      return { symbol: '\u25CF', color: 'bg-blue-100 text-blue-700' };
    case 'assigned':
      return { symbol: '\u263A', color: 'bg-purple-100 text-purple-700' };
    case 'field_changed':
      return { symbol: '\u270E', color: 'bg-yellow-100 text-yellow-700' };
    case 'linked':
      return { symbol: '\u{1F517}', color: 'bg-gray-100 text-gray-600' };
    case 'unlinked':
      return { symbol: '\u2715', color: 'bg-gray-100 text-gray-600' };
    case 'sprint_changed':
      return { symbol: '\u{1F3C3}', color: 'bg-indigo-100 text-indigo-700' };
    case 'deleted':
      return { symbol: '\u2212', color: 'bg-red-100 text-red-700' };
    default:
      return { symbol: '\u2022', color: 'bg-gray-100 text-gray-600' };
  }
}

/**
 * Get human-readable description for a PM event.
 */
export function getPmEventDescription(event: PmEvent): string {
  const meta = event.metadata as Record<string, unknown> | null;

  switch (event.event_type) {
    case 'created':
      return 'Item created';
    case 'status_changed':
      return event.old_value && event.new_value
        ? `Status: ${event.old_value} \u2192 ${event.new_value}`
        : `Status changed to ${event.new_value || 'unknown'}`;
    case 'assigned':
      return event.new_value
        ? `Assigned to ${event.new_value}`
        : 'Assignment cleared';
    case 'field_changed': {
      const field = meta?.field as string | undefined;
      if (field) {
        const label = field.replace(/_/g, ' ');
        return event.old_value && event.new_value
          ? `${label}: ${event.old_value} \u2192 ${event.new_value}`
          : `Updated ${label} to ${event.new_value || 'empty'}`;
      }
      return 'Field updated';
    }
    case 'linked':
      return `Linked to ${event.new_value || 'item'}`;
    case 'unlinked':
      return `Unlinked from ${event.old_value || 'item'}`;
    case 'sprint_changed':
      return event.old_value === 'removed'
        ? 'Removed from sprint'
        : `Moved to sprint`;
    case 'deleted':
      return 'Item deleted';
    case 'commented':
      return 'Comment added';
    default:
      return event.event_type.replace(/_/g, ' ');
  }
}

/**
 * Extract actor name from event.
 * PM events store actor_id but may include actor_name/actor_email
 * as top-level fields or in metadata for display purposes.
 */
export function getPmActorName(event: PmEvent): string | null {
  const evt = event as unknown as Record<string, unknown>;
  if (typeof evt.actor_name === 'string') return evt.actor_name;
  if (typeof evt.actor_email === 'string') return evt.actor_email;
  if (event.metadata && typeof event.metadata === 'object') {
    const meta = event.metadata as Record<string, unknown>;
    if (typeof meta.actor_name === 'string') return meta.actor_name;
    if (typeof meta.actor_email === 'string') return meta.actor_email;
  }
  return null;
}
