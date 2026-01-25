/**
 * Phone Number Utilities
 *
 * Consolidated phone normalization, formatting, and matching functions.
 * This module combines the functionality previously split between phoneUtils.ts
 * and phoneNormalization.ts (TASK-1201).
 *
 * Functions for normalizing and matching phone numbers across different formats.
 * Supports US and international phone numbers.
 */

import { REGEX_PATTERNS } from "../constants";

// ============================================
// CORE NORMALIZATION
// ============================================

/**
 * Extract only digit characters from a phone number.
 * Useful for creating lookup keys and basic normalization.
 *
 * @param phone - Phone number string (can include formatting)
 * @returns Only the digit characters
 *
 * @example
 * extractDigits("(555) 123-4567") // "5551234567"
 * extractDigits("+1 555 123 4567") // "15551234567"
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(REGEX_PATTERNS.PHONE_NORMALIZE, "");
}

/**
 * Normalize phone number by removing all non-digit characters.
 * This is the most commonly used normalization - simple digit extraction.
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number (digits only)
 *
 * @example
 * normalizePhoneNumber("(555) 123-4567") // "5551234567"
 * normalizePhoneNumber("+1-555-123-4567") // "15551234567"
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  return extractDigits(phone);
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

  // Remove all non-digits
  const cleaned = normalizePhoneNumber(phone);

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

// ============================================
// MATCHING & COMPARISON
// ============================================

/**
 * Gets the last N digits of a phone number for fuzzy matching.
 * Useful for matching numbers that may have different country codes.
 *
 * @param phone - Phone number string
 * @param count - Number of trailing digits to return (default: 10)
 * @returns The last N digits of the phone number
 *
 * @example
 * getTrailingDigits("15551234567") // "5551234567"
 * getTrailingDigits("5551234567", 7) // "1234567"
 */
export function getTrailingDigits(
  phone: string | null | undefined,
  count: number = 10
): string {
  const digits = extractDigits(phone);
  return digits.slice(-count);
}

/**
 * Check if two phone numbers match (after normalization).
 * Uses suffix matching to handle cases where country codes may differ.
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if phone numbers match
 *
 * @example
 * phoneNumbersMatch("(555) 123-4567", "+1 555 123 4567") // true
 * phoneNumbersMatch("5551234567", "15551234567") // true
 * phoneNumbersMatch("+44 20 7946 0958", "2079460958") // true (suffix match)
 */
export function phoneNumbersMatch(
  phone1: string | null | undefined,
  phone2: string | null | undefined,
): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) return false;

  // Exact match
  if (normalized1 === normalized2) return true;

  // Match last 10 digits (for numbers with/without country code)
  if (normalized1.length >= 10 && normalized2.length >= 10) {
    const suffix1 = normalized1.slice(-10);
    const suffix2 = normalized2.slice(-10);
    return suffix1 === suffix2 || normalized1.endsWith(suffix2) || normalized2.endsWith(suffix1);
  }

  return false;
}

// ============================================
// TYPE DETECTION
// ============================================

/**
 * Checks if a string looks like a phone number rather than an email.
 *
 * @param handle - The handle string to check (from message)
 * @returns true if the handle appears to be a phone number
 *
 * @example
 * isPhoneNumber("5551234567") // true
 * isPhoneNumber("test@example.com") // false
 */
export function isPhoneNumber(handle: string | null | undefined): boolean {
  if (!handle) return false;

  // If it contains @, it's likely an email
  if (handle.includes("@")) {
    return false;
  }

  // Count digits in the string
  const digits = extractDigits(handle);

  // Phone numbers typically have 7+ digits
  return digits.length >= 7;
}

// ============================================
// E.164 FORMAT (for database/contact storage)
// ============================================

/**
 * Normalizes a phone number to E.164-ish format for consistent storage.
 * Adds country code prefix (+1) for US numbers (10 digits).
 *
 * Note: Use this for storage/comparison in contact databases.
 * For simple matching, use normalizePhoneNumber() instead.
 *
 * @param phone - Raw phone number string in any format
 * @returns Normalized phone number with + prefix and digits only
 *
 * @example
 * normalizeToE164("(555) 123-4567") // "+15551234567"
 * normalizeToE164("+1 555 123 4567") // "+15551234567"
 * normalizeToE164("5551234567") // "+15551234567"
 * normalizeToE164("+44 20 7946 0958") // "+442079460958"
 */
export function normalizeToE164(phone: string | null | undefined): string {
  if (!phone) return "+";

  // Remove all non-digit characters
  let digits = extractDigits(phone);

  // Handle US numbers (10 digits without country code)
  if (digits.length === 10) {
    digits = "1" + digits;
  }

  // Return with + prefix (E.164-ish format)
  return "+" + digits;
}
