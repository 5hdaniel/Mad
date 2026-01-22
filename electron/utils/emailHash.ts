/**
 * Email Content Hash Utility
 *
 * Computes SHA-256 hash of email content for deduplication fallback
 * when Message-ID header is unavailable or unreliable.
 *
 * @module electron/utils/emailHash
 * @see TASK-918
 */
import * as crypto from "crypto";

/**
 * Input interface for computing email content hash
 */
export interface EmailHashInput {
  subject?: string | null;
  from?: string | null;
  sentDate?: Date | string | null;
  bodyPlain?: string | null;
}

/**
 * Compute a SHA-256 content hash for an email
 *
 * The hash is computed from normalized versions of:
 * - subject (lowercase, trimmed)
 * - from (lowercase, trimmed)
 * - sentDate (ISO string format)
 * - bodyPlain (first 500 characters, trimmed)
 *
 * Missing fields are handled gracefully by using empty strings.
 *
 * @param email - Email fields to hash
 * @returns SHA-256 hex digest of the combined content
 *
 * @example
 * ```typescript
 * const hash = computeEmailHash({
 *   subject: "RE: Property Closing",
 *   from: "agent@example.com",
 *   sentDate: new Date("2024-01-15T10:30:00Z"),
 *   bodyPlain: "Hello, the closing is scheduled for..."
 * });
 * // Returns: "a1b2c3..." (64-char hex string)
 * ```
 */
export function computeEmailHash(email: EmailHashInput): string {
  // Normalize fields - handle null/undefined gracefully
  const subject = normalizeField(email.subject);
  const from = normalizeField(email.from);
  const sentDate = normalizeDateField(email.sentDate);
  const bodySnippet = normalizeBodyField(email.bodyPlain, 500);

  // Combine fields with delimiter (pipe character)
  const content = [subject, from, sentDate, bodySnippet].join("|");

  // Compute SHA-256 hash
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Normalize a string field for hashing
 * - Converts to lowercase
 * - Trims whitespace
 * - Returns empty string for null/undefined
 */
function normalizeField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return value.trim().toLowerCase();
}

/**
 * Normalize a date field for hashing
 * - Converts to ISO string format
 * - Returns empty string for invalid/null dates
 */
function normalizeDateField(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  try {
    const date = value instanceof Date ? value : new Date(value);
    // Check for invalid date
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString();
  } catch {
    return "";
  }
}

/**
 * Normalize body field for hashing
 * - Truncates to specified max length
 * - Trims whitespace
 * - Returns empty string for null/undefined
 */
function normalizeBodyField(
  value: string | null | undefined,
  maxLength: number,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  return value.slice(0, maxLength).trim();
}
