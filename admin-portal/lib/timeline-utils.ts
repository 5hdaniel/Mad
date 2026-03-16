/**
 * Timeline utility functions for the support ticket activity timeline.
 *
 * Pure functions extracted for testability — no JSX, no React dependencies.
 */

import type {
  SupportTicketMessage,
  SupportTicketEvent,
  TimelineEntry,
} from './support-types';

/**
 * Merge messages and events into a single chronological timeline.
 * Filters out `message_added` events (the message itself is shown).
 * Sorted oldest-first for natural reading order.
 */
export function buildTimeline(
  messages: SupportTicketMessage[],
  events: SupportTicketEvent[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...messages.map((m) => ({
      type: 'message' as const,
      data: m,
      timestamp: m.created_at,
    })),
    ...events
      .filter((e) => e.event_type !== 'message_added')
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
 * Get icon symbol and Tailwind color class for an event type.
 */
export function getEventIcon(eventType: string): { symbol: string; color: string } {
  switch (eventType) {
    case 'created':
      return { symbol: '+', color: 'bg-green-100 text-green-700' };
    case 'status_changed':
      return { symbol: '\u25CF', color: 'bg-blue-100 text-blue-700' };
    case 'assigned':
      return { symbol: '\u263A', color: 'bg-purple-100 text-purple-700' };
    case 'priority_changed':
      return { symbol: '\u2691', color: 'bg-orange-100 text-orange-700' };
    case 'ticket_linked':
      return { symbol: '\u{1F517}', color: 'bg-gray-100 text-gray-600' };
    case 'ticket_unlinked':
      return { symbol: '\u2715', color: 'bg-gray-100 text-gray-600' };
    case 'participant_added':
      return { symbol: '+', color: 'bg-gray-100 text-gray-600' };
    case 'participant_removed':
      return { symbol: '-', color: 'bg-gray-100 text-gray-600' };
    default:
      return { symbol: '\u2022', color: 'bg-gray-100 text-gray-600' };
  }
}

/**
 * Get human-readable description for an event.
 */
export function getEventDescription(event: SupportTicketEvent): string {
  switch (event.event_type) {
    case 'created':
      return 'Ticket created';
    case 'status_changed':
      return event.old_value && event.new_value
        ? `Status: ${event.old_value} \u2192 ${event.new_value}`
        : `Status changed to ${event.new_value || 'unknown'}`;
    case 'assigned':
      return event.new_value
        ? `Assigned to ${event.new_value}`
        : 'Assignment changed';
    case 'priority_changed':
      return event.old_value && event.new_value
        ? `Priority: ${event.old_value} \u2192 ${event.new_value}`
        : `Priority changed to ${event.new_value || 'unknown'}`;
    case 'ticket_linked':
      return `Linked to ${event.new_value || 'ticket'}`;
    case 'ticket_unlinked':
      return `Unlinked from ${event.old_value || 'ticket'}`;
    case 'participant_added':
      return `Added ${event.new_value || 'participant'}`;
    case 'participant_removed':
      return `Removed ${event.old_value || 'participant'}`;
    default:
      return event.event_type.replace(/_/g, ' ');
  }
}

/**
 * Extract actor name from event metadata.
 */
export function getActorName(event: SupportTicketEvent): string | null {
  if (event.metadata && typeof event.metadata === 'object') {
    const meta = event.metadata as Record<string, unknown>;
    if (typeof meta.actor_name === 'string') return meta.actor_name;
    if (typeof meta.actor_email === 'string') return meta.actor_email;
  }
  return null;
}
