'use client';

/**
 * CustomerConversation - Customer Ticket Detail
 *
 * Displays conversation thread from the customer's perspective.
 * Internal notes are filtered out (defense-in-depth).
 * Customer messages vs agent messages have distinct styling.
 */

import type { SupportTicketMessage } from '@/lib/support-types';

interface CustomerConversationProps {
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

export function CustomerConversation({
  messages,
  ticketDescription,
  requesterName,
  requesterEmail,
  createdAt,
}: CustomerConversationProps) {
  // Filter out internal notes (defense-in-depth, RPC should already exclude them)
  const publicMessages = messages.filter((m) => m.message_type !== 'internal_note');

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
          </div>
        </div>
      </div>

      {/* Messages */}
      {publicMessages.map((message) => {
        const isCustomer = message.sender_email === requesterEmail;

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
