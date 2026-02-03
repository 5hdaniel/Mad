/**
 * Message Type Detection Utility (TASK-1799)
 *
 * Determines the type of a message based on its content and attachments.
 * Used during iPhone sync and macOS import to classify messages for UI display.
 *
 * This utility is stateless and pure for easy testing.
 */

import type { MessageType } from "../types/models";

/**
 * Input for message type detection
 * Keeps the function pure by accepting only the data needed for classification
 */
export interface MessageTypeInput {
  /** Message text content (may be null/empty) */
  text?: string | null;
  /** Whether the message has an audio transcript (voice message indicator) */
  hasAudioTranscript?: boolean;
  /** MIME type of the primary attachment (if any) */
  attachmentMimeType?: string | null;
  /** Number of attachments on the message */
  attachmentCount?: number;
}

/**
 * Patterns that indicate location sharing messages
 */
const LOCATION_PATTERNS: RegExp[] = [
  /started sharing location/i,
  /stopped sharing location/i,
  /shared a location/i,
  /shared location/i,
  /current location/i,
  /maps\.(google|apple)\.com/i,
  // Pin emoji often indicates location
  /\u{1F4CD}/u, // Red pin emoji
];

/**
 * Patterns that indicate system messages
 * These are typically automated messages from the messaging service
 */
const SYSTEM_PATTERNS: RegExp[] = [
  /^You named the conversation/i,
  /^You set the group photo/i,
  /^You removed/i,
  /^You added/i,
  /changed the group/i,
  /left the conversation/i,
  /joined the conversation/i,
  /^Message not delivered/i,
  /^Delivered$/i,
  /^Read$/i,
  /^Sent$/i,
];

/**
 * Determine the type of a message based on its content and attachments
 *
 * Detection priority:
 * 1. Voice message (has audio transcript OR audio attachment)
 * 2. Location (matches location patterns in text)
 * 3. Attachment only (has attachments but no meaningful text)
 * 4. System (matches system message patterns)
 * 5. Text (has text content)
 * 6. Unknown (fallback)
 *
 * @param input - Message data for classification
 * @returns The detected message type
 */
export function detectMessageType(input: MessageTypeInput): MessageType {
  const { text, hasAudioTranscript, attachmentMimeType, attachmentCount = 0 } = input;

  // 1. Voice message detection
  // Has audio transcript (from iOS/macOS voice message transcription)
  if (hasAudioTranscript) {
    return "voice_message";
  }

  // Has audio attachment (typical for voice messages)
  if (attachmentMimeType?.startsWith("audio/")) {
    return "voice_message";
  }

  const trimmedText = text?.trim() || "";

  // 2. Location detection
  if (trimmedText && LOCATION_PATTERNS.some((pattern) => pattern.test(trimmedText))) {
    return "location";
  }

  // 3. Attachment only detection
  // Has attachments but no meaningful text content
  if (attachmentCount > 0 && !trimmedText) {
    return "attachment_only";
  }

  // 4. System message detection
  if (trimmedText && SYSTEM_PATTERNS.some((pattern) => pattern.test(trimmedText))) {
    return "system";
  }

  // 5. Regular text message
  if (trimmedText) {
    return "text";
  }

  // 6. Fallback for messages with no content and no attachments
  return "unknown";
}

/**
 * Check if a MIME type indicates an audio file
 * Useful for determining if an attachment is a voice message
 *
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is an audio type
 */
export function isAudioMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("audio/");
}
