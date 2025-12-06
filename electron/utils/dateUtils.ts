/**
 * Date Utilities
 * Handles date formatting and conversion, especially for macOS timestamps
 */

import { MAC_EPOCH } from "../constants";

/**
 * Convert macOS timestamp (nanoseconds since 2001-01-01) to JavaScript Date
 * @param macTimestamp - macOS timestamp in nanoseconds
 * @returns JavaScript Date object
 */
export function macTimestampToDate(
  macTimestamp: number | null | undefined,
): Date {
  if (!macTimestamp) {
    return new Date(0);
  }
  // Mac timestamps are in nanoseconds since 2001-01-01, convert to milliseconds
  return new Date(MAC_EPOCH + macTimestamp / 1000000);
}

/**
 * Get timestamp from N years ago
 * @param years - Number of years to go back
 * @returns Timestamp in milliseconds
 */
export function getYearsAgoTimestamp(years: number): number {
  return Date.now() - years * 365 * 24 * 60 * 60 * 1000;
}

/**
 * Format date for file names (YYYYMMDD_HHMMSS)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
