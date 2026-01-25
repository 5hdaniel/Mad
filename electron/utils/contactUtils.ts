/**
 * Contact Utilities
 *
 * Shared contact name lookup and formatting functions.
 * Extracted from pdfExportService.ts and folderExportService.ts (TASK-1201).
 */

import { dbAll } from "../services/db/core/dbConnection";
import logService from "../services/logService";
import { getTrailingDigits, isPhoneNumber } from "./phoneUtils";

// ============================================
// CONTACT NAME LOOKUP
// ============================================

/**
 * Look up contact names for phone numbers (synchronous).
 * Queries the contact_phones table to find display names for phone numbers.
 *
 * @param phones - Array of phone numbers to look up
 * @returns Map of normalized phone -> display_name
 *
 * @example
 * const nameMap = getContactNamesByPhones(["+15551234567", "5559876543"]);
 * // Returns: { "5551234567": "John Doe", "5559876543": "Jane Smith" }
 */
export function getContactNamesByPhones(
  phones: string[]
): Record<string, string> {
  if (phones.length === 0) return {};

  try {
    // Normalize phones to last 10 digits for matching
    const normalizedPhones = phones.map((p) => getTrailingDigits(p, 10));

    // Query contact_phones to find names
    const placeholders = normalizedPhones.map(() => "?").join(",");
    const sql = `
      SELECT
        cp.phone_e164,
        cp.phone_display,
        c.display_name
      FROM contact_phones cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE SUBSTR(REPLACE(cp.phone_e164, '+', ''), -10) IN (${placeholders})
         OR SUBSTR(REPLACE(cp.phone_display, '-', ''), -10) IN (${placeholders})
    `;

    const results = dbAll<{
      phone_e164: string;
      phone_display: string;
      display_name: string;
    }>(sql, [...normalizedPhones, ...normalizedPhones]);

    const nameMap: Record<string, string> = {};
    for (const row of results) {
      // Map both original and normalized forms
      const e164Normalized = getTrailingDigits(row.phone_e164, 10);
      const displayNormalized = getTrailingDigits(row.phone_display, 10);
      nameMap[e164Normalized] = row.display_name;
      nameMap[displayNormalized] = row.display_name;
      nameMap[row.phone_e164] = row.display_name;
      nameMap[row.phone_display] = row.display_name;
    }

    return nameMap;
  } catch (error) {
    logService.warn(
      "[ContactUtils] Failed to look up contact names",
      "ContactUtils",
      { error }
    );
    return {};
  }
}

// ============================================
// CONTACT NAME RESOLUTION
// ============================================

/**
 * Resolve a phone number to a contact name from a pre-built map.
 * Tries direct lookup, then normalized lookup.
 *
 * @param phone - Phone number to look up
 * @param nameMap - Map of phone -> name (from getContactNamesByPhones)
 * @returns Contact name or null if not found
 */
export function resolveContactName(
  phone: string | null | undefined,
  nameMap: Record<string, string>
): string | null {
  if (!phone) return null;

  // Try direct lookup
  if (nameMap[phone]) {
    return nameMap[phone];
  }

  // Try normalized phone lookup
  const normalized = getTrailingDigits(phone, 10);
  if (nameMap[normalized]) {
    return nameMap[normalized];
  }

  // Try matching against all normalized keys in the map
  for (const [key, name] of Object.entries(nameMap)) {
    if (getTrailingDigits(key, 10) === normalized) {
      return name;
    }
  }

  return null;
}

// ============================================
// SENDER FORMATTING
// ============================================

/**
 * Format phone number or resolve to contact name for display.
 * If a name is found, returns "Name (phone)". Otherwise returns the original sender.
 *
 * @param sender - Sender identifier (phone number or email)
 * @param nameMap - Map of phone -> name (from getContactNamesByPhones)
 * @returns Formatted sender string
 *
 * @example
 * formatSenderName("+15551234567", { "5551234567": "John Doe" })
 * // Returns: "John Doe (+15551234567)"
 */
export function formatSenderName(
  sender: string | null | undefined,
  nameMap: Record<string, string>
): string {
  if (!sender) return "Unknown";

  // Check if it's a phone number
  if (isPhoneNumber(sender)) {
    const name = resolveContactName(sender, nameMap);
    if (name) {
      return `${name} (${sender})`;
    }
  }

  return sender;
}

// ============================================
// PHONE EXTRACTION
// ============================================

/**
 * Check if a string looks like a phone number (for filtering purposes).
 * More lenient than isPhoneNumber - accepts numbers starting with + or having 7+ digits.
 *
 * @param value - String to check
 * @returns true if it looks like a phone number
 */
export function looksLikePhoneNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith("+") || isPhoneNumber(value);
}
