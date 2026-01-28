// ============================================
// MESSAGE IMPORT IPC HANDLERS
// Handles: messages:import-macos, messages:get-import-count, messages:get-attachments
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import logService from "../services/logService";
import databaseService from "../services/databaseService";
import macOSMessagesImportService from "../services/macOSMessagesImportService";
import type {
  MacOSImportResult,
  ImportProgressCallback,
} from "../services/macOSMessagesImportService";

/**
 * Attachment info with base64 data for IPC transfer (TASK-1012)
 */
interface MessageAttachmentInfo {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  data: string | null;
}

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

// TASK-1710: Track import start time for elapsed time calculation
let importStartTime: number | null = null;

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
   * @param forceReimport - If true, delete existing messages first
   * @returns Import result with counts and status
   */
  ipcMain.handle(
    "messages:import-macos",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      forceReimport = false
    ): Promise<MacOSImportResult> => {
      // BACKLOG-551: Verify user exists in database (ID may have been migrated)
      let validUserId = userId;
      const userExists = await databaseService.getUserById(userId);
      if (!userExists) {
        logService.warn("[MessageImport] User ID not found, may have been migrated", "MessageImportHandlers", {
          providedId: userId.substring(0, 8) + "...",
        });
        // Try to find any user in the database (single-user app)
        const db = databaseService.getRawDatabase();
        const anyUser = db.prepare("SELECT id FROM users_local LIMIT 1").get() as { id: string } | undefined;
        if (anyUser) {
          validUserId = anyUser.id;
          logService.info("[MessageImport] Using migrated user ID", "MessageImportHandlers", {
            correctedId: validUserId.substring(0, 8) + "...",
          });
        } else {
          return {
            success: false,
            messagesImported: 0,
            messagesSkipped: 0,
            attachmentsImported: 0,
            attachmentsUpdated: 0,
            attachmentsSkipped: 0,
            duration: 0,
            error: "No valid user found in database",
          };
        }
      }

      logService.info(
        `Starting macOS Messages import for user`,
        "MessageImportHandlers",
        { userId: validUserId, forceReimport }
      );

      // TASK-1710: Track import start time for elapsed time calculation
      importStartTime = Date.now();

      // Create progress callback that sends updates to renderer with elapsed time
      const onProgress: ImportProgressCallback = (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const elapsedMs = importStartTime ? Date.now() - importStartTime : 0;
          mainWindow.webContents.send("messages:import-progress", {
            ...progress,
            elapsedMs,
          });
        }
      };

      try {
        const result = await macOSMessagesImportService.importMessages(
          validUserId,
          onProgress,
          forceReimport
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
          attachmentsImported: 0,
          attachmentsUpdated: 0,
          attachmentsSkipped: 0,
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

  /**
   * Get attachments for a single message with base64 data (TASK-1012)
   * IPC: messages:get-attachments
   *
   * @param messageId - The message ID to get attachments for
   * @returns Array of attachments with base64-encoded data
   */
  ipcMain.handle(
    "messages:get-attachments",
    async (
      _event: IpcMainInvokeEvent,
      messageId: string
    ): Promise<MessageAttachmentInfo[]> => {
      try {
        const attachments = macOSMessagesImportService.getAttachmentsByMessageId(messageId);
        return attachments.map((att) => ({
          id: att.id,
          message_id: att.message_id,
          filename: att.filename,
          mime_type: att.mime_type,
          file_size_bytes: att.file_size_bytes,
          data: att.storage_path
            ? macOSMessagesImportService.getAttachmentAsBase64(att.storage_path)
            : null,
        }));
      } catch (error) {
        logService.error(
          `Failed to get attachments: ${error instanceof Error ? error.message : "Unknown"}`,
          "MessageImportHandlers"
        );
        return [];
      }
    }
  );

  /**
   * Get attachments for multiple messages at once (TASK-1012)
   * IPC: messages:get-attachments-batch
   *
   * @param messageIds - Array of message IDs
   * @returns Record of message ID to attachments
   */
  ipcMain.handle(
    "messages:get-attachments-batch",
    async (
      _event: IpcMainInvokeEvent,
      messageIds: string[]
    ): Promise<Record<string, MessageAttachmentInfo[]>> => {
      try {
        const attachmentsMap = macOSMessagesImportService.getAttachmentsByMessageIds(messageIds);
        const result: Record<string, MessageAttachmentInfo[]> = {};

        for (const [msgId, attachments] of attachmentsMap) {
          result[msgId] = attachments.map((att) => ({
            id: att.id,
            message_id: att.message_id,
            filename: att.filename,
            mime_type: att.mime_type,
            file_size_bytes: att.file_size_bytes,
            data: att.storage_path
              ? macOSMessagesImportService.getAttachmentAsBase64(att.storage_path)
              : null,
          }));
        }

        return result;
      } catch (error) {
        logService.error(
          `Failed to get attachments batch: ${error instanceof Error ? error.message : "Unknown"}`,
          "MessageImportHandlers"
        );
        return {};
      }
    }
  );

  /**
   * Repair attachment message_id mappings without full re-import.
   * IPC: messages:repair-attachments
   */
  ipcMain.handle(
    "messages:repair-attachments",
    async (): Promise<{
      total: number;
      repaired: number;
      orphaned: number;
      alreadyCorrect: number;
    }> => {
      logService.info("Repairing attachment mappings via IPC", "MessageImportHandlers");
      return macOSMessagesImportService.repairAttachmentMessageIds();
    }
  );

  /**
   * Reset import lock (for debugging stuck state)
   * IPC: messages:reset-import-lock
   */
  ipcMain.handle("messages:reset-import-lock", async (): Promise<void> => {
    logService.info("Resetting import lock via IPC", "MessageImportHandlers");
    macOSMessagesImportService.resetImportLock();
  });

  /**
   * Cancel the current import operation (TASK-1710)
   * IPC: messages:import-cancel
   * Uses ipcMain.on (not handle) since this is a one-way event
   */
  ipcMain.on("messages:import-cancel", () => {
    logService.info("Import cancel requested via IPC", "MessageImportHandlers");
    macOSMessagesImportService.requestCancellation();
  });

  logService.info(
    "Message import handlers registered",
    "MessageImportHandlers"
  );
}
