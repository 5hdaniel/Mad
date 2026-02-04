/**
 * Reset Handlers
 * TASK-1802: Reset App Data Self-Healing Feature
 *
 * IPC handlers for app data reset functionality.
 */

import { ipcMain } from "electron";
import { getResetService } from "../services/resetService";
import logService from "../services/logService";

/**
 * Register reset-related IPC handlers
 */
export function registerResetHandlers(): void {
  /**
   * Perform a complete app data reset
   * Called from ErrorScreen when user confirms reset
   */
  ipcMain.handle("app:reset", async () => {
    try {
      logService.info(
        "[ResetHandlers] Reset requested from renderer",
        "ResetHandlers"
      );

      const service = getResetService();
      const result = await service.performReset();

      // If we get here, the reset succeeded but app hasn't relaunched yet
      // The relaunch happens after a small delay in the service
      return result;
    } catch (error) {
      logService.error(
        "[ResetHandlers] Reset handler exception",
        "ResetHandlers",
        { error: error instanceof Error ? error.message : "Unknown error" }
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  logService.debug("[ResetHandlers] Handlers registered", "ResetHandlers");
}
