'use client';

/**
 * TaskActivityTimeline - PM Item Detail
 *
 * Unified chronological timeline that merges comments and events into
 * a single stream sorted newest-first. Comments render as cards,
 * events render as compact inline system pills.
 * Adapted from support ActivityTimeline but without attachments.
 */

import type { PmComment, PmEvent } from '@/lib/pm-types';
import {
  buildPmTimeline,
  getPmEventIcon,
  getPmEventDescription,
  getPmActorName,
} from '@/lib/pm-timeline-utils';

// -- Props -------------------------------------------------------------------

interface TaskActivityTimelineProps {
  comments: PmComment[];
  events: PmEvent[];
}

// -- Helpers -----------------------------------------------------------------

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatEventTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// -- Sub-components ----------------------------------------------------------

/**
 * CommentCard - Renders a single comment in the timeline.
 */
function CommentCard({ comment }: { comment: PmComment }) {
  // PmComment has author_id but not author_name/email directly.
  // The RPC may populate them via metadata or joined fields.
  const authorDisplay = getCommentAuthor(comment);

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">
          {authorDisplay}
        </span>
        <span className="text-xs text-gray-400">
          {formatTimestamp(comment.created_at)}
        </span>
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {comment.body}
      </div>
    </div>
  );
}

/**
 * Extract a display name from a PmComment.
 * The comment object has author_id but the RPC may join author_name/author_email.
 */
function getCommentAuthor(comment: PmComment): string {
  const c = comment as unknown as Record<string, unknown>;
  if (typeof c.author_name === 'string' && c.author_name) return c.author_name;
  if (typeof c.author_email === 'string' && c.author_email) return c.author_email;
  return 'Unknown';
}

/**
 * EventInlineCard - Compact centered pill for system events.
 */
function EventInlineCard({ event }: { event: PmEvent }) {
  const icon = getPmEventIcon(event.event_type);
  const description = getPmEventDescription(event);
  const actorName = getPmActorName(event);

  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full text-xs text-gray-500">
        <span
          className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${icon.color}`}
        >
          {icon.symbol}
        </span>
        <span>{description}</span>
        {actorName && (
          <span className="text-gray-400">by {actorName}</span>
        )}
        <span className="text-gray-400">&middot;</span>
        <span className="text-gray-400">{formatEventTime(event.created_at)}</span>
      </div>
    </div>
  );
}

// -- Main component ----------------------------------------------------------

export function TaskActivityTimeline({ comments, events }: TaskActivityTimelineProps) {
  const timeline = buildPmTimeline(comments, events);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((entry) => {
        if (entry.type === 'comment') {
          return (
            <CommentCard key={`cmt-${entry.data.id}`} comment={entry.data} />
          );
        } else {
          return (
            <EventInlineCard key={`evt-${entry.data.id}`} event={entry.data} />
          );
        }
      })}
    </div>
  );
}
