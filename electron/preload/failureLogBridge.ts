/**
 * Failure Log Bridge
 * TASK-2058: Exposes failure log IPC methods to the renderer process.
 */

import { ipcRenderer } from "electron";

export interface FailureLogEntry {
  id: number;
  timestamp: string;
  operation: string;
  error_message: string;
  metadata: string | null;
  acknowledged: number;
}

export const failureLogBridge = {
  /**
   * Get recent failure log entries
   * @param limit - Max entries to return (default 50)
   * @returns Recent failure entries, newest first
   */
  getRecent: (limit?: number): Promise<{
    success: boolean;
    entries: FailureLogEntry[];
    error?: string;
  }> => ipcRenderer.invoke("failure-log:get-recent", limit),

  /**
   * Get count of unacknowledged failures
   * @returns Unacknowledged failure count
   */
  getCount: (): Promise<{
    success: boolean;
    count: number;
    error?: string;
  }> => ipcRenderer.invoke("failure-log:get-count"),

  /**
   * Mark all failures as acknowledged
   */
  acknowledgeAll: (): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke("failure-log:acknowledge-all"),

  /**
   * Clear entire failure log
   */
  clear: (): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke("failure-log:clear"),
};
