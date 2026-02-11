/**
 * Preference Helper
 * Utility for checking user contact source preferences.
 *
 * TASK-1951: Created for checking inferred contact source preferences.
 * TASK-1950: Also used for direct contact import preferences.
 *
 * This helper reads preferences from Supabase and provides a clean API
 * for checking whether specific contact sources are enabled/disabled.
 */

import supabaseService from "../services/supabaseService";
import logService from "../services/logService";

/**
 * Contact source category: 'direct' for imports, 'inferred' for discovery
 */
type ContactSourceCategory = "direct" | "inferred";

/**
 * Direct contact source keys
 */
type DirectSourceKey = "outlookContacts" | "gmailContacts" | "macosContacts";

/**
 * Inferred contact source keys
 */
type InferredSourceKey = "outlookEmails" | "gmailEmails" | "messages";

/**
 * All possible contact source keys
 */
type ContactSourceKey = DirectSourceKey | InferredSourceKey;

/**
 * Check if a specific contact source is enabled for a user.
 *
 * @param userId - The user ID to check preferences for
 * @param category - 'direct' or 'inferred'
 * @param key - The specific source key (e.g., 'outlookEmails', 'gmailContacts')
 * @param defaultValue - Default value if preference is not set
 * @returns Whether the contact source is enabled
 *
 * Defaults:
 * - direct sources default to true (ON) -- existing behavior for imports
 * - inferred sources default to false (OFF) -- safe default, opt-in
 */
export async function isContactSourceEnabled(
  userId: string,
  category: ContactSourceCategory,
  key: ContactSourceKey,
  defaultValue: boolean,
): Promise<boolean> {
  try {
    const preferences = await supabaseService.getPreferences(userId);
    const value = preferences?.contactSources?.[category]?.[key];

    if (typeof value === "boolean") {
      return value;
    }

    return defaultValue;
  } catch (error) {
    // Fail open with default value if preferences unavailable
    await logService.warn(
      `Failed to read contact source preference, using default: ${defaultValue}`,
      "preferenceHelper.isContactSourceEnabled",
      {
        userId,
        category,
        key,
        defaultValue,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return defaultValue;
  }
}
