'use client';

/**
 * ActivityTimeline - Unified chronological timeline for ticket detail.
 *
 * Merges messages and events into a single stream sorted oldest-first.
 * Messages render as cards (same style as ConversationThread MessageList).
 * Events render as compact inline system pills (centered, gray).
 * Filters out `message_added` events since the message itself is shown.
 */

import { useState, useEffect } from 'react';
import { Lock, Paperclip } from 'lucide-react';
import type {
  SupportTicketMessage,
  SupportTicketEvent,
  SupportTicketAttachment,
} from '@/lib/support-types';
import { buildTimeline, getEventIcon, getEventDescription, getActorName } from '@/lib/timeline-utils';
import { getAttachmentUrl } from '@/lib/support-queries';
import { AttachmentLightbox } from './AttachmentLightbox';

// ─── Props ───────────────────────────────────────────────────────────

interface ActivityTimelineProps {
  messages: SupportTicketMessage[];
  events: SupportTicketEvent[];
  attachments: SupportTicketAttachment[];
  showAttachments?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ──────────────────────────────────────────────────

function AttachmentThumbnail({
  attachment,
  onPreview,
}: {
  attachment: SupportTicketAttachment;
  onPreview: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  const isImage = attachment.file_type.startsWith('image/');

  useEffect(() => {
    if (isImage) {
      getAttachmentUrl(attachment.storage_path)
        .then(setUrl)
        .catch(() => setLoadError(true));
    }
  }, [isImage, attachment.storage_path]);

  async function handleClick() {
    if (url) {
      onPreview(url);
      return;
    }
    setLoading(true);
    try {
      const signedUrl = await getAttachmentUrl(attachment.storage_path);
      setUrl(signedUrl);
      onPreview(signedUrl);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  if (isImage && url && !loadError) {
    return (
      <button
        onClick={handleClick}
        className="block group relative rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
      >
        <img
          src={url}
          alt={attachment.file_name}
          className="h-20 w-auto object-cover rounded-md"
          onError={() => setLoadError(true)}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-md" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-blue-400 transition-colors disabled:opacity-50"
    >
      <Paperclip className="h-3 w-3 text-gray-400" />
      <span className="text-gray-700 truncate max-w-[120px]">{attachment.file_name}</span>
      <span className="text-gray-400">({formatFileSize(attachment.file_size)})</span>
    </button>
  );
}

function InlineAttachments({
  attachments,
  onPreview,
}: {
  attachments: SupportTicketAttachment[];
  onPreview: (url: string, att: SupportTicketAttachment) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <AttachmentThumbnail
          key={att.id}
          attachment={att}
          onPreview={(url) => onPreview(url, att)}
        />
      ))}
    </div>
  );
}

/**
 * MessageCard - Renders a single message in the timeline.
 * Preserves the internal note amber/yellow styling with lock icon.
 */
function MessageCard({
  message,
  attachments,
  showAttachments,
  onPreview,
}: {
  message: SupportTicketMessage;
  attachments: SupportTicketAttachment[];
  showAttachments: boolean;
  onPreview: (url: string, att: SupportTicketAttachment) => void;
}) {
  const isNote = message.message_type === 'internal_note';

  return (
    <div
      className={`rounded-lg p-4 ${
        isNote
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-white border border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isNote && (
            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
              <Lock className="h-3 w-3" />
              Internal Note
            </div>
          )}
          <span className="text-sm font-medium text-gray-900">
            {message.sender_name || message.sender_email || 'System'}
          </span>
          {message.sender_email && message.sender_name && (
            <span className="text-xs text-gray-400">{message.sender_email}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatTimestamp(message.created_at)}</span>
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</div>
      {showAttachments && (
        <InlineAttachments attachments={attachments} onPreview={onPreview} />
      )}
    </div>
  );
}

/**
 * EventInlineCard - Compact centered pill for system events.
 */
function EventInlineCard({ event }: { event: SupportTicketEvent }) {
  const icon = getEventIcon(event.event_type);
  const description = getEventDescription(event);
  const actorName = getActorName(event);

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
          <>
            <span className="text-gray-400">by {actorName}</span>
          </>
        )}
        <span className="text-gray-400">&middot;</span>
        <span className="text-gray-400">{formatEventTime(event.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export function ActivityTimeline({
  messages,
  events,
  attachments,
  showAttachments = true,
}: ActivityTimelineProps) {
  const [lightbox, setLightbox] = useState<{
    url: string;
    attachment: SupportTicketAttachment;
  } | null>(null);

  // Group attachments by message_id
  const attachmentsByMessage = new Map<string, SupportTicketAttachment[]>();
  for (const att of attachments) {
    if (!att.message_id) continue;
    if (!attachmentsByMessage.has(att.message_id)) {
      attachmentsByMessage.set(att.message_id, []);
    }
    attachmentsByMessage.get(att.message_id)!.push(att);
  }

  const timeline = buildTimeline(messages, events);

  function openLightbox(url: string, att: SupportTicketAttachment) {
    setLightbox({ url, attachment: att });
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {timeline.map((entry) => {
          if (entry.type === 'message') {
            const msg = entry.data;
            const msgAttachments = attachmentsByMessage.get(msg.id) || [];
            return (
              <MessageCard
                key={`msg-${msg.id}`}
                message={msg}
                attachments={msgAttachments}
                showAttachments={showAttachments}
                onPreview={openLightbox}
              />
            );
          } else {
            return (
              <EventInlineCard key={`evt-${entry.data.id}`} event={entry.data} />
            );
          }
        })}
      </div>

      {lightbox && (
        <AttachmentLightbox
          url={lightbox.url}
          fileName={lightbox.attachment.file_name}
          fileType={lightbox.attachment.file_type}
          fileSize={formatFileSize(lightbox.attachment.file_size)}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
