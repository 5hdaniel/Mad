'use client';

/**
 * MessageList - Displays messages with filter tabs
 *
 * Allows filtering by: All, Emails, Texts
 */

import { useState } from 'react';
import { formatDate } from '@/lib/utils';

interface Message {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  sent_at: string;
  has_attachments: boolean;
  attachment_count: number;
}

interface MessageListProps {
  messages: Message[];
}

type FilterType = 'all' | 'email' | 'text';

export function MessageList({ messages }: MessageListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'all') return true;
    if (filter === 'email') return msg.channel === 'email';
    if (filter === 'text') return msg.channel === 'sms' || msg.channel === 'imessage';
    return true;
  });

  const emailCount = messages.filter((m) => m.channel === 'email').length;
  const textCount = messages.filter((m) => m.channel !== 'email').length;

  const tabs: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: messages.length },
    { value: 'email', label: 'Emails', count: emailCount },
    { value: 'text', label: 'Texts', count: textCount },
  ];

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header with tabs */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Messages</h2>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(({ value, label, count }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            {filter === 'all' ? 'No messages in this submission' : `No ${filter}s in this submission`}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredMessages.map((message) => {
              const isExpanded = expandedId === message.id;
              const isEmail = message.channel === 'email';
              const bodyPreview = message.body_text?.slice(0, 200) || '';
              const hasMore = (message.body_text?.length || 0) > 200;

              return (
                <li key={message.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isEmail ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {isEmail ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Direction indicator */}
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            message.direction === 'outbound'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {message.direction === 'outbound' ? 'Sent' : 'Received'}
                        </span>
                        <span className="text-xs text-gray-400 uppercase">{message.channel}</span>
                        <span className="text-xs text-gray-400">{formatDate(message.sent_at)}</span>
                      </div>

                      {/* Subject (for emails) */}
                      {message.subject && (
                        <p className="font-medium text-gray-900 mb-1">{message.subject}</p>
                      )}

                      {/* Body */}
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {isExpanded ? message.body_text : bodyPreview}
                        {hasMore && !isExpanded && '...'}
                      </p>

                      {/* Show more button */}
                      {hasMore && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : message.id)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-500"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}

                      {/* Attachments indicator */}
                      {message.has_attachments && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                          </svg>
                          {message.attachment_count} attachment
                          {message.attachment_count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
