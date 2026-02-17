// ============================================
// TRANSACTION EXPORT & SUBMISSION IPC HANDLERS
// Handles: PDF export, enhanced export, folder export,
//          submission, resubmission, and sync
// ============================================

import { ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "../services/transactionService";
import auditService from "../services/auditService";
import logService from "../services/logService";
import submissionService from "../services/submissionService";
import submissionSyncService from "../services/submissionSyncService";
import supabaseService from "../services/supabaseService";
import databaseService from "../services/databaseService";
import enhancedExportService from "../services/enhancedExportService";
import folderExportService from "../services/folderExportService";
import { wrapHandler } from "../utils/wrapHandler";
import type { SubmissionProgress } from "../services/submissionService";
import type { Transaction } from "../types/models";
import {
  ValidationError,
  validateTransactionId,
  validateFilePath,
  sanitizeObject,
} from "../utils/validation";

// Type definitions
interface TransactionResponse {
  success: boolean;
  error?: string;
  transaction?: Transaction | any;
  path?: string;
  [key: string]: unknown;
}

interface ExportOptions {
  exportFormat?: string;
  [key: string]: unknown;
}

/**
 * Cleanup transaction export handlers (call on app quit)
 */
export const cleanupTransactionHandlers = (): void => {
  // Stop all submission sync (polling + realtime)
  submissionSyncService.stopAllSync();
};

/**
 * Register transaction export and submission IPC handlers
 * @param mainWindow - Main window instance
 */
export function registerTransactionExportHandlers(
  mainWindow: BrowserWindow | null,
): void {
  // Export transaction to PDF
  ipcMain.handle(
    "transactions:export-pdf",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      outputPath?: string,
    ): Promise<TransactionResponse> => {
      logService.info("Exporting transaction to PDF", "Transactions", {
        transactionId,
      });

      // Validate inputs
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }
      const validatedPath = outputPath ? validateFilePath(outputPath) : null;

      // Get transaction details with communications
      const details = await transactionService.getTransactionDetails(
        validatedTransactionId,
      );

      if (!details) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      // Use provided output path or generate default one
      const pdfPath =
        validatedPath || folderExportService.getDefaultExportPath(details).replace(/\/$/, "") + ".pdf";

      // Generate combined PDF using folder export service
      const generatedPath = await folderExportService.exportTransactionToCombinedPDF(
        details,
        (details as any).communications || [],
        pdfPath,
      );

      // Audit log data export
      await auditService.log({
        userId: details.user_id,
        action: "DATA_EXPORT",
        resourceType: "EXPORT",
        resourceId: validatedTransactionId,
        metadata: {
          format: "pdf",
          propertyAddress: details.property_address,
        },
        success: true,
      });

      logService.info("PDF exported successfully", "Transactions", {
        transactionId: validatedTransactionId,
        path: generatedPath,
      });

      return {
        success: true,
        path: generatedPath,
      };
    }, { module: "Transactions" }),
  );

  // Enhanced export with options
  ipcMain.handle(
    "transactions:export-enhanced",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      logService.info("Starting enhanced export", "Transactions", {
        transactionId,
      });

      // Validate inputs
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }
      const sanitizedOptions = sanitizeObject(options || {}) as ExportOptions;

      // Get transaction details with communications
      const details = await transactionService.getTransactionDetails(
        validatedTransactionId,
      );

      if (!details) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      // Export with options
      const exportPath = await enhancedExportService.exportTransaction(
        details,
        (details as any).communications || [],
        sanitizedOptions as any,
      );

      // Update export tracking in database
      // Note: uses `as any` to match original require()-based call that bypassed strict types
      await databaseService.updateTransaction(validatedTransactionId, {
        export_status: "exported",
        export_format: sanitizedOptions.exportFormat || "pdf",
        last_exported_on: new Date().toISOString(),
        export_count: (details.export_count || 0) + 1,
      } as any);

      // Audit log data export
      await auditService.log({
        userId: details.user_id,
        action: "DATA_EXPORT",
        resourceType: "EXPORT",
        resourceId: validatedTransactionId,
        metadata: {
          format: sanitizedOptions.exportFormat || "pdf",
          propertyAddress: details.property_address,
        },
        success: true,
      });

      logService.info("Enhanced export successful", "Transactions", {
        transactionId: validatedTransactionId,
        format: sanitizedOptions.exportFormat || "pdf",
        path: exportPath,
      });

      return {
        success: true,
        path: exportPath,
      };
    }, { module: "Transactions" }),
  );

  // Export transaction to organized folder structure
  ipcMain.handle(
    "transactions:export-folder",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      logService.info("Starting folder export", "Transactions", {
        transactionId,
      });

      // Validate inputs
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }
      const sanitizedOptions = sanitizeObject(options || {}) as {
        includeEmails?: boolean;
        includeTexts?: boolean;
        includeAttachments?: boolean;
      };

      // Get transaction details with communications
      const details = await transactionService.getTransactionDetails(
        validatedTransactionId,
      );

      if (!details) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      // Filter communications by date range if transaction has dates set
      let communications = (details as any).communications || [];
      const startDate = details.started_at;
      const endDate = details.closed_at;

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;
        // Add a day to end date to include messages on the closing day
        if (end) end.setDate(end.getDate() + 1);

        communications = communications.filter((comm: any) => {
          const commDate = new Date(comm.sent_at || comm.received_at);
          if (start && commDate < start) return false;
          if (end && commDate > end) return false;
          return true;
        });

        logService.info("Filtered communications by date range", "Transactions", {
          original: ((details as any).communications || []).length,
          filtered: communications.length,
          startDate: startDate,
          endDate: endDate,
        });
      }

      // Export to folder structure
      const exportPath = await folderExportService.exportTransactionToFolder(
        details,
        communications,
        {
          transactionId: validatedTransactionId,
          includeEmails: sanitizedOptions.includeEmails ?? true,
          includeTexts: sanitizedOptions.includeTexts ?? true,
          includeAttachments: sanitizedOptions.includeAttachments ?? true,
          onProgress: (progress: unknown) => {
            // Send progress updates to renderer
            if (mainWindow) {
              mainWindow.webContents.send(
                "transactions:export-folder-progress",
                progress,
              );
            }
          },
        },
      );

      // Update export tracking in database
      // Note: export_format constraint doesn't include "folder", so we use NULL
      // Note: uses `as any` to match original require()-based call that bypassed strict types
      await databaseService.updateTransaction(validatedTransactionId, {
        export_status: "exported",
        last_exported_on: new Date().toISOString(),
        export_count: (details.export_count || 0) + 1,
      } as any);

      // Audit log data export
      await auditService.log({
        userId: details.user_id,
        action: "DATA_EXPORT",
        resourceType: "EXPORT",
        resourceId: validatedTransactionId,
        metadata: {
          format: "folder",
          propertyAddress: details.property_address,
        },
        success: true,
      });

      logService.info("Folder export successful", "Transactions", {
        transactionId: validatedTransactionId,
        path: exportPath,
      });

      return {
        success: true,
        path: exportPath,
      };
    }, { module: "Transactions" }),
  );

  // ============================================
  // SUBMISSION HANDLERS (BACKLOG-391)
  // ============================================

  // Submit transaction to broker portal for review
  ipcMain.handle(
    "transactions:submit",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Submitting transaction for broker review", "Transactions", {
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Track progress via IPC events
      const result = await submissionService.submitTransaction(
        validatedTransactionId,
        (progress: SubmissionProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send("transactions:submit-progress", progress);
          }
        }
      );

      if (result.success) {
        // Audit log submission
        const transaction = await transactionService.getTransactionDetails(
          validatedTransactionId
        );
        await auditService.log({
          userId: transaction?.user_id || "unknown",
          action: "TRANSACTION_SUBMIT",
          resourceType: "SUBMISSION",
          resourceId: result.submissionId || validatedTransactionId,
          metadata: {
            propertyAddress: transaction?.property_address,
            messagesCount: result.messagesCount,
            attachmentsCount: result.attachmentsCount,
          },
          success: true,
        });

        logService.info("Transaction submitted successfully", "Transactions", {
          transactionId: validatedTransactionId,
          submissionId: result.submissionId,
          messagesCount: result.messagesCount,
          attachmentsCount: result.attachmentsCount,
        });
      }

      return {
        success: result.success,
        submissionId: result.submissionId,
        messagesCount: result.messagesCount,
        attachmentsCount: result.attachmentsCount,
        attachmentsFailed: result.attachmentsFailed,
        error: result.error,
      };
    }, { module: "Transactions" }),
  );

  // Resubmit transaction (creates new version)
  ipcMain.handle(
    "transactions:resubmit",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Resubmitting transaction for broker review", "Transactions", {
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Track progress via IPC events
      const result = await submissionService.resubmitTransaction(
        validatedTransactionId,
        (progress: SubmissionProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send("transactions:submit-progress", progress);
          }
        }
      );

      if (result.success) {
        logService.info("Transaction resubmitted successfully", "Transactions", {
          transactionId: validatedTransactionId,
          submissionId: result.submissionId,
        });
      }

      return {
        success: result.success,
        submissionId: result.submissionId,
        messagesCount: result.messagesCount,
        attachmentsCount: result.attachmentsCount,
        attachmentsFailed: result.attachmentsFailed,
        error: result.error,
      };
    }, { module: "Transactions" }),
  );

  // Get submission status from cloud
  ipcMain.handle(
    "transactions:get-submission-status",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      submissionId: string,
    ): Promise<TransactionResponse> => {
      if (!submissionId || typeof submissionId !== "string") {
        throw new ValidationError(
          "Submission ID is required",
          "submissionId",
        );
      }

      const status = await submissionService.getSubmissionStatus(submissionId);

      if (!status) {
        return {
          success: false,
          error: "Submission not found",
        };
      }

      return {
        success: true,
        status: status.status,
        reviewNotes: status.review_notes,
        reviewedBy: status.reviewed_by,
        reviewedAt: status.reviewed_at,
      };
    }, { module: "Transactions" }),
  );

  // ============================================
  // SYNC HANDLERS (BACKLOG-395)
  // ============================================

  // Set main window reference for sync service and start sync
  if (mainWindow) {
    submissionSyncService.setMainWindow(mainWindow);
    // Start periodic sync with 1 minute interval (fallback for missed realtime events)
    submissionSyncService.startPeriodicSync(60000);
    // Start realtime subscription for instant status change notifications
    supabaseService.getAuthSession().then((session) => {
      if (session?.userId) {
        submissionSyncService.startRealtimeSubscription(session.userId);
      }
    }).catch((err) => {
      logService.error("Failed to start realtime subscription", "SubmissionSync", { error: String(err) });
    });
  }

  // Sync all submission statuses from cloud
  ipcMain.handle(
    "transactions:sync-submissions",
    wrapHandler(async (): Promise<TransactionResponse> => {
      logService.info("Manual sync triggered", "SubmissionSync");

      const result = await submissionSyncService.syncAllSubmissions();

      logService.info("Manual sync complete", "SubmissionSync", {
        updated: result.updated,
        failed: result.failed,
      });

      return {
        success: true,
        updated: result.updated,
        failed: result.failed,
        details: result.details,
      };
    }, { module: "SubmissionSync" }),
  );

  // Sync a specific transaction's submission status
  ipcMain.handle(
    "transactions:sync-submission",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      const wasUpdated = await submissionSyncService.syncSubmission(validatedTransactionId);

      return {
        success: true,
        updated: wasUpdated,
      };
    }, { module: "SubmissionSync" }),
  );
}
