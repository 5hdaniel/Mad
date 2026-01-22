'use client';

/**
 * MessageList - Displays messages grouped by conversation threads
 *
 * Groups messages by thread_id (for texts) or subject (for emails)
 * Shows compact thread cards that open into a phone-style conversation modal
 *
 * Design based on desktop app's TransactionMessagesTab/MessageThreadCard
 */

import { useState, useMemo } from 'react';
import { EmptyMessages } from '@/components/ui/EmptyState';

interface Message {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  sent_at: string;
  has_attachments: boolean;
  attachment_count: number;
  thread_id?: string | null;
  participants?: {
    from?: string;
    to?: string | string[];
    cc?: string[];
    bcc?: string[];
    chat_members?: string[];
    // Resolved names from contact lookup
    from_name?: string;
    to_names?: Record<string, string>;
    chat_member_names?: Record<string, string>;
  } | null;
}

interface MessageListProps {
  messages: Message[];
}

type FilterType = 'all' | 'email' | 'text';

interface Thread {
  id: string;
  messages: Message[];
  channel: string;
  subject: string | null;
  firstDate: string;
  lastDate: string;
  participantDisplay: string;
  totalAttachments: number;
}

/**
 * Normalize a participant identifier for consistent grouping
 */
function normalizeParticipant(participant: string): string {
  if (!participant) return '';
  const digits = participant.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return participant.toLowerCase().trim();
}

/**
 * Generate a thread key for grouping messages
 */
function getThreadKey(msg: Message): string {
  // Use thread_id if available (for texts/iMessage)
  if (msg.thread_id) {
    return msg.thread_id;
  }

  // For emails, group by subject (normalized)
  if (msg.channel === 'email' && msg.subject) {
    // Remove Re: Fwd: etc. prefixes
    const normalizedSubject = msg.subject
      .replace(/^(re:|fwd?:|fw:)\s*/gi, '')
      .trim()
      .toLowerCase();
    return `email-${normalizedSubject}`;
  }

  // Fallback: group by participants
  if (msg.participants) {
    const participants = msg.participants;
    const allParticipants = new Set<string>();

    if (participants.from) {
      allParticipants.add(normalizeParticipant(participants.from));
    }
    if (participants.to) {
      const toList = Array.isArray(participants.to) ? participants.to : [participants.to];
      toList.forEach((p) => allParticipants.add(normalizeParticipant(p)));
    }

    if (allParticipants.size > 0) {
      return `participants-${Array.from(allParticipants).sort().join('|')}`;
    }
  }

  // Last resort: use message id
  return `msg-${msg.id}`;
}

/**
 * Extract display name for participants, preferring resolved contact names
 */
function getParticipantDisplay(messages: Message[]): string {
  const participants = new Set<string>();

  for (const msg of messages) {
    if (msg.participants) {
      // For inbound messages, use the sender
      if (msg.direction === 'inbound' && msg.participants.from) {
        // Use resolved name if available, otherwise fall back to phone/email
        const displayName = msg.participants.from_name || msg.participants.from;
        participants.add(displayName);
      }
      // For outbound messages, use the recipients
      if (msg.direction === 'outbound' && msg.participants.to) {
        const toList = Array.isArray(msg.participants.to)
          ? msg.participants.to
          : [msg.participants.to];
        const toNames = msg.participants.to_names || {};
        toList.forEach((p) => {
          // Use resolved name if available
          const displayName = toNames[p] || p;
          participants.add(displayName);
        });
      }
      // For group chats, add chat member names
      if (msg.participants.chat_members && msg.participants.chat_member_names) {
        const memberNames = msg.participants.chat_member_names;
        msg.participants.chat_members.forEach((p) => {
          if (p !== 'me' && memberNames[p]) {
            participants.add(memberNames[p]);
          }
        });
      }
    }
  }

  const uniqueParticipants = Array.from(participants).filter(Boolean);
  if (uniqueParticipants.length === 0) return 'Unknown';
  if (uniqueParticipants.length === 1) return uniqueParticipants[0];
  if (uniqueParticipants.length <= 3) return uniqueParticipants.join(', ');
  return `${uniqueParticipants.slice(0, 2).join(', ')} +${uniqueParticipants.length - 2} more`;
}

/**
 * Get initials for avatar display
 */
function getAvatarInitial(name: string): string {
  if (!name || name.trim().length === 0) return '#';
  // Check if it looks like a phone number
  if (/^[\d\s\-+()]+$/.test(name)) return '#';
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Format date range for display
 */
function formatDateRange(firstDate: string, lastDate: string): string {
  const first = new Date(firstDate);
  const last = new Date(lastDate);
  const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

  if (first.toDateString() === last.toDateString()) {
    return first.toLocaleDateString(undefined, formatOpts);
  }
  return `${first.toLocaleDateString(undefined, formatOpts)} - ${last.toLocaleDateString(undefined, formatOpts)}`;
}

/**
 * Group messages into threads
 */
function groupMessagesIntoThreads(messages: Message[]): Thread[] {
  const threadMap = new Map<string, Message[]>();

  // Group messages by thread key
  for (const msg of messages) {
    const key = getThreadKey(msg);
    const existing = threadMap.get(key) || [];
    existing.push(msg);
    threadMap.set(key, existing);
  }

  // Convert to Thread objects and sort messages within each thread
  const threads: Thread[] = Array.from(threadMap.entries()).map(([id, msgs]) => {
    // Sort by sent_at ascending (oldest first within thread)
    const sortedMsgs = msgs.sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );

    const firstMsg = sortedMsgs[0];
    const lastMsg = sortedMsgs[sortedMsgs.length - 1];

    return {
      id,
      messages: sortedMsgs,
      channel: firstMsg.channel,
      subject: firstMsg.subject,
      firstDate: firstMsg.sent_at,
      lastDate: lastMsg.sent_at,
      participantDisplay: getParticipantDisplay(sortedMsgs),
      totalAttachments: sortedMsgs.reduce((sum, m) => sum + m.attachment_count, 0),
    };
  });

  // Sort threads by most recent message (newest first)
  return threads.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
}

/**
 * Format timestamp for message display
 */
function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Phone-style conversation modal
 */
function ConversationModal({
  thread,
  onClose,
}: {
  thread: Thread;
  onClose: () => void;
}) {
  const isEmail = thread.channel === 'email';
  const isGroupChat = thread.participantDisplay.includes(',') || thread.participantDisplay.includes('+');

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-4 py-3 flex items-center gap-3 ${
          isEmail
            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
            : 'bg-gradient-to-r from-green-500 to-teal-600'
        }`}>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold truncate">
              {isGroupChat ? 'Group Chat' : thread.participantDisplay}
            </h4>
            {isGroupChat && (
              <p className="text-white/80 text-xs truncate">{thread.participantDisplay}</p>
            )}
            {thread.subject && (
              <p className="text-white/80 text-xs truncate">{thread.subject}</p>
            )}
            <p className={`text-xs ${isEmail ? 'text-blue-100' : 'text-green-100'}`}>
              {thread.messages.length} message{thread.messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {thread.messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            const msgText = msg.body_text || '';

            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isOutbound
                      ? isEmail
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-green-500 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                  }`}
                >
                  {/* Subject for emails (first message only or when subject changes) */}
                  {isEmail && msg.subject && (
                    <p className={`text-xs font-semibold mb-1 ${isOutbound ? 'text-white/80' : 'text-gray-500'}`}>
                      {msg.subject}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msgText || '[No content]'}
                  </p>
                  <div className={`flex items-center gap-2 mt-1 ${isOutbound ? (isEmail ? 'text-blue-100' : 'text-green-100') : 'text-gray-400'}`}>
                    <span className="text-xs">{formatMessageTime(msg.sent_at)}</span>
                    {msg.has_attachments && (
                      <span className="flex items-center gap-1 text-xs">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {msg.attachment_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-4 py-3 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium text-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Thread card component (similar to desktop MessageThreadCard)
 */
function ThreadCard({
  thread,
  onViewFull,
}: {
  thread: Thread;
  onViewFull: () => void;
}) {
  const isEmail = thread.channel === 'email';
  const isGroupChat = thread.participantDisplay.includes(',') || thread.participantDisplay.includes('+');
  const avatarInitial = getAvatarInitial(thread.participantDisplay);

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar */}
          {isGroupChat ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
              isEmail ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-green-500 to-teal-600'
            }`}>
              {avatarInitial}
            </div>
          )}

          {/* Contact info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-gray-900 truncate">
                {isGroupChat ? 'Group Chat' : thread.participantDisplay}
              </span>
              <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {thread.messages.length}
              </span>
              {isEmail && (
                <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  Email
                </span>
              )}
            </div>
            {isGroupChat && (
              <p className="text-xs text-gray-500 truncate">{thread.participantDisplay}</p>
            )}
            {thread.subject && (
              <p className="text-sm text-gray-600 truncate">{thread.subject}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>{formatDateRange(thread.firstDate, thread.lastDate)}</span>
              {thread.totalAttachments > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {thread.totalAttachments}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Full button */}
        <button
          onClick={onViewFull}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap flex-shrink-0 ml-4"
        >
          View Full &rarr;
        </button>
      </div>
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  // Filter messages first
  const filteredMessages = messages.filter((msg) => {
    if (filter === 'all') return true;
    if (filter === 'email') return msg.channel === 'email';
    if (filter === 'text') return msg.channel === 'sms' || msg.channel === 'imessage';
    return true;
  });

  // Group filtered messages into threads
  const threads = useMemo(() => groupMessagesIntoThreads(filteredMessages), [filteredMessages]);

  const emailCount = messages.filter((m) => m.channel === 'email').length;
  const textCount = messages.filter((m) => m.channel !== 'email').length;

  const tabs: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: messages.length },
    { value: 'email', label: 'Emails', count: emailCount },
    { value: 'text', label: 'Texts', count: textCount },
  ];

  return (
    <>
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {/* Header with tabs */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Messages ({filteredMessages.length})</h2>
              <p className="text-sm text-gray-500">
                in {threads.length} conversation{threads.length !== 1 ? 's' : ''}
              </p>
            </div>
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

        {/* Thread list */}
        <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
          {threads.length === 0 ? (
            <EmptyMessages />
          ) : (
            threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onViewFull={() => setSelectedThread(thread)}
              />
            ))
          )}
        </div>
      </div>

      {/* Conversation Modal */}
      {selectedThread && (
        <ConversationModal
          thread={selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}
    </>
  );
}
