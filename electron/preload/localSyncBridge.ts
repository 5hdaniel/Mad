/**
 * Local Sync Bridge
 * Handles HTTP server start/stop/status for Android companion WiFi sync
 *
 * TASK-1431: Android Companion — Pairing UI + Pipeline Integration
 */

import { ipcRenderer } from "electron";

export const localSyncBridge = {
  /**
   * Starts the local sync HTTP server for receiving Android messages.
   * @param options - Server configuration
   * @returns Server address and port
   */
  startServer: (options: { port: number; secret: string; userId?: string }) =>
    ipcRenderer.invoke("sync:start-server", options),

  /**
   * Stops the local sync HTTP server.
   */
  stopServer: () => ipcRenderer.invoke("sync:stop-server"),

  /**
   * Gets the current sync server status including stats.
   * @returns Server running state, address, port, and sync statistics
   */
  getStatus: () => ipcRenderer.invoke("sync:get-status"),

  /**
   * Clears all Android-synced data (messages and contacts) from the local database.
   * Used by Force Re-import to wipe synced data before re-syncing.
   * BACKLOG-1468
   * @param options - Must include userId
   * @returns Counts of deleted messages and contacts
   */
  clearAndroidData: (options: { userId: string }) =>
    ipcRenderer.invoke("sync:clear-android-data", options),
};
