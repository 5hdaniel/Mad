/**
 * Phone Number Utilities
 * Handles phone number normalization and formatting
 */

const { REGEX_PATTERNS } = require('../constants');

/**
 * Normalize phone number by removing all non-digit characters
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number (digits only)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(REGEX_PATTERNS.PHONE_NORMALIZE, '');
}

/**
 * Format phone number for display
 * Returns email as-is if it contains @, otherwise formats as US phone number
 * @param {string} phone - Phone number or email to format
 * @returns {string} Formatted phone number or email
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Check if it's an email
  if (phone.includes('@')) {
    return phone;
  }

  // Remove all non-digits
  const cleaned = normalizePhoneNumber(phone);

  // Format based on length
  if (cleaned.length === 11 && cleaned[0] === '1') {
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
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} True if phone numbers match
 */
function phoneNumbersMatch(phone1, phone2) {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) return false;

  // Exact match
  if (normalized1 === normalized2) return true;

  // Match last 10 digits (for numbers with/without country code)
  if (normalized1.length >= 10 && normalized2.length >= 10) {
    return normalized1.slice(-10) === normalized2.slice(-10);
  }

  return false;
}

module.exports = {
  normalizePhoneNumber,
  formatPhoneNumber,
  phoneNumbersMatch
};
