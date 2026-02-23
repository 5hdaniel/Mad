/**
 * Failure Log Handlers
 * TASK-2058: IPC handlers for renderer to query the failure log.
 *
 * Channels:
 * - failure-log:get-recent    -- returns recent failures
 * - failure-log:get-count     -- returns unacknowledged count
 * - failure-log:acknowledge-all -- marks all as acknowledged
 * - failure-log:clear         -- clears entire log
 */

import { ipcMain } from "electron";
import failureLogService from "../services/failureLogService";
import type { FailureLogEntry } from "../services/failureLogService";
import logService from "../services/logService";

/**
 * Register all failure log IPC handlers
 */
export function registerFailureLogHandlers(): void {
  // Get recent failures (default 50)
  ipcMain.handle(
    "failure-log:get-recent",
    async (
      _event,
      limit?: number
    ): Promise<{ success: boolean; entries: FailureLogEntry[]; error?: string }> => {
      try {
        const entries = await failureLogService.getRecentFailures(limit);
        return { success: true, entries };
      } catch (error) {
        await logService.error(
          "Failed to get recent failures",
          "FailureLogHandlers",
          { error: error instanceof Error ? error.message : String(error) }
        );
        return { success: false, entries: [], error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  // Get unacknowledged failure count
  ipcMain.handle(
    "failure-log:get-count",
    async (): Promise<{ success: boolean; count: number; error?: string }> => {
      try {
        const count = await failureLogService.getFailureCount();
        return { success: true, count };
      } catch (error) {
        await logService.error(
          "Failed to get failure count",
          "FailureLogHandlers",
          { error: error instanceof Error ? error.message : String(error) }
        );
        return { success: false, count: 0, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  // Mark all failures as acknowledged
  ipcMain.handle(
    "failure-log:acknowledge-all",
    async (): Promise<{ success: boolean; error?: string }> => {
      try {
        await failureLogService.acknowledgeAll();
        return { success: true };
      } catch (error) {
        await logService.error(
          "Failed to acknowledge failures",
          "FailureLogHandlers",
          { error: error instanceof Error ? error.message : String(error) }
        );
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  // Clear entire log
  ipcMain.handle(
    "failure-log:clear",
    async (): Promise<{ success: boolean; error?: string }> => {
      try {
        await failureLogService.clearLog();
        return { success: true };
      } catch (error) {
        await logService.error(
          "Failed to clear failure log",
          "FailureLogHandlers",
          { error: error instanceof Error ? error.message : String(error) }
        );
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );
}
