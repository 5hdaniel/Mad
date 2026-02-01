/**
 * Contact Sorting Utilities
 *
 * Provides helpers for sorting contacts by various criteria.
 * @see TASK-1770: Sort Contacts by Most Recent Communication
 */
import type { ExtendedContact } from "../types/components";

/**
 * Sorts contacts by most recent communication first.
 * Contacts without last_communication_at are placed at the end.
 *
 * @param contacts - Array of contacts to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortByRecentCommunication<
  T extends Pick<ExtendedContact, "last_communication_at">
>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    const aTime = parseDate(a.last_communication_at);
    const bTime = parseDate(b.last_communication_at);

    // Most recent first (descending)
    return bTime - aTime;
  });
}

/**
 * Parses a date value (string, Date, or null/undefined) to a timestamp.
 * Returns 0 for invalid or missing dates (places them at the end when sorting descending).
 *
 * @param dateValue - The date value to parse
 * @returns Timestamp in milliseconds, or 0 for invalid/missing dates
 */
function parseDate(dateValue: string | Date | null | undefined): number {
  if (!dateValue) {
    return 0;
  }

  if (dateValue instanceof Date) {
    const time = dateValue.getTime();
    return isNaN(time) ? 0 : time;
  }

  // Handle string dates
  const parsed = new Date(dateValue);
  const time = parsed.getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Sorts contacts alphabetically by name (case-insensitive).
 * Fallback sort when no communication data available.
 *
 * @param contacts - Array of contacts to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortByName<T extends Pick<ExtendedContact, "name">>(
  contacts: T[]
): T[] {
  return [...contacts].sort((a, b) => {
    const aName = (a.name || "").toLowerCase();
    const bName = (b.name || "").toLowerCase();
    return aName.localeCompare(bName);
  });
}
