/**
 * Reset Handlers
 * TASK-1802: Reset App Data Self-Healing Feature
 *
 * IPC handlers for app data reset functionality.
 */

import { ipcMain } from "electron";
import { getResetService } from "../services/resetService";
import logService from "../services/logService";
import { wrapHandler } from "../utils/wrapHandler";

/**
 * Register reset-related IPC handlers
 */
export function registerResetHandlers(): void {
  /**
   * Perform a complete app data reset
   * Called from ErrorScreen when user confirms reset
   */
  ipcMain.handle("app:reset", wrapHandler(async () => {
    logService.info(
      "[ResetHandlers] Reset requested from renderer",
      "ResetHandlers"
    );

    const service = getResetService();
    const result = await service.performReset();

    // If we get here, the reset succeeded but app hasn't relaunched yet
    // The relaunch happens after a small delay in the service
    return result;
  }, { module: "ResetHandlers" }));

  logService.debug("[ResetHandlers] Handlers registered", "ResetHandlers");
}
