/**
 * MessageBubble Component
 * Displays an individual message in chat bubble format.
 * Inbound messages are left-aligned, outbound are right-aligned.
 */
import React from "react";
import type { Communication } from "../types";

export interface MessageBubbleProps {
  /** The message to display */
  message: Communication;
  /** Sender name to display above inbound messages (for group chats) */
  senderName?: string;
  /** Whether to show sender name (hide if same as previous message) */
  showSender?: boolean;
}

/**
 * Format timestamp for display within message bubble.
 * Shows time only (e.g., "2:30 PM") for a compact display.
 */
function formatMessageTime(timestamp: string | Date | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}


/**
 * MessageBubble component for displaying individual messages.
 * Uses chat-style bubble UI with inbound/outbound distinction.
 */
export function MessageBubble({ message, senderName, showSender = true }: MessageBubbleProps): React.ReactElement {
  const isOutbound = message.direction === "outbound";

  // Use body_text as primary, body_plain as fallback (per SR Engineer guidance)
  const messageText = message.body_text || message.body_plain || message.body || "";

  // Get timestamp - prefer sent_at for outbound, received_at for inbound
  const timestamp = isOutbound
    ? message.sent_at || message.received_at
    : message.received_at || message.sent_at;

  // Build the timestamp line with optional sender name
  const timestampDisplay = timestamp ? formatMessageTime(timestamp) : "";
  const senderDisplay = !isOutbound && senderName && showSender ? senderName : null;

  return (
    <div
      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
      data-testid="message-bubble"
      data-direction={message.direction}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-200 text-gray-900 rounded-bl-sm"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>
        {(timestampDisplay || senderDisplay) && (
          <p
            className={`text-xs mt-1 ${
              isOutbound ? "text-blue-100" : "text-gray-500"
            }`}
            data-testid="message-timestamp"
          >
            {senderDisplay && (
              <span data-testid="message-sender" className="font-medium">
                {senderDisplay}
                {timestampDisplay && " • "}
              </span>
            )}
            {timestampDisplay}
          </p>
        )}
      </div>
    </div>
  );
}
