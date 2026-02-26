/**
 * Address Normalization Utility
 *
 * Normalizes property addresses to their core components (street number + street name)
 * for content matching against email/message bodies. Used by auto-link services to
 * filter communications to the correct transaction when multiple transactions share
 * the same contacts.
 *
 * @see TASK-2087
 */

const STREET_SUFFIXES = new Set([
  'street', 'st',
  'drive', 'dr',
  'boulevard', 'blvd',
  'avenue', 'ave',
  'way',
  'lane', 'ln',
  'court', 'ct',
  'circle', 'cir',
  'place', 'pl',
  'road', 'rd',
  'terrace', 'ter',
  'trail', 'trl',
  'parkway', 'pkwy',
  'highway', 'hwy',
  'loop', 'lp',
]);

/**
 * Normalize a property address to its core components for content matching.
 *
 * Extracts street number + street name, strips common suffixes, and lowercases.
 *
 * Examples:
 *   "123 Oak Street, Portland, OR 97201" -> "123 oak"
 *   "456 Elm Dr"                         -> "456 elm"
 *   "7890 NW Johnson Blvd, Suite 200"    -> "7890 nw johnson"
 *   "123 Oak St."                        -> "123 oak"
 *   "100 Main"                           -> "100 main"
 *   ""                                   -> null
 *   "Portland, OR"                       -> null (no street number)
 *   "123"                                -> null (no street name)
 *
 * @param fullAddress - The full address string to normalize
 * @returns Normalized address string (lowercase, no suffix), or null if unparseable
 */
export function normalizeAddress(fullAddress: string | null | undefined): string | null {
  if (!fullAddress || !fullAddress.trim()) return null;

  // Take only the part before the first comma (street portion)
  const streetPart = fullAddress.split(',')[0].trim().toLowerCase();

  // Split into tokens
  const tokens = streetPart.split(/\s+/).filter(Boolean);

  if (tokens.length < 2) return null;

  // First token must start with a digit (street number)
  if (!/^\d/.test(tokens[0])) return null;

  // Remove trailing suffix if it's a known street suffix
  // Also remove trailing period from abbreviations like "St."
  const lastToken = tokens[tokens.length - 1].replace(/\.$/, '');
  if (STREET_SUFFIXES.has(lastToken)) {
    tokens.pop();
  }

  if (tokens.length < 2) return null;

  return tokens.join(' ');
}

/**
 * Check if text content contains the normalized address.
 * Performs case-insensitive substring search.
 *
 * @param content - The text content to search (email subject, body, message body)
 * @param normalizedAddress - The normalized address string from normalizeAddress()
 * @returns true if the content contains the normalized address
 */
export function contentContainsAddress(
  content: string | null | undefined,
  normalizedAddress: string
): boolean {
  if (!content) return false;
  return content.toLowerCase().includes(normalizedAddress);
}
