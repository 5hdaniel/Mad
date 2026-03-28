/**
 * Google Export Bridge (TASK-1416)
 * Google/Gmail export integration methods
 * Mirrors outlookBridge pattern for Google users
 */

import { ipcRenderer, IpcRendererEvent } from "electron";

export const googleExportBridge = {
  /**
   * Initializes Google export integration (checks for Google mailbox token)
   * @returns Initialization result
   */
  initialize: () => ipcRenderer.invoke("google-export-initialize"),

  /**
   * Checks if user is authenticated with Google mailbox
   * @returns Authentication status
   */
  isAuthenticated: () => ipcRenderer.invoke("google-export-is-authenticated"),

  /**
   * Exports emails and text messages for specified contacts
   * @param contacts - Contacts to export for
   * @returns Export result
   */
  exportEmails: (contacts: unknown[]) =>
    ipcRenderer.invoke("google-export-emails", contacts),

  /**
   * Listens for email export progress
   * @param callback - Callback with progress info
   * @returns Cleanup function
   */
  onExportProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on("google-export-progress", listener);
    return () => ipcRenderer.removeListener("google-export-progress", listener);
  },
};
