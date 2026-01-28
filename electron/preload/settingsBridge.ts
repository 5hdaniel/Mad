/**
 * Settings Bridge
 * Manages user preferences and settings
 */

import { ipcRenderer } from "electron";

export const preferencesBridge = {
  /**
   * Gets all preferences for a user
   * @param userId - User ID
   * @returns User preferences
   */
  get: (userId: string) => ipcRenderer.invoke("preferences:get", userId),

  /**
   * Saves all user preferences (overwrites existing)
   * @param userId - User ID
   * @param preferences - Complete preferences object
   * @returns Save result
   */
  save: (userId: string, preferences: unknown) =>
    ipcRenderer.invoke("preferences:save", userId, preferences),

  /**
   * Updates specific preference fields (merges with existing)
   * @param userId - User ID
   * @param partialPreferences - Preferences to update
   * @returns Update result
   */
  update: (userId: string, partialPreferences: unknown) =>
    ipcRenderer.invoke("preferences:update", userId, partialPreferences),
};

/**
 * User Bridge
 * User-specific preferences stored in local database
 */
export const userBridge = {
  /**
   * Gets user's mobile phone type preference
   * @param userId - User ID to get phone type for
   * @returns Phone type result
   */
  getPhoneType: (userId: string) =>
    ipcRenderer.invoke("user:get-phone-type", userId),

  /**
   * Sets user's mobile phone type preference
   * @param userId - User ID to set phone type for
   * @param phoneType - Phone type ('iphone' | 'android')
   * @returns Set result
   */
  setPhoneType: (userId: string, phoneType: "iphone" | "android") =>
    ipcRenderer.invoke("user:set-phone-type", userId, phoneType),

  /**
   * Gets user's phone type from Supabase cloud storage
   * TASK-1600: Pre-DB phone type retrieval
   * @param userId - User ID to get phone type for
   * @returns Phone type result from Supabase user_preferences
   */
  getPhoneTypeCloud: (
    userId: string
  ): Promise<{
    success: boolean;
    phoneType?: "iphone" | "android";
    error?: string;
  }> => ipcRenderer.invoke("user:get-phone-type-cloud", userId),

  /**
   * Sets user's phone type in Supabase cloud storage
   * TASK-1600: Pre-DB phone type storage (always available after auth)
   * @param userId - User ID to set phone type for
   * @param phoneType - Phone type ('iphone' | 'android')
   * @returns Set result
   */
  setPhoneTypeCloud: (
    userId: string,
    phoneType: "iphone" | "android"
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("user:set-phone-type-cloud", userId, phoneType),
};

/**
 * Shell Bridge
 * Interaction with system shell and external applications
 */
export const shellBridge = {
  /**
   * Opens a URL in the default external browser
   * @param url - URL to open
   * @returns Open result
   */
  openExternal: (url: string) =>
    ipcRenderer.invoke("shell:open-external", url),

  /**
   * Opens a folder in Finder/Explorer
   * @param folderPath - Path to folder to open
   * @returns Open result
   */
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke("open-folder", folderPath),
};
