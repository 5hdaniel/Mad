/**
 * Date range formatting utilities.
 * Extracted from TransactionMessagesTab, ConversationViewModal, AttachEmailsModal, EmailThreadCard.
 * TASK-2029: Renderer-side utility deduplication.
 */

/**
 * Format a date range for display in filter/toggle labels.
 * Handles partial dates (only start, only end, or both).
 * BACKLOG-393: Includes year in date format for clarity.
 *
 * @param startDate - Start of the range, or null if open-ended
 * @param endDate - End of the range, or null if ongoing
 * @returns Formatted string like "Jan 1, 2025 - Mar 15, 2025" or "Jan 1, 2025 - Ongoing"
 */
export function formatDateRangeLabel(startDate: Date | null, endDate: Date | null): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  } else if (startDate) {
    return `${formatDate(startDate)} - Ongoing`;
  } else if (endDate) {
    return `Through ${formatDate(endDate)}`;
  }
  return "";
}

/**
 * Format a date range for display on thread cards.
 * Both dates are required (thread always has a start and end).
 * Shows a single date when start and end are the same day.
 *
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @returns Formatted string like "Jan 1, 2025 - Mar 15, 2025" or "Jan 1, 2025"
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
