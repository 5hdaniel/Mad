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
};
