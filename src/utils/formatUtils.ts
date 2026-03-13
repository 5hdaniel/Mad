/**
 * Shared formatting utilities for the renderer.
 * Extracted from AttachmentCard, EmailViewModal, AttachmentPreviewModal, EmailThreadViewModal.
 * TASK-2029: Renderer-side utility deduplication.
 * TASK-C / BACKLOG-266: Consolidated formatDate and formatCurrency.
 */

/**
 * Format file size in human-readable format.
 * Handles null input for cases where file size is unknown.
 *
 * @param bytes - File size in bytes, or null if unknown
 * @returns Human-readable string like "1.2 MB", "0 B", or "" if null
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================
// DATE FORMATTING
// ============================================

interface FormatDateOptions {
  /** String to return when the input is null/undefined/invalid. Defaults to "N/A". */
  fallback?: string;
  /** Whether to include the year in the formatted output. Defaults to true. */
  includeYear?: boolean;
}

/**
 * Format a date string or Date object for display.
 * Consolidated from Transactions, TransactionList, StartNewAuditModal,
 * DeviceLimitScreen, AttachmentCard, AttachMessagesModal.
 *
 * @param dateString - A date string, Date object, or nullish value
 * @param options - Formatting options (fallback text, whether to include year)
 * @returns Formatted date string like "Jan 1, 2025" or the fallback value
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  options?: FormatDateOptions,
): string {
  const { fallback = "N/A", includeYear = true } = options ?? {};

  if (!dateString) return fallback;

  try {
    const date =
      typeof dateString === "string" ? new Date(dateString) : dateString;

    // Guard against Invalid Date
    if (isNaN(date.getTime())) return fallback;

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      ...(includeYear && { year: "numeric" }),
    };

    return date.toLocaleDateString("en-US", formatOptions);
  } catch {
    return fallback;
  }
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format a number as US currency (USD) with no decimal places.
 * Consolidated from Transactions, TransactionList, StartNewAuditModal.
 *
 * @param amount - The dollar amount, or null/undefined if unknown
 * @param fallback - String to return when the input is falsy. Defaults to "N/A".
 * @returns Formatted string like "$1,250" or the fallback value
 */
export function formatCurrency(
  amount: number | null | undefined,
  fallback: string = "N/A",
): string {
  if (amount === null || amount === undefined) return fallback;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}
