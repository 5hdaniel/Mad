'use client';

/**
 * CustomerConversation - Customer Ticket Detail
 *
 * Displays conversation thread from the customer's perspective.
 * Internal notes are filtered out (defense-in-depth).
 * Customer messages vs agent messages have distinct styling.
 * Attachments are shown inline with their associated messages.
 */

import { useState, useEffect } from 'react';
import type { SupportTicketMessage, SupportTicketAttachment } from '@/lib/support-types';
import { getAttachmentUrl } from '@/lib/support-queries';

interface CustomerConversationProps {
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

function AttachmentItem({ attachment }: { attachment: SupportTicketAttachment }) {
  const [downloading, setDownloading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const isImage = attachment.file_type.startsWith('image/');

  // Auto-load signed URL for images
  useEffect(() => {
    if (isImage) {
      getAttachmentUrl(attachment.storage_path)
        .then(setImageUrl)
        .catch(() => setImageError(true));
    }
  }, [isImage, attachment.storage_path]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = imageUrl || await getAttachmentUrl(attachment.storage_path);
      window.open(url, '_blank');
    } catch {
      // Silently fail — user can retry
    } finally {
      setDownloading(false);
    }
  }

  if (isImage && imageUrl && !imageError) {
    return (
      <div className="mt-2">
        <button onClick={handleDownload} className="block cursor-pointer">
          <img
            src={imageUrl}
            alt={attachment.file_name}
            className="max-w-full max-h-64 rounded-md border border-gray-200"
            onError={() => setImageError(true)}
          />
        </button>
        <span className="text-xs text-gray-400 mt-1 block">
          {attachment.file_name} ({formatFileSize(attachment.file_size)})
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors text-left w-full"
    >
      <span className="text-gray-400 text-sm shrink-0">📎</span>
      <span className="text-sm text-blue-600 hover:text-blue-700 truncate">
        {attachment.file_name}
      </span>
      <span className="text-xs text-gray-400 shrink-0">
        {formatFileSize(attachment.file_size)}
      </span>
    </button>
  );
}

export function CustomerConversation({
  messages,
  attachments,
  ticketDescription,
  requesterName,
  requesterEmail,
  createdAt,
}: CustomerConversationProps) {
  // Filter out internal notes (defense-in-depth, RPC should already exclude them)
  const publicMessages = messages.filter((m) => m.message_type !== 'internal_note');

  // Group attachments by message_id (null = ticket-level attachments)
  const attachmentsByMessage = new Map<string | null, SupportTicketAttachment[]>();
  for (const att of attachments) {
    const key = att.message_id;
    if (!attachmentsByMessage.has(key)) {
      attachmentsByMessage.set(key, []);
    }
    attachmentsByMessage.get(key)!.push(att);
  }

  const ticketAttachments = attachmentsByMessage.get(null) || [];

  return (
    <div className="space-y-4">
      {/* Original ticket description */}
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{requesterName}</span>
              <span className="text-xs text-gray-400 ml-3">{formatTimestamp(createdAt)}</span>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{ticketDescription}</div>
            {ticketAttachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {ticketAttachments.map((att) => (
                  <AttachmentItem key={att.id} attachment={att} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {publicMessages.map((message) => {
        const isCustomer = message.sender_email === requesterEmail;
        const messageAttachments = attachmentsByMessage.get(message.id) || [];

        return (
          <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%]">
              <div
                className={`rounded-lg p-4 ${
                  isCustomer
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {isCustomer
                      ? message.sender_name || 'You'
                      : message.sender_name || 'Support Agent'}
                  </span>
                  <span className="text-xs text-gray-400 ml-3">
                    {formatTimestamp(message.created_at)}
                  </span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</div>
                {messageAttachments.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {messageAttachments.map((att) => (
                      <AttachmentItem key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {publicMessages.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">
          No replies yet. A support agent will respond soon.
        </div>
      )}
    </div>
  );
}
