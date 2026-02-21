/**
 * Message formatting utilities.
 * Extracted from ConversationViewModal and MessageBubble.
 * TASK-2029: Renderer-side utility deduplication.
 */

/**
 * Check if text is empty or only contains the object replacement character.
 * macOS uses U+FFFC as a placeholder for attachments in message text.
 *
 * @param text - The message text to check
 * @returns true if text is empty, whitespace-only, or only contains replacement characters
 */
export function isEmptyOrReplacementChar(text: string): boolean {
  if (!text) return true;
  // U+FFFC is the Object Replacement Character, U+FFFD is the Replacement Character
  const cleaned = text.replace(/[\uFFFC\uFFFD\s]/g, "");
  return cleaned.length === 0;
}

/**
 * Format a Date object as a message timestamp.
 * Shows month, day, hour, and minute (e.g., "Jan 5, 2:30 PM").
 * Used in ConversationViewModal for chat-style message display.
 *
 * @param date - The Date object to format
 * @returns Formatted time string
 */
export function formatMessageTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
