/**
 * License Bridge
 * Handles license-related IPC calls from renderer to main process
 */

import { ipcRenderer } from "electron";

export const licenseBridge = {
  /**
   * Gets the current user's license information
   * @returns License data including type, AI addon status, and organization
   */
  get: () => ipcRenderer.invoke("license:get"),

  /**
   * Refreshes the license data from the database
   * @returns Updated license data
   */
  refresh: () => ipcRenderer.invoke("license:refresh"),

  /**
   * DEV ONLY: Toggle AI add-on for testing
   * @param userId - User ID to toggle
   * @param enabled - Whether to enable or disable AI add-on
   * @returns Success status
   */
  devToggleAIAddon: (userId: string, enabled: boolean) =>
    ipcRenderer.invoke("license:dev:toggle-ai-addon", userId, enabled),

  /**
   * DEV ONLY: Set license type for testing
   * @param userId - User ID to update
   * @param licenseType - License type: 'individual', 'team', or 'enterprise'
   * @returns Success status
   */
  devSetLicenseType: (userId: string, licenseType: string) =>
    ipcRenderer.invoke("license:dev:set-license-type", userId, licenseType),
};
