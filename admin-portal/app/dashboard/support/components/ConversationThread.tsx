'use client';

/**
 * ConversationThread - Support Ticket Detail
 *
 * Displays ticket messages in chronological order.
 * Internal notes have amber/yellow background with lock icon.
 * Public replies have standard white/gray styling.
 * Attachments shown inline with thumbnails + lightbox preview.
 * Toggle to show/hide inline attachments.
 */

import { useState, useEffect } from 'react';
import { Lock, MessageSquare, Eye, EyeOff, Paperclip } from 'lucide-react';
import type { SupportTicketMessage, SupportTicketAttachment } from '@/lib/support-types';
import { getAttachmentUrl } from '@/lib/support-queries';
import { AttachmentLightbox } from './AttachmentLightbox';

interface ConversationThreadProps {
  messages: SupportTicketMessage[];
  attachments: SupportTicketAttachment[];
  ticketDescription: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function MessageBubble({
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
      {/* Header */}
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

      {/* Body */}
      <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</div>

      {/* Inline attachments */}
      {showAttachments && (
        <InlineAttachments attachments={attachments} onPreview={onPreview} />
      )}
    </div>
  );
}

export function ConversationThread({
  messages,
  attachments,
  ticketDescription,
  requesterName,
  requesterEmail,
  createdAt,
}: ConversationThreadProps) {
  const [showAttachments, setShowAttachments] = useState(true);
  const [lightbox, setLightbox] = useState<{
    url: string;
    attachment: SupportTicketAttachment;
  } | null>(null);

  // Group attachments by message_id (null = ticket-level)
  const attachmentsByMessage = new Map<string | null, SupportTicketAttachment[]>();
  for (const att of attachments) {
    const key = att.message_id;
    if (!attachmentsByMessage.has(key)) {
      attachmentsByMessage.set(key, []);
    }
    attachmentsByMessage.get(key)!.push(att);
  }

  const ticketAttachments = attachmentsByMessage.get(null) || [];
  const hasAnyAttachments = attachments.length > 0;

  function openLightbox(url: string, att: SupportTicketAttachment) {
    setLightbox({ url, attachment: att });
  }

  return (
    <div>
      {/* Toggle bar */}
      {hasAnyAttachments && (
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showAttachments ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {showAttachments ? 'Hide' : 'Show'} inline attachments
            <span className="text-gray-400">({attachments.length})</span>
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Original ticket description as the first "message" */}
        <div className="rounded-lg p-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">{requesterName}</span>
              <span className="text-xs text-gray-400">{requesterEmail}</span>
            </div>
            <span className="text-xs text-gray-400">{formatTimestamp(createdAt)}</span>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{ticketDescription}</div>
          {showAttachments && (
            <InlineAttachments attachments={ticketAttachments} onPreview={openLightbox} />
          )}
        </div>

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            attachments={attachmentsByMessage.get(message.id) || []}
            showAttachments={showAttachments}
            onPreview={openLightbox}
          />
        ))}

        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No replies yet. Be the first to respond.
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <AttachmentLightbox
          url={lightbox.url}
          fileName={lightbox.attachment.file_name}
          fileType={lightbox.attachment.file_type}
          fileSize={formatFileSize(lightbox.attachment.file_size)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
