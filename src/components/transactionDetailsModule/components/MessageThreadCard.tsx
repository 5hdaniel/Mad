/**
 * MessageThreadCard Component
 * Container for a conversation thread, displaying a header with contact info
 * and a scrollable list of messages.
 */
import React from "react";
import type { Communication } from "../types";
import { MessageBubble } from "./MessageBubble";

export interface MessageThreadCardProps {
  /** Unique identifier for the thread */
  threadId: string;
  /** Messages in this thread, sorted chronologically */
  messages: Communication[];
  /** Contact name if available */
  contactName?: string;
  /** Phone number or identifier for the thread */
  phoneNumber: string;
  /** Callback when unlink button is clicked */
  onUnlink?: (threadId: string) => void;
}

/**
 * Get initials for avatar display.
 * Uses first character of name or '#' for phone numbers.
 */
function getAvatarInitial(contactName?: string, phoneNumber?: string): string {
  if (contactName && contactName.trim().length > 0) {
    return contactName.trim().charAt(0).toUpperCase();
  }
  // If phone number, just show hash
  return "#";
}

/**
 * MessageThreadCard component for displaying a conversation thread.
 * Shows a header with contact info and a scrollable message list.
 */
export function MessageThreadCard({
  threadId,
  messages,
  contactName,
  phoneNumber,
  onUnlink,
}: MessageThreadCardProps): React.ReactElement {
  const avatarInitial = getAvatarInitial(contactName, phoneNumber);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden"
      data-testid="message-thread-card"
      data-thread-id={threadId}
    >
      {/* Thread Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
          {avatarInitial}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-gray-900 truncate" data-testid="thread-contact-name">
            {contactName || phoneNumber}
          </h4>
          {contactName && phoneNumber && (
            <p className="text-sm text-gray-500 truncate" data-testid="thread-phone-number">
              {phoneNumber}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
          {onUnlink && (
            <button
              onClick={() => onUnlink(threadId)}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition-all"
              title="Remove from transaction"
              data-testid="unlink-thread-button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="p-4 space-y-3 max-h-96 overflow-y-auto"
        data-testid="thread-messages"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}

/**
 * Utility function to group messages by thread_id.
 * Messages without a thread_id are grouped by their own id.
 */
export function groupMessagesByThread(
  messages: Communication[]
): Map<string, Communication[]> {
  const threads = new Map<string, Communication[]>();

  messages.forEach((msg) => {
    const threadId = msg.thread_id || msg.id;
    const thread = threads.get(threadId) || [];
    thread.push(msg);
    threads.set(threadId, thread);
  });

  // Sort messages within each thread chronologically
  threads.forEach((msgs, key) => {
    threads.set(
      key,
      msgs.sort((a, b) => {
        const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
        const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
        return dateA - dateB;
      })
    );
  });

  return threads;
}

/**
 * Utility function to extract phone number from thread messages.
 * Looks at participants to find the external phone number.
 */
export function extractPhoneFromThread(messages: Communication[]): string {
  for (const msg of messages) {
    // Try to parse participants JSON
    if (msg.participants) {
      try {
        const participants = JSON.parse(msg.participants);
        // For inbound messages, "from" is the external phone
        // For outbound messages, "to" contains the external phone
        if (msg.direction === "inbound" && participants.from) {
          return participants.from;
        }
        if (msg.direction === "outbound" && participants.to?.length > 0) {
          return participants.to[0];
        }
      } catch {
        // Parsing failed, continue to fallback
      }
    }

    // Fallback to legacy sender field
    if (msg.sender) {
      return msg.sender;
    }
  }

  return "Unknown";
}

/**
 * Sort threads by most recent message (newest first).
 */
export function sortThreadsByRecent(
  threads: Map<string, Communication[]>
): [string, Communication[]][] {
  return Array.from(threads.entries()).sort(([, msgsA], [, msgsB]) => {
    const lastA = msgsA[msgsA.length - 1];
    const lastB = msgsB[msgsB.length - 1];
    const dateA = new Date(lastA?.sent_at || lastA?.received_at || 0).getTime();
    const dateB = new Date(lastB?.sent_at || lastB?.received_at || 0).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}
