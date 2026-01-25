/**
 * MessageThreadCard Component
 * Container for a conversation thread, displaying a header with contact info.
 * Clicking "View" opens the conversation in a phone-style popup modal.
 */
import React, { useState } from "react";
import type { Communication, Message } from "../types";
import { ConversationViewModal } from "./modals";
import { getTrailingDigits } from "../../../../electron/utils/phoneUtils";
import {
  getThreadParticipants as getThreadParticipantsShared,
  isGroupChat as isGroupChatShared,
  formatParticipantNames as formatParticipantNamesShared,
  getThreadKey as getThreadKeyShared,
  type MessageLike as ThreadMessageLike,
} from "../../../../electron/utils/threadUtils";

/**
 * Union type for messages - can be from messages table or communications table
 */
export type MessageLike = Message | Communication;

export interface MessageThreadCardProps {
  /** Unique identifier for the thread */
  threadId: string;
  /** Messages in this thread, sorted chronologically */
  messages: MessageLike[];
  /** Contact name if available */
  contactName?: string;
  /** Phone number or identifier for the thread */
  phoneNumber: string;
  /** Callback when unlink button is clicked */
  onUnlink?: (threadId: string) => void;
  /** Map of phone number -> contact name for resolving senders */
  contactNames?: Record<string, string>;
  /** Audit period start date for filtering (TASK-1157) */
  auditStartDate?: Date | string | null;
  /** Audit period end date for filtering (TASK-1157) */
  auditEndDate?: Date | string | null;
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

// Thread utilities are imported from shared modules (electron/utils/threadUtils)
// Local wrappers for type compatibility

function getThreadParticipants(messages: MessageLike[]): string[] {
  return getThreadParticipantsShared(messages as ThreadMessageLike[]);
}

function isGroupChat(
  messages: MessageLike[],
  contactNames: Record<string, string> = {}
): boolean {
  return isGroupChatShared(messages as ThreadMessageLike[], contactNames);
}

function formatParticipantNames(
  participants: string[],
  contactNames: Record<string, string>,
  maxShow: number = 3
): string {
  return formatParticipantNamesShared(participants, contactNames, maxShow);
}

/**
 * Extract sender phone from a message's participants.
 */
function getSenderPhone(msg: MessageLike): string | null {
  if (msg.direction === "outbound") return null; // Outbound = user sent it

  try {
    if (msg.participants) {
      const parsed = typeof msg.participants === 'string'
        ? JSON.parse(msg.participants)
        : msg.participants;
      if (parsed.from) return parsed.from;
    }
  } catch {
    // Fall through
  }

  // Fallback to sender field if available
  if ("sender" in msg && msg.sender) {
    return msg.sender;
  }

  return null;
}

/**
 * Normalize phone for lookup (last 10 digits)
 * Uses shared utility from phoneUtils
 */
function normalizePhoneForLookup(phone: string): string {
  return getTrailingDigits(phone, 10);
}

/**
 * MessageThreadCard component for displaying a conversation thread.
 * Redesigned for TASK-1156: Compact single-line layout with date range.
 * Format: "ContactName (+1234567890)    Jan 1 - Jan 6    View Full ->"
 */
export function MessageThreadCard({
  threadId,
  messages,
  contactName,
  phoneNumber,
  onUnlink,
  contactNames = {},
  auditStartDate,
  auditEndDate,
}: MessageThreadCardProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false);

  // Detect group chat (using contactNames to resolve duplicates)
  const participants = getThreadParticipants(messages);
  const isGroup = isGroupChat(messages, contactNames);
  const avatarInitial = getAvatarInitial(contactName, phoneNumber);

  // Get date range for the conversation
  const getDateRange = (): string => {
    if (messages.length === 0) return "";
    const first = messages[0];
    const last = messages[messages.length - 1];
    const firstDate = new Date(first.sent_at || first.received_at || 0);
    const lastDate = new Date(last.sent_at || last.received_at || 0);
    const formatDate = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (firstDate.toDateString() === lastDate.toDateString()) {
      return formatDate(firstDate);
    }
    return `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
  };

  return (
    <>
      <div
        className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden hover:bg-gray-50 transition-colors"
        data-testid="message-thread-card"
        data-thread-id={threadId}
      >
        {/* Compact single-line layout */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar - Purple for group, Green for 1:1 */}
            {isGroup ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100">
                <svg
                  className="w-4 h-4 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {avatarInitial}
              </div>
            )}

            {/* Contact info: Name on first line, phone/recipients on second line */}
            <div className="min-w-0 flex-1">
              {isGroup ? (
                <div data-testid="thread-contact-name">
                  <span className="font-semibold text-gray-900 block">
                    Group Chat
                  </span>
                  <span
                    className="font-normal text-gray-500 text-sm block truncate"
                    title={formatParticipantNames(participants, contactNames, 999)}
                  >
                    {formatParticipantNames(participants, contactNames, 3)}
                  </span>
                </div>
              ) : (
                <div data-testid="thread-contact-name">
                  <span className="font-semibold text-gray-900 block">
                    {contactName || phoneNumber}
                  </span>
                  {contactName && phoneNumber && (
                    <span className="font-normal text-gray-500 text-sm block">
                      {phoneNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date range and action buttons */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {getDateRange()}
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
              data-testid="toggle-thread-button"
            >
              View Full &rarr;
            </button>
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
      </div>

      {/* Conversation Popup Modal */}
      {showModal && (
        <ConversationViewModal
          messages={messages}
          contactName={contactName}
          phoneNumber={phoneNumber}
          contactNames={contactNames}
          auditStartDate={auditStartDate}
          auditEndDate={auditEndDate}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

/**
 * Generate a key for grouping messages into chats.
 * Uses shared utility from threadUtils.
 */
function getThreadKey(msg: MessageLike): string {
  return getThreadKeyShared(msg as ThreadMessageLike);
}

/**
 * Utility function to group messages by conversation/chat.
 * Uses thread_id (actual iMessage chat ID) when available,
 * falls back to participant-based grouping otherwise.
 */
export function groupMessagesByThread(
  messages: MessageLike[]
): Map<string, MessageLike[]> {
  const threads = new Map<string, MessageLike[]>();

  messages.forEach((msg) => {
    const threadKey = getThreadKey(msg);
    const thread = threads.get(threadKey) || [];
    thread.push(msg);
    threads.set(threadKey, thread);
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
export function extractPhoneFromThread(messages: MessageLike[]): string {
  for (const msg of messages) {
    // Try to parse participants JSON
    if (msg.participants) {
      try {
        const participants = JSON.parse(msg.participants as string);
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

    // Fallback to legacy sender field (only on Communication type)
    if ("sender" in msg && msg.sender) {
      return msg.sender;
    }
  }

  return "Unknown";
}

/**
 * Sort threads by most recent message (newest first).
 */
export function sortThreadsByRecent(
  threads: Map<string, MessageLike[]>
): [string, MessageLike[]][] {
  return Array.from(threads.entries()).sort(([, msgsA], [, msgsB]) => {
    const lastA = msgsA[msgsA.length - 1];
    const lastB = msgsB[msgsB.length - 1];
    const dateA = new Date(lastA?.sent_at || lastA?.received_at || 0).getTime();
    const dateB = new Date(lastB?.sent_at || lastB?.received_at || 0).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}
