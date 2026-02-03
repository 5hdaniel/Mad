/**
 * Error Logging IPC Handlers
 * TASK-1800: Production Error Logging to Supabase
 *
 * Exposes error logging functionality to renderer process via IPC.
 */

import { ipcMain } from "electron";
import { getErrorLoggingService, type ErrorLogPayload } from "../services/errorLoggingService";
import logService from "../services/logService";

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
    async (_event, payload: ErrorLogPayload) => {
      try {
        logService.debug("[ErrorLogging] Received error submission request", "ErrorLoggingHandlers", {
          errorType: payload.errorType,
          errorCode: payload.errorCode,
        });

        const service = getErrorLoggingService();
        const result = await service.submitError(payload);

        return result;
      } catch (error) {
        logService.error("[ErrorLogging] Handler exception", "ErrorLoggingHandlers", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Process queued errors (call when connection restored)
   */
  ipcMain.handle("error-logging:process-queue", async () => {
    try {
      const service = getErrorLoggingService();
      const processedCount = await service.processOfflineQueue();
      return { success: true, processedCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Get queue size (for diagnostics)
   */
  ipcMain.handle("error-logging:get-queue-size", async () => {
    try {
      const service = getErrorLoggingService();
      return { success: true, queueSize: service.getQueueSize() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  logService.debug("[ErrorLogging] Handlers registered", "ErrorLoggingHandlers");
}
