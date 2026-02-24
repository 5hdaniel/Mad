import logger from './logger';
/**
 * Date formatting utilities for the frontend
 */

/**
 * Parse a date value with Windows timezone fix.
 * On Windows, YYYY-MM-DD strings are parsed as local time to avoid off-by-one errors.
 *
 * Background: JavaScript's `new Date("2025-01-08")` parses as UTC midnight.
 * In US timezones (UTC-5 to UTC-8), this displays as January 7th.
 * This function fixes that by parsing date-only strings as local time on Windows.
 *
 * @param dateValue - Date, string, null, or undefined
 * @param logContext - Optional context string for warning messages
 * @returns Parsed Date or null if invalid/missing
 */
export function parseDateSafe(
  dateValue: Date | string | null | undefined,
  logContext?: string
): Date | null {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // For date-only strings (YYYY-MM-DD) on Windows, parse as local time
  // Only apply on Windows to avoid breaking Mac which was working correctly
  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
  if (isWindows) {
    const dateOnlyMatch = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // For other formats or on Mac, use standard parsing
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) {
    if (logContext) {
      logger.warn(`[${logContext}] Invalid date:`, dateValue);
    }
    return null;
  }
  return d;
}

/**
 * Format MAC timestamp for display as relative or absolute date
 * @param timestamp - MAC timestamp (nanoseconds since 2001-01-01)
 * @returns Formatted date string
 */
export function formatMessageDate(timestamp: number | Date | string): string {
  if (!timestamp) return "No messages";

  // Convert Mac timestamp to readable date
  const macEpoch = new Date("2001-01-01T00:00:00Z").getTime();
  const timestampNum = typeof timestamp === "number" ? timestamp : 0;
  const date = new Date(macEpoch + timestampNum / 1000000);

  // Compare calendar days, not just time differences
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffTime = today.getTime() - messageDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}
