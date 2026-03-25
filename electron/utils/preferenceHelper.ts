/**
 * Preference Helper
 *
 * Shared utility for checking user preferences.
 * Used by contact-handlers.ts and iPhoneSyncStorageService.ts
 * to gate imports based on user preference toggles.
 * Also used by emailSyncService.ts to read email cache duration (BACKLOG-1361).
 *
 * Reusable by TASK-1951 for inferred contact source preferences.
 */

import supabaseService from "../services/supabaseService";
import logService from "../services/logService";
import { EMAIL_CACHE_DURATION_MONTHS_DEFAULT } from "../constants";

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

/**
 * BACKLOG-1361: Get the email cache duration preference (in months).
 *
 * Reads `emailCache.durationMonths` from Supabase user preferences.
 * Falls back to EMAIL_CACHE_DURATION_MONTHS_DEFAULT (3) if the preference
 * is not set or cannot be loaded.
 *
 * @param userId - The user's UUID
 * @returns Duration in months
 */
export async function getEmailCacheDurationMonths(
  userId: string,
): Promise<number> {
  try {
    const preferences = await supabaseService.getPreferences(userId);
    const value = preferences?.emailCache?.durationMonths;
    if (typeof value === "number" && value > 0) {
      return value;
    }
    return EMAIL_CACHE_DURATION_MONTHS_DEFAULT;
  } catch {
    logService.warn(
      `[PreferenceHelper] Could not load email cache duration preference, using default ${EMAIL_CACHE_DURATION_MONTHS_DEFAULT}`,
      "Preferences",
      { userId },
    );
    return EMAIL_CACHE_DURATION_MONTHS_DEFAULT;
  }
}

/**
 * BACKLOG-1361: Compute the email cache since-date based on the user's preference.
 *
 * @param durationMonths - Number of months to look back
 * @returns Date representing the earliest email date to fetch
 */
export function computeEmailCacheSinceDate(durationMonths: number): Date {
  return new Date(Date.now() - durationMonths * 30 * 24 * 60 * 60 * 1000);
}
