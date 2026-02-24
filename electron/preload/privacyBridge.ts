/**
 * Privacy Bridge
 * TASK-2053: CCPA Data Export
 *
 * Exposes CCPA data export functionality to the renderer process via IPC.
 */

import { ipcRenderer } from "electron";

/**
 * Result of a data export operation
 */
export interface ExportDataResult {
  /** True if export completed successfully */
  success: boolean;
  /** Path to the exported file on success */
  filePath?: string;
  /** Error message on failure */
  error?: string;
}

/**
 * Progress update during export
 */
export interface ExportProgress {
  /** Current data category being exported */
  category: string;
  /** Overall progress percentage (0-100) */
  progress: number;
}

/**
 * Privacy bridge for renderer process
 */
export const privacyBridge = {
  /**
   * Export all personal data as a JSON file (CCPA compliance).
   *
   * Opens a save dialog, gathers all personal data categories,
   * and writes a structured JSON file. OAuth token values are
   * excluded for security.
   *
   * @param userId - User ID whose data to export
   * @returns Result with success status and file path
   */
  exportData: (userId: string): Promise<ExportDataResult> =>
    ipcRenderer.invoke("privacy:export-data", userId),

  /**
   * Listen for export progress updates.
   *
   * @param callback - Called with category name and progress percentage
   * @returns Cleanup function to remove the listener
   */
  onExportProgress: (
    callback: (progress: ExportProgress) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: ExportProgress,
    ): void => {
      callback(progress);
    };
    ipcRenderer.on("privacy:export-progress", handler);
    return () => {
      ipcRenderer.removeListener("privacy:export-progress", handler);
    };
  },
};
