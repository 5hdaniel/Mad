/**
 * Address Normalization Utility
 *
 * Normalizes property addresses to their core components (street number + street name)
 * for content matching against email bodies. Used by auto-link services to
 * filter emails to the correct transaction when multiple transactions share
 * the same contacts.
 *
 * TASK-2087: Address filtering applies to EMAILS ONLY, not text messages.
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
  'alley', 'aly',
  'path',
  'run',
  'pass',
  'pike',
  'crossing', 'xing',
  'commons',
]);

/**
 * Normalized address with separate parts for independent matching.
 *
 * Instead of searching for "123 oak" as one contiguous substring, the caller
 * can check that content contains BOTH the street number AND street name
 * independently. This handles extra spaces, reversed order, or the number
 * and name appearing in different parts of the email.
 */
export interface NormalizedAddress {
  /** The street number, e.g. "123" */
  streetNumber: string;
  /** The street name (may be multi-word), e.g. "oak" or "nw johnson" */
  streetName: string;
  /** Combined for logging, e.g. "123 oak" */
  full: string;
}

/**
 * Normalize a property address to its core components for content matching.
 *
 * Extracts street number + street name, strips common suffixes, and lowercases.
 * Returns a NormalizedAddress with separate parts for independent matching.
 *
 * Examples:
 *   "123 Oak Street, Portland, OR 97201" -> { streetNumber: "123", streetName: "oak", full: "123 oak" }
 *   "456 Elm Dr"                         -> { streetNumber: "456", streetName: "elm", full: "456 elm" }
 *   "7890 NW Johnson Blvd, Suite 200"    -> { streetNumber: "7890", streetName: "nw johnson", full: "7890 nw johnson" }
 *   "123 Oak St."                        -> { streetNumber: "123", streetName: "oak", full: "123 oak" }
 *   "100 Main"                           -> { streetNumber: "100", streetName: "main", full: "100 main" }
 *   ""                                   -> null
 *   "Portland, OR"                       -> null (no street number)
 *   "123"                                -> null (no street name)
 *
 * @param fullAddress - The full address string to normalize
 * @returns NormalizedAddress with separate parts, or null if unparseable
 */
export function normalizeAddress(fullAddress: string | null | undefined): NormalizedAddress | null {
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

  const streetNumber = tokens[0];
  const streetName = tokens.slice(1).join(' ');

  return {
    streetNumber,
    streetName,
    full: tokens.join(' '),
  };
}

/**
 * Check if a word appears in content with word boundaries.
 * Prevents false positives like "123" matching "1234" or "oak" matching "oakland".
 *
 * @param content - The text to search in
 * @param word - The word to find (will be regex-escaped)
 * @returns true if the word appears as a whole word in content
 */
function containsWord(content: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(content);
}

/**
 * Check if text content contains both parts of the normalized address.
 * Each part (street number and street name) is checked independently with
 * word-boundary matching. They don't need to be adjacent.
 *
 * This handles:
 * - Extra spaces between number and name
 * - Reversed order (name then number)
 * - Number and name in different parts of the email
 * - Natural phrasing like "Oak property, unit 123"
 * - Prevents false positives: "123" won't match "1234", "oak" won't match "oakland"
 *
 * For multi-word street names (e.g. "nw johnson"), each word in the name must
 * appear independently.
 *
 * @param content - The text content to search (email subject, body)
 * @param normalizedAddress - The NormalizedAddress from normalizeAddress()
 * @returns true if the content contains both the street number and all street name words
 */
export function contentContainsAddress(
  content: string | null | undefined,
  normalizedAddress: NormalizedAddress
): boolean {
  if (!content) return false;

  // Check street number with word boundary
  if (!containsWord(content, normalizedAddress.streetNumber)) {
    return false;
  }

  // Check each word of the street name independently with word boundaries
  const nameWords = normalizedAddress.streetName.split(/\s+/);
  for (const word of nameWords) {
    if (!containsWord(content, word)) {
      return false;
    }
  }

  return true;
}

/**
 * Generic fallback helper for address-filtered queries.
 *
 * Runs `queryFn` with the normalized address. If the result is empty and an
 * address was provided, retries without the address filter — UNLESS
 * `countWithFilter` reports that matching items exist (they're just already
 * linked). In that case the address filter is working correctly and the
 * fallback is suppressed.
 *
 * This eliminates the duplicated "try with address, fall back without" pattern
 * used by autoLinkService and messageMatchingService.
 *
 * @param queryFn - Async function that returns results, optionally filtered by address
 * @param normalizedAddress - The NormalizedAddress to filter by, or null to skip filtering
 * @param debugLog - Callback for logging fallback events (avoids importing logService here)
 * @param entityType - Label for log messages (e.g. "emails", "matches")
 * @param countWithFilter - Optional callback that returns the total count of items matching
 *   the address filter INCLUDING already-linked ones. When > 0, the fallback is suppressed
 *   because the filter is valid — the 0 unlinked results just means everything is linked.
 * @returns The query results (filtered if possible, unfiltered as fallback)
 */
export async function withAddressFallback<T>(
  queryFn: (address: NormalizedAddress | null) => Promise<T[]>,
  normalizedAddress: NormalizedAddress | null,
  debugLog: (message: string) => Promise<void> | void,
  entityType: string,
  countWithFilter?: (address: NormalizedAddress) => Promise<number>
): Promise<T[]> {
  const results = await queryFn(normalizedAddress);

  if (results.length === 0 && normalizedAddress) {
    // Before falling back, check if matching items exist but are already linked.
    // If countWithFilter returns > 0, the address filter is correct — the items
    // are just already linked to this transaction, so we should NOT fall back.
    if (countWithFilter) {
      const totalMatching = await countWithFilter(normalizedAddress);
      if (totalMatching > 0) {
        await debugLog(
          `Address filter kept: ${totalMatching} ${entityType} match "${normalizedAddress.full}" but all are already linked, no fallback`
        );
        return results; // Return empty — everything matching is already linked
      }
    }

    // Address filter eliminated all results - retry without it
    const unfiltered = await queryFn(null);
    if (unfiltered.length > 0) {
      await debugLog(
        `Address filter fallback: no ${entityType} matched "${normalizedAddress.full}", returning ${unfiltered.length} unfiltered`
      );
    }
    return unfiltered;
  }

  if (results.length > 0 && normalizedAddress) {
    await debugLog(
      `Address filter applied: ${results.length} ${entityType} matched "${normalizedAddress.full}"`
    );
  }

  return results;
}
