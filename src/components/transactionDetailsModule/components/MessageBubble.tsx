/**
 * MessageBubble Component
 * Displays an individual message in chat bubble format.
 * Inbound messages are left-aligned, outbound are right-aligned.
 * Supports special message types: voice, location, attachment-only, system.
 */
import React from "react";
import { Mic, MapPin, Paperclip } from "lucide-react";
import { AudioPlayer } from "@/components/common/AudioPlayer";
import type { Communication } from "../types";
import type { MessageType } from "@/types";
import { isEmptyOrReplacementChar } from "../../../utils/messageFormatUtils";

export interface MessageBubbleProps {
  /** The message to display */
  message: Communication;
  /** Sender name to display above inbound messages (for group chats) */
  senderName?: string;
  /** Whether to show sender name (hide if same as previous message) */
  showSender?: boolean;
  /** Path to the audio file for voice messages (storage_path from Attachment) */
  attachmentPath?: string;
}

/**
 * Format timestamp for display within message bubble.
 * Shows time only (e.g., "2:30 PM") for a compact display.
 * Note: Different from formatMessageTime in messageFormatUtils which shows date+time.
 */
function formatMessageTime(timestamp: string | Date | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Icon component type for message type indicators
 */
type IconComponent = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/**
 * Content configuration for different message types
 */
interface MessageContent {
  /** Text label shown as indicator (e.g., "Voice Message") */
  indicator: string | null;
  /** The main text content to display */
  displayText: string;
  /** Icon component to show with the indicator */
  Icon: IconComponent | null;
}

/**
 * Get display content configuration based on message type
 * Determines what indicator, text, and icon to show for each message type
 *
 * @param message - The communication message
 * @param messageType - The detected message type
 * @param rawText - The raw text content (body_text || body_plain || body)
 * @param legacyFallbackText - Fallback text for backward compatibility when message_type is undefined
 */
function getMessageContent(
  message: Communication,
  messageType: MessageType,
  rawText: string,
  legacyFallbackText: string
): MessageContent {
  // Check if text is effectively empty
  const hasText = rawText && !isEmptyOrReplacementChar(rawText);

  switch (messageType) {
    case "voice_message":
      return {
        indicator: "Voice Message",
        // Voice message transcript is stored in body_text
        displayText: hasText ? rawText : "[No transcript available]",
        Icon: Mic,
      };

    case "location":
      return {
        indicator: "Location Shared",
        displayText: hasText ? rawText : "Location information",
        Icon: MapPin,
      };

    case "attachment_only":
      return {
        indicator: "Media Attachment",
        displayText: getAttachmentDescription(message),
        Icon: Paperclip,
      };

    case "system":
      return {
        indicator: null,
        displayText: rawText || "",
        Icon: null,
      };

    case "text":
    case "unknown":
    default:
      return {
        indicator: null,
        displayText: legacyFallbackText,
        Icon: null,
      };
  }
}

/**
 * Generate a description for attachment-only messages
 */
function getAttachmentDescription(message: Communication): string {
  // If we have attachment count from metadata, use it
  if (message.has_attachments) {
    // Could potentially extract more info from metadata in the future
    return "Attachment";
  }
  return "Attachment";
}

/**
 * MessageBubble component for displaying individual messages.
 * Uses chat-style bubble UI with inbound/outbound distinction.
 * Supports special message types: voice, location, attachment-only, system.
 */
export function MessageBubble({ message, senderName, showSender = true, attachmentPath }: MessageBubbleProps): React.ReactElement {
  const isOutbound = message.direction === "outbound";
  const messageType: MessageType = message.message_type || "text";

  // Use body_text as primary, body_plain as fallback (per SR Engineer guidance)
  const rawText = message.body_text || message.body_plain || message.body || "";

  // Check if this is an attachment-only message (text is empty or just replacement char)
  const isAttachmentOnly = message.has_attachments && isEmptyOrReplacementChar(rawText);

  // Check if message has no displayable content at all
  const hasNoContent = isEmptyOrReplacementChar(rawText);

  // For legacy compatibility: if message_type is not set, use the old logic
  const legacyFallbackText = isAttachmentOnly
    ? "[Attachment]"
    : hasNoContent
      ? "[Message content unavailable]"
      : rawText;

  // Get content configuration based on message type
  const { indicator, displayText, Icon } = getMessageContent(message, messageType, rawText, legacyFallbackText);

  // Get timestamp - prefer sent_at for outbound, received_at for inbound
  const timestamp = isOutbound
    ? message.sent_at || message.received_at
    : message.received_at || message.sent_at;

  // Build the timestamp line with optional sender name
  const timestampDisplay = timestamp ? formatMessageTime(timestamp) : "";
  const senderDisplay = !isOutbound && senderName && showSender ? senderName : null;

  // Indicator styling classes
  const indicatorClasses = isOutbound ? "text-blue-100" : "text-gray-600";

  // System messages get special centered, muted styling
  if (messageType === "system") {
    return (
      <div
        className="flex flex-col items-center w-full"
        data-testid="message-bubble"
        data-direction={message.direction}
        data-message-type={messageType}
      >
        <div
          className="text-center text-xs text-gray-500 italic py-1 px-4"
          role="status"
          aria-label="System message"
        >
          {displayText}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
      data-testid="message-bubble"
      data-direction={message.direction}
      data-message-type={messageType}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-200 text-gray-900 rounded-bl-sm"
        }`}
      >
        {/* Special message type indicator with icon */}
        {indicator && (
          <div
            className={`flex items-center gap-1.5 mb-1 ${indicatorClasses} italic opacity-90`}
            data-testid="message-type-indicator"
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden={true} />}
            <span className="font-medium text-sm">{indicator}</span>
          </div>
        )}

        {/* Message content */}
        <p
          className={`text-sm whitespace-pre-wrap break-words ${
            (isAttachmentOnly || hasNoContent || messageType === "attachment_only")
              ? "italic text-opacity-75"
              : ""
          }`}
        >
          {displayText}
        </p>

        {/* Audio player for voice messages */}
        {messageType === "voice_message" && attachmentPath && (
          <AudioPlayer
            src={attachmentPath}
            className="mt-2"
          />
        )}

        {/* Timestamp and sender info */}
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
