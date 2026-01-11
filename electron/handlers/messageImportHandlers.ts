// ============================================
// MESSAGE IMPORT IPC HANDLERS
// Handles: messages:import-macos, messages:get-import-count, messages:get-attachments
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import logService from "../services/logService";
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
      logService.info(
        `Starting macOS Messages import for user`,
        "MessageImportHandlers",
        { userId, forceReimport }
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

  logService.info(
    "Message import handlers registered",
    "MessageImportHandlers"
  );
}
