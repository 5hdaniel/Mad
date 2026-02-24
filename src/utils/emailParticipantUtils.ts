/**
 * Email participant formatting utilities.
 * Extracted from AttachEmailsModal and EmailThreadCard.
 * TASK-2029: Renderer-side utility deduplication.
 */

/**
 * Filter out the logged-in user's email from a participant list.
 * Handles both "Name <email>" format and bare email addresses.
 *
 * @param participants - Array of participant strings
 * @param userEmail - The current user's email to filter out
 * @returns Participants without the current user
 */
export function filterSelfFromParticipants(participants: string[], userEmail?: string): string[] {
  if (!userEmail) return participants;
  const normalizedUser = userEmail.toLowerCase().trim();
  return participants.filter(p => {
    const match = p.match(/<([^>]+)>/);
    const email = match ? match[1].toLowerCase() : p.toLowerCase().trim();
    return email !== normalizedUser;
  });
}

/**
 * Format participant list for display (show first few, then "+X more").
 * Extracts names from "Name <email>" format and capitalizes email prefixes.
 * Deduplicates by resolved name.
 *
 * @param participants - Array of participant strings
 * @param maxShow - Maximum number of names to show before "+X more" (default: 2)
 * @returns Formatted string like "Alice, Bob +3"
 */
export function formatParticipants(participants: string[], maxShow: number = 2): string {
  if (participants.length === 0) return "Unknown";

  // Extract names from email addresses where possible
  const names = participants.map(p => {
    // Try "Name <email>" format first
    const nameMatch = p.match(/^([^<]+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== p) return name;
    }
    // Extract email prefix and capitalize (e.g. "madison.delvigo" -> "Madison Delvigo")
    const atIndex = p.indexOf("@");
    const prefix = atIndex > 0 ? p.substring(0, atIndex) : p;
    return prefix
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  });

  // Deduplicate
  const unique = [...new Set(names)];

  if (unique.length <= maxShow) {
    return unique.join(", ");
  }
  return `${unique.slice(0, maxShow).join(", ")} +${unique.length - maxShow}`;
}
