/**
 * Reset Bridge
 * TASK-1802: Reset App Data Self-Healing Feature
 *
 * Exposes reset functionality to renderer process via IPC.
 */

import { ipcRenderer } from "electron";

/**
 * Result of a reset operation
 */
export interface ResetResult {
  /** True if reset completed successfully */
  success: boolean;
  /** Error message if reset failed */
  error?: string;
}

/**
 * Reset bridge for renderer process
 */
export const resetBridge = {
  /**
   * Perform a complete app data reset
   * WARNING: This is a destructive operation that will:
   * - Delete all local data (database, preferences, cached data)
   * - Restart the app
   *
   * Cloud data (Supabase) is NOT affected.
   *
   * @returns Result with success status
   */
  reset: (): Promise<ResetResult> => ipcRenderer.invoke("app:reset"),
};
