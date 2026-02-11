/**
 * Preference Helper
 *
 * Shared utility for checking contact source preferences.
 * Used by contact-handlers.ts and iPhoneSyncStorageService.ts
 * to gate imports based on user preference toggles.
 *
 * Reusable by TASK-1951 for inferred contact source preferences.
 */

import supabaseService from "../services/supabaseService";
import logService from "../services/logService";

/**
 * Check if a specific contact source is enabled in user preferences.
 *
 * Follows a fail-open strategy: if preferences cannot be loaded
 * (e.g., Supabase offline), defaults to enabled (true) so that
 * existing import flows are not silently broken.
 *
 * @param userId - The user's UUID
 * @param category - 'direct' for direct imports, 'inferred' for auto-discovered
 * @param key - The specific source key (e.g., 'outlookContacts', 'macosContacts')
 * @param defaultValue - Default if preference is not set (defaults to true)
 * @returns Whether the source is enabled
 */
export async function isContactSourceEnabled(
  userId: string,
  category: "direct" | "inferred",
  key: string,
  defaultValue: boolean = true,
): Promise<boolean> {
  try {
    const preferences = await supabaseService.getPreferences(userId);
    const value = preferences?.contactSources?.[category]?.[key];
    return typeof value === "boolean" ? value : defaultValue;
  } catch {
    logService.warn(
      `[PreferenceHelper] Could not load preferences for contact source check, defaulting to ${defaultValue}`,
      "Preferences",
      { userId, category, key },
    );
    return defaultValue;
  }
}
