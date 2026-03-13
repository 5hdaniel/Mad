/**
 * Error Logging IPC Handlers
 * TASK-1800: Production Error Logging to Supabase
 *
 * Exposes error logging functionality to renderer process via IPC.
 */

import { ipcMain } from "electron";
import { getErrorLoggingService, type ErrorLogPayload } from "../services/errorLoggingService";
import logService from "../services/logService";
import { wrapHandler } from "../utils/wrapHandler";

/**
 * Register error logging IPC handlers
 */
export function registerErrorLoggingHandlers(): void {
  /**
   * Submit an error report to Supabase
   * Called from ErrorScreen when user submits a report
   */
  ipcMain.handle(
    "error-logging:submit",
    wrapHandler(async (_event, payload: ErrorLogPayload) => {
      logService.debug("[ErrorLogging] Received error submission request", "ErrorLoggingHandlers", {
        errorType: payload.errorType,
        errorCode: payload.errorCode,
      });

      const service = getErrorLoggingService();
      const result = await service.submitError(payload);

      return result;
    }, { module: "ErrorLoggingHandlers" }),
  );

  /**
   * Process queued errors (call when connection restored)
   */
  ipcMain.handle("error-logging:process-queue", wrapHandler(async () => {
    const service = getErrorLoggingService();
    const processedCount = await service.processOfflineQueue();
    return { success: true, processedCount };
  }, { module: "ErrorLoggingHandlers" }));

  /**
   * Get queue size (for diagnostics)
   */
  ipcMain.handle("error-logging:get-queue-size", wrapHandler(async () => {
    const service = getErrorLoggingService();
    return { success: true, queueSize: service.getQueueSize() };
  }, { module: "ErrorLoggingHandlers" }));

  logService.debug("[ErrorLogging] Handlers registered", "ErrorLoggingHandlers");
}
