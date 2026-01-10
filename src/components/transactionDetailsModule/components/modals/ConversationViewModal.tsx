/**
 * ConversationViewModal Component
 * Phone-style popup modal for viewing a full conversation thread.
 */
import React from "react";
import type { MessageLike } from "../MessageThreadCard";

interface ConversationViewModalProps {
  /** Messages in the thread */
  messages: MessageLike[];
  /** Contact name for header */
  contactName?: string;
  /** Phone number for header */
  phoneNumber: string;
  /** Map of phone -> name for group chat sender resolution */
  contactNames?: Record<string, string>;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Normalize phone for lookup (last 10 digits)
 */
function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Extract sender phone from message participants
 */
function getSenderPhone(msg: MessageLike): string | null {
  if (msg.direction === "outbound") return null;

  try {
    if (msg.participants) {
      const parsed =
        typeof msg.participants === "string"
          ? JSON.parse(msg.participants)
          : msg.participants;
      if (parsed.from) return parsed.from;
    }
  } catch {
    // Fall through
  }

  if ("sender" in msg && msg.sender) {
    return msg.sender;
  }

  return null;
}

/**
 * Format timestamp for display
 */
function formatMessageTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConversationViewModal({
  messages,
  contactName,
  phoneNumber,
  contactNames = {},
  onClose,
}: ConversationViewModalProps): React.ReactElement {
  // Sort messages chronologically
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
    const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
    return dateA - dateB;
  });

  // Check if this is a group chat (multiple unique senders)
  const uniqueSenders = new Set<string>();
  messages.forEach((msg) => {
    const sender = getSenderPhone(msg);
    if (sender) uniqueSenders.add(normalizePhoneForLookup(sender));
  });
  const isGroupChat = uniqueSenders.size > 1;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone-style header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-600 px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="flex-1">
            <h4 className="text-white font-semibold">
              {contactName || phoneNumber}
              {isGroupChat && (
                <span className="text-green-100 text-xs ml-2">(Group)</span>
              )}
            </h4>
            <p className="text-green-100 text-xs">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Messages list - phone style */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.map((msg, index) => {
            const isOutbound = msg.direction === "outbound";
            const msgText =
              msg.body_text ||
              msg.body_plain ||
              ("body" in msg ? (msg as { body?: string }).body : "") ||
              "";
            const msgTime = new Date(msg.sent_at || msg.received_at || 0);

            // Get sender info for group chats
            const senderPhone = getSenderPhone(msg);
            let senderName: string | undefined;
            let showSender = false;

            if (isGroupChat && senderPhone && !isOutbound) {
              const normalized = normalizePhoneForLookup(senderPhone);
              senderName =
                contactNames[senderPhone] ||
                contactNames[normalized] ||
                senderPhone;

              // Show sender if different from previous message
              if (index === 0) {
                showSender = true;
              } else {
                const prevSender = getSenderPhone(sortedMessages[index - 1]);
                if (prevSender) {
                  const prevNormalized = normalizePhoneForLookup(prevSender);
                  showSender = normalized !== prevNormalized;
                } else {
                  showSender = true;
                }
              }
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isOutbound
                      ? "bg-green-500 text-white rounded-br-md"
                      : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                  }`}
                >
                  {showSender && senderName && (
                    <p className="text-xs font-semibold text-green-600 mb-1">
                      {senderName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msgText || "(No content)"}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isOutbound ? "text-green-100" : "text-gray-400"
                    }`}
                  >
                    {formatMessageTime(msgTime)}
                  </p>
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

export default ConversationViewModal;
