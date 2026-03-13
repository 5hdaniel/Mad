'use client';

/**
 * ConversationThread - Support Ticket Detail
 *
 * Displays ticket messages in chronological order.
 * Internal notes have amber/yellow background with lock icon.
 * Public replies have standard white/gray styling.
 */

import { Lock, MessageSquare } from 'lucide-react';
import type { SupportTicketMessage } from '@/lib/support-types';

interface ConversationThreadProps {
  messages: SupportTicketMessage[];
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

function MessageBubble({ message }: { message: SupportTicketMessage }) {
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
    </div>
  );
}

export function ConversationThread({
  messages,
  ticketDescription,
  requesterName,
  requesterEmail,
  createdAt,
}: ConversationThreadProps) {
  return (
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
      </div>

      {/* Messages */}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {messages.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No replies yet. Be the first to respond.
        </div>
      )}
    </div>
  );
}
