/**
 * Avatar initial generation utilities.
 * Extracted from MessageThreadCard, EmailThreadCard, EmailThreadViewModal, AttachEmailsModal.
 * TASK-2029: Renderer-side utility deduplication.
 *
 * Two variants exist because text messages and emails use different data:
 * - Text messages have contactName + phoneNumber
 * - Emails have sender strings in "Name <email>" format
 */

/**
 * Get avatar initial from an email sender string.
 * Parses "Name <email@example.com>" format to extract the first character of the name.
 * Falls back to the first character of the email address before @.
 *
 * Used by: EmailThreadCard, EmailThreadViewModal, AttachEmailsModal.
 *
 * @param sender - Sender string, e.g. "Alice Smith <alice@example.com>" or "alice@example.com"
 * @returns Single uppercase character, or "?" if sender is empty/null
 */
export function getEmailAvatarInitial(sender?: string | null): string {
  if (!sender) return "?";

  // Try to get name from email format "Name <email@example.com>"
  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) {
      return name.charAt(0).toUpperCase();
    }
  }

  // Extract first character from email before @
  const atIndex = sender.indexOf("@");
  if (atIndex > 0) {
    return sender.charAt(0).toUpperCase();
  }

  return sender.charAt(0).toUpperCase();
}

/**
 * Get avatar initial from a contact name or phone number.
 * Returns first character of contact name, or "#" for phone-number-only contacts.
 *
 * Used by: MessageThreadCard.
 *
 * @param contactName - The resolved contact name, if available
 * @param phoneNumber - The phone number (used as fallback indicator)
 * @returns Single uppercase character, or "#" if only phone number is available
 */
export function getContactAvatarInitial(contactName?: string, phoneNumber?: string): string {
  if (contactName && contactName.trim().length > 0) {
    return contactName.trim().charAt(0).toUpperCase();
  }
  // If phone number, just show hash
  return "#";
}
