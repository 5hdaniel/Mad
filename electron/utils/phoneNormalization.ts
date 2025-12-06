/**
 * Phone Number Normalization Utilities
 *
 * Functions for normalizing and matching phone numbers across different formats.
 * Supports US and international phone numbers.
 */

/**
 * Normalizes a phone number to E.164-ish format for consistent matching.
 *
 * @param phone - Raw phone number string in any format
 * @returns Normalized phone number with + prefix and digits only
 *
 * @example
 * normalizePhoneNumber('(555) 123-4567')  // '+15551234567'
 * normalizePhoneNumber('+1 555 123 4567') // '+15551234567'
 * normalizePhoneNumber('5551234567')      // '+15551234567'
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle US numbers (10 digits without country code)
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Return with + prefix (E.164-ish format)
  return '+' + digits;
}

/**
 * Checks if two phone numbers match, accounting for country code differences.
 * Uses suffix matching to handle cases where country codes may differ.
 *
 * @param a - First phone number to compare
 * @param b - Second phone number to compare
 * @returns true if the phone numbers match
 *
 * @example
 * phoneNumbersMatch('(555) 123-4567', '+1 555 123 4567') // true
 * phoneNumbersMatch('5551234567', '15551234567')         // true
 * phoneNumbersMatch('+44 20 7946 0958', '2079460958')    // true
 */
export function phoneNumbersMatch(a: string, b: string): boolean {
  const normA = normalizePhoneNumber(a);
  const normB = normalizePhoneNumber(b);

  // Exact match after normalization
  if (normA === normB) {
    return true;
  }

  // Match if either is suffix of the other (handles country code differences)
  // Use last 10 digits for comparison
  const suffixLength = 10;
  const suffixA = normA.slice(-suffixLength);
  const suffixB = normB.slice(-suffixLength);

  return normA.endsWith(suffixB) || normB.endsWith(suffixA);
}

/**
 * Checks if a string looks like a phone number rather than an email.
 *
 * @param handle - The handle string to check (from message)
 * @returns true if the handle appears to be a phone number
 */
export function isPhoneNumber(handle: string): boolean {
  // If it contains @, it's likely an email
  if (handle.includes('@')) {
    return false;
  }

  // Count digits in the string
  const digitCount = (handle.match(/\d/g) || []).length;

  // Phone numbers typically have 7+ digits
  // and are mostly digits with some formatting characters
  return digitCount >= 7;
}

/**
 * Extracts just the digits from a phone number for indexing.
 * Useful for creating lookup keys.
 *
 * @param phone - Phone number string
 * @returns Only the digit characters
 */
export function extractDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Gets the last N digits of a phone number for fuzzy matching.
 *
 * @param phone - Phone number string
 * @param count - Number of trailing digits to return (default: 10)
 * @returns The last N digits of the phone number
 */
export function getTrailingDigits(phone: string, count: number = 10): string {
  const digits = extractDigits(phone);
  return digits.slice(-count);
}
