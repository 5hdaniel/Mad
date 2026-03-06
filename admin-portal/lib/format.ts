/**
 * Shared date formatting utilities for the admin portal.
 *
 * Centralizes date/timestamp display so all tables and cards
 * render dates consistently.
 */

/**
 * Formats a date string as a short date (e.g. "Jan 1, 2024").
 *
 * @param dateStr - ISO date string, or null/undefined
 * @param fallback - Value to return when dateStr is falsy (default: 'Unknown')
 */
export function formatDate(dateStr: string | null | undefined, fallback = 'Unknown'): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a date string as a full timestamp (e.g. "Jan 1, 2024, 12:00:00 PM").
 *
 * @param dateStr - ISO date string, or null/undefined
 * @param fallback - Value to return when dateStr is falsy (default: 'Unknown')
 */
export function formatTimestamp(dateStr: string | null | undefined, fallback = 'Unknown'): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
