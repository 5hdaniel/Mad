/**
 * Phone Number Utilities
 * Handles phone number normalization and formatting
 *
 * BACKLOG-1083: normalizePhoneNumber now produces E.164-ish format (+digits)
 * consistent with phoneNormalization.ts to prevent lookup mismatches.
 */

import { REGEX_PATTERNS } from "../constants";

/**
 * Normalize phone number to E.164-ish format for consistent matching.
 * Preserves email handles as lowercase.
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number with + prefix (E.164-ish) or empty string
 *
 * @example
 * normalizePhoneNumber('(555) 123-4567')  // '+15551234567'
 * normalizePhoneNumber('+1 555 123 4567') // '+15551234567'
 * normalizePhoneNumber('5551234567')      // '+15551234567'
 * normalizePhoneNumber('user@email.com')  // 'user@email.com'
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.includes("@")) return phone.toLowerCase();

  // Remove all non-digit characters
  let digits = phone.replace(REGEX_PATTERNS.PHONE_NORMALIZE, "");

  if (!digits) return "";

  // Handle US numbers (10 digits without country code)
  if (digits.length === 10) {
    digits = "1" + digits;
  }

  // Return with + prefix (E.164-ish format)
  return "+" + digits;
}

/**
 * Extract just the digits from a phone number.
 * Useful when digits-only format is explicitly needed.
 * @param phone - Phone number string
 * @returns Only the digit characters
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(REGEX_PATTERNS.PHONE_NORMALIZE, "");
}

/**
 * Format phone number for display
 * Returns email as-is if it contains @, otherwise formats as US phone number
 * @param phone - Phone number or email to format
 * @returns Formatted phone number or email
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Check if it's an email
  if (phone.includes("@")) {
    return phone;
  }

  // Extract digits only for formatting (not E.164 normalization)
  const cleaned = extractDigits(phone);

  // Format based on length
  if (cleaned.length === 11 && cleaned[0] === "1") {
    // US number with country code: +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // US number without country code: (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 7) {
    // Local number: XXX-XXXX
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  } else {
    // Unknown format, return cleaned
    return cleaned || phone;
  }
}

/**
 * Check if two phone numbers match (after normalization)
 * Uses E.164 normalization for exact match, with suffix fallback for
 * numbers that may have different country code handling.
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if phone numbers match
 */
export function phoneNumbersMatch(
  phone1: string | null | undefined,
  phone2: string | null | undefined,
): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) return false;

  // Exact match after E.164 normalization
  if (normalized1 === normalized2) return true;

  // Fallback: match last 10 digits (handles country code differences)
  const digits1 = extractDigits(phone1);
  const digits2 = extractDigits(phone2);
  if (digits1.length >= 10 && digits2.length >= 10) {
    return digits1.slice(-10) === digits2.slice(-10);
  }

  return false;
}
