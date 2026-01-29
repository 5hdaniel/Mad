/**
 * Settings Service
 *
 * Service abstraction for user preferences and settings-related API calls.
 * Centralizes all window.api.preferences and window.api.user calls.
 */

import { type ApiResult, getErrorMessage } from "./index";

/**
 * Phone type for mobile device preference
 */
export type PhoneType = "iphone" | "android";

/**
 * Import source preference (TASK-1742)
 * - 'macos-native': Import from macOS Messages.app and Contacts (default)
 * - 'iphone-sync': Import from connected iPhone via backup
 */
export type ImportSource = "macos-native" | "iphone-sync";

/**
 * Messages-related preferences
 */
export interface MessagesPreferences {
  source?: ImportSource;
}

/**
 * User preferences object
 */
export interface UserPreferences {
  messages?: MessagesPreferences;
  [key: string]: unknown;
}

/**
 * Settings Service
 * Provides a clean abstraction over window.api.preferences and window.api.user
 */
export const settingsService = {
  // ============================================
  // PREFERENCES METHODS
  // ============================================

  /**
   * Get all user preferences
   */
  async getPreferences(userId: string): Promise<ApiResult<UserPreferences>> {
    try {
      const result = await window.api.preferences.get(userId);
      if (result.success) {
        return { success: true, data: result.preferences || {} };
      }
      return { success: false, error: "Failed to get preferences" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Save all user preferences (full replace)
   */
  async savePreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<ApiResult> {
    try {
      const result = await window.api.preferences.save(userId, preferences);
      return { success: result.success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Update user preferences (partial update)
   */
  async updatePreferences(
    userId: string,
    partialPreferences: UserPreferences
  ): Promise<ApiResult> {
    try {
      const result = await window.api.preferences.update(userId, partialPreferences);
      return { success: result.success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // USER SETTINGS METHODS
  // ============================================

  /**
   * Get user's phone type preference
   */
  async getPhoneType(userId: string): Promise<ApiResult<PhoneType | null>> {
    try {
      const result = await window.api.user.getPhoneType(userId);
      if (result.success) {
        return { success: true, data: result.phoneType };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Set user's phone type preference (local DB)
   */
  async setPhoneType(userId: string, phoneType: PhoneType): Promise<ApiResult> {
    try {
      const result = await window.api.user.setPhoneType(userId, phoneType);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Set user's phone type preference to Supabase cloud.
   * Used during onboarding before local DB is initialized.
   * This ensures phone type is persisted even before keychain setup.
   */
  async setPhoneTypeCloud(userId: string, phoneType: PhoneType): Promise<ApiResult> {
    try {
      const userApi = window.api.user as typeof window.api.user & {
        setPhoneTypeCloud: (
          userId: string,
          phoneType: PhoneType
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneTypeCloud(userId, phoneType);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default settingsService;
