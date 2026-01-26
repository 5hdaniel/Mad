/**
 * Contact Utilities (Frontend)
 *
 * Pure utility functions for contact name resolution.
 * No Node.js or Electron dependencies - safe for browser use.
 */

import { getTrailingDigits, isPhoneNumber } from "./phoneUtils";

/**
 * Resolve a phone number to a contact name from a pre-built map.
 * Tries direct lookup, then normalized lookup.
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

/**
 * Format phone number or resolve to contact name for display.
 */
export function formatSenderName(
  sender: string | null | undefined,
  nameMap: Record<string, string>
): string {
  if (!sender) return "Unknown";

  if (isPhoneNumber(sender)) {
    const name = resolveContactName(sender, nameMap);
    if (name) {
      return `${name} (${sender})`;
    }
  }

  return sender;
}

/**
 * Check if a string looks like a phone number.
 */
export function looksLikePhoneNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith("+") || isPhoneNumber(value);
}
