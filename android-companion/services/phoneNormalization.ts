/**
 * Phone Number Normalization (Android Companion)
 * Normalizes raw phone numbers to a consistent format for matching.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 *
 * The Electron desktop side (messageMatchingService.ts) does its own
 * normalization, so we aim for a best-effort E.164-ish format here.
 */

/**
 * Normalize a phone number to a consistent format.
 *
 * - Strips all non-digit characters (except leading +)
 * - Prepends +1 for 10-digit US numbers
 * - Keeps international numbers as-is if they already have a country code
 * - Returns the raw digits if normalization cannot determine the format
 *
 * @param raw - The raw phone number string from Android SMS content provider
 * @returns Normalized phone number string
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || raw.trim().length === 0) {
    return raw;
  }

  const trimmed = raw.trim();

  // Check if it starts with + (international format)
  const hasPlus = trimmed.startsWith("+");

  // Strip everything except digits
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    return raw;
  }

  // Already has country code with + prefix
  if (hasPlus) {
    return `+${digits}`;
  }

  // 11 digits starting with 1 — US/Canada with country code but no +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // 10 digits — assume US/Canada, prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 7 digits — local number, cannot reliably add country code
  // Return as-is with whatever prefix makes sense
  if (digits.length === 7) {
    return digits;
  }

  // For anything else (international numbers without +), return with +
  // This handles cases like "44xxxxxxxxxx" (UK) etc.
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Short codes or other formats — return digits only
  return digits;
}
