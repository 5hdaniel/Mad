// ============================================
// MESSAGE IMPORT IPC HANDLERS
// Handles: messages:import-macos, messages:get-import-count
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import logService from "../services/logService";
import macOSMessagesImportService from "../services/macOSMessagesImportService";
import type {
  MacOSImportResult,
  ImportProgressCallback,
} from "../services/macOSMessagesImportService";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

/**
 * Register message import IPC handlers
 */
export function registerMessageImportHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      "Message import handlers already registered, skipping duplicate registration",
      "MessageImportHandlers"
    );
    return;
  }
  handlersRegistered = true;

  /**
   * Import messages from macOS Messages app
   * IPC: messages:import-macos
   *
   * @param userId - The user ID to associate messages with
   * @returns Import result with counts and status
   */
  ipcMain.handle(
    "messages:import-macos",
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<MacOSImportResult> => {
      logService.info(
        `Starting macOS Messages import for user`,
        "MessageImportHandlers",
        { userId }
      );

      // Create progress callback that sends updates to renderer
      const onProgress: ImportProgressCallback = (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("messages:import-progress", progress);
        }
      };

      try {
        const result = await macOSMessagesImportService.importMessages(
          userId,
          onProgress
        );

        if (result.success) {
          logService.info(
            `macOS Messages import completed`,
            "MessageImportHandlers",
            {
              imported: result.messagesImported,
              skipped: result.messagesSkipped,
              duration: result.duration,
            }
          );
        } else {
          logService.error(
            `macOS Messages import failed: ${result.error}`,
            "MessageImportHandlers"
          );
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logService.error(
          `macOS Messages import error: ${errorMessage}`,
          "MessageImportHandlers"
        );

        return {
          success: false,
          messagesImported: 0,
          messagesSkipped: 0,
          duration: 0,
          error: errorMessage,
        };
      }
    }
  );

  /**
   * Get count of messages available for import from macOS Messages
   * IPC: messages:get-import-count
   *
   * @returns Count of available messages
   */
  ipcMain.handle(
    "messages:get-import-count",
    async (): Promise<{ success: boolean; count?: number; error?: string }> => {
      logService.info(
        `Getting macOS Messages count`,
        "MessageImportHandlers"
      );

      try {
        return await macOSMessagesImportService.getAvailableMessageCount();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logService.error(
          `Failed to get message count: ${errorMessage}`,
          "MessageImportHandlers"
        );

        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  logService.info(
    "Message import handlers registered",
    "MessageImportHandlers"
  );
}
