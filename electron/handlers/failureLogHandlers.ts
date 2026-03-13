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
import { wrapHandler } from "../utils/wrapHandler";

/**
 * Register all failure log IPC handlers
 */
export function registerFailureLogHandlers(): void {
  // Get recent failures (default 50)
  ipcMain.handle(
    "failure-log:get-recent",
    wrapHandler(async (
      _event,
      limit?: number
    ): Promise<{ success: boolean; entries: FailureLogEntry[] }> => {
      const entries = await failureLogService.getRecentFailures(limit);
      return { success: true, entries };
    }, { module: "FailureLogHandlers" }),
  );

  // Get unacknowledged failure count
  ipcMain.handle(
    "failure-log:get-count",
    wrapHandler(async (): Promise<{ success: boolean; count: number }> => {
      const count = await failureLogService.getFailureCount();
      return { success: true, count };
    }, { module: "FailureLogHandlers" }),
  );

  // Mark all failures as acknowledged
  ipcMain.handle(
    "failure-log:acknowledge-all",
    wrapHandler(async (): Promise<{ success: boolean }> => {
      await failureLogService.acknowledgeAll();
      return { success: true };
    }, { module: "FailureLogHandlers" }),
  );

  // Clear entire log
  ipcMain.handle(
    "failure-log:clear",
    wrapHandler(async (): Promise<{ success: boolean }> => {
      await failureLogService.clearLog();
      return { success: true };
    }, { module: "FailureLogHandlers" }),
  );
}
