/**
 * Outlook Bridge (Legacy)
 * Outlook integration methods for Microsoft 365
 */

import { ipcRenderer, IpcRendererEvent } from "electron";

export const outlookBridge = {
  /**
   * Initializes Outlook integration
   * @returns Initialization result
   */
  initialize: () => ipcRenderer.invoke("outlook-initialize"),

  /**
   * Authenticates with Outlook/Microsoft 365
   * @returns Authentication result
   */
  authenticate: () => ipcRenderer.invoke("outlook-authenticate"),

  /**
   * Checks if user is authenticated with Outlook
   * @returns Authentication status
   */
  isAuthenticated: () => ipcRenderer.invoke("outlook-is-authenticated"),

  /**
   * Gets authenticated user's email address
   * @returns User email
   */
  getUserEmail: () => ipcRenderer.invoke("outlook-get-user-email"),

  /**
   * Exports emails for specified contacts
   * @param contacts - Contacts to export emails for
   * @returns Export result
   */
  exportEmails: (contacts: unknown[]) =>
    ipcRenderer.invoke("outlook-export-emails", contacts),

  /**
   * Signs out from Outlook
   * @returns Sign out result
   */
  signout: () => ipcRenderer.invoke("outlook-signout"),

  /**
   * Listens for device code during authentication flow
   * @param callback - Callback with device code info
   * @returns Cleanup function
   */
  onDeviceCode: (callback: (info: unknown) => void) => {
    const listener = (_: IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on("device-code-received", listener);
    return () => ipcRenderer.removeListener("device-code-received", listener);
  },

  /**
   * Listens for email export progress
   * @param callback - Callback with progress info
   * @returns Cleanup function
   */
  onExportProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on("export-progress", listener);
    return () => ipcRenderer.removeListener("export-progress", listener);
  },
};

/**
 * Update Bridge (Legacy)
 * Auto-update event listeners
 */
export const updateBridge = {
  /**
   * Listens for app update availability
   * @param callback - Callback with update info
   * @returns Cleanup function
   */
  onAvailable: (callback: (info: unknown) => void) => {
    const listener = (_: IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on("update-available", listener);
    return () => ipcRenderer.removeListener("update-available", listener);
  },

  /**
   * Listens for update download progress
   * @param callback - Callback with progress info
   * @returns Cleanup function
   */
  onProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on("update-progress", listener);
    return () => ipcRenderer.removeListener("update-progress", listener);
  },

  /**
   * Listens for update download completion
   * @param callback - Callback with update info
   * @returns Cleanup function
   */
  onDownloaded: (callback: (info: unknown) => void) => {
    const listener = (_: IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on("update-downloaded", listener);
    return () => ipcRenderer.removeListener("update-downloaded", listener);
  },

  /**
   * Installs downloaded update and restarts app
   */
  install: () => ipcRenderer.send("install-update"),

  /**
   * Manually check for updates
   * @returns Update check result
   */
  checkForUpdates: (): Promise<{
    updateAvailable: boolean;
    version?: string;
    currentVersion: string;
    error?: string;
  }> => ipcRenderer.invoke("app:check-for-updates"),
};
