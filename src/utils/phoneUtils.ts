/**
 * Phone Number Utilities (Frontend)
 *
 * Pure utility functions for phone number handling.
 * No Node.js or Electron dependencies - safe for browser use.
 */

/**
 * Extract only digit characters from a phone number.
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Normalize phone number by removing all non-digit characters.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  return extractDigits(phone);
}

/**
 * Gets the last N digits of a phone number for fuzzy matching.
 */
export function getTrailingDigits(
  phone: string | null | undefined,
  count: number = 10
): string {
  const digits = extractDigits(phone);
  return digits.slice(-count);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  if (phone.includes("@")) {
    return phone;
  }

  const cleaned = normalizePhoneNumber(phone);

  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  } else {
    return cleaned || phone;
  }
}

/**
 * Check if two phone numbers match (after normalization).
 */
export function phoneNumbersMatch(
  phone1: string | null | undefined,
  phone2: string | null | undefined,
): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) return false;
  if (normalized1 === normalized2) return true;

  if (normalized1.length >= 10 && normalized2.length >= 10) {
    const suffix1 = normalized1.slice(-10);
    const suffix2 = normalized2.slice(-10);
    return suffix1 === suffix2 || normalized1.endsWith(suffix2) || normalized2.endsWith(suffix1);
  }

  return false;
}

/**
 * Checks if a string looks like a phone number rather than an email.
 */
export function isPhoneNumber(handle: string | null | undefined): boolean {
  if (!handle) return false;
  if (handle.includes("@")) return false;
  const digits = extractDigits(handle);
  return digits.length >= 7;
}
