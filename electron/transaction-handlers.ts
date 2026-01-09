// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "./services/transactionService";
import auditService from "./services/auditService";
import logService from "./services/logService";
import { autoLinkTextsToTransaction } from "./services/messageMatchingService";
import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  OAuthProvider,
} from "./types/models";

// Services (still JS - to be migrated)
const pdfExportService = require("./services/pdfExportService").default;
const enhancedExportService =
  require("./services/enhancedExportService").default;
const folderExportService = require("./services/folderExportService").default;

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateTransactionId,
  validateContactId,
  validateTransactionData,
  validateFilePath,
  validateProvider,
  sanitizeObject,
} from "./utils/validation";

// Import rate limiting
import { rateLimiters } from "./utils/rateLimit";

// Type definitions
interface TransactionResponse {
  success: boolean;
  error?: string;
  transaction?: Transaction | any; // any allows for extended transaction details
  transactions?: Transaction[] | any[];
  path?: string;
  transactionsFound?: number;
  emailsScanned?: number;
  realEstateEmailsFound?: number;
  [key: string]: unknown; // Allow additional fields
}

interface ScanOptions {
  onProgress?: (progress: unknown) => void;
  [key: string]: unknown;
}

interface ExportOptions {
  exportFormat?: string;
  [key: string]: unknown;
}

/**
 * Register all transaction-related IPC handlers
 * @param mainWindow - Main window instance
 */
export const registerTransactionHandlers = (
  mainWindow: BrowserWindow | null,
): void => {
  // Cancel ongoing scan
  ipcMain.handle(
    "transactions:cancel-scan",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Cancelling transaction scan", "Transactions", {
          userId,
        });

        // Validate input
        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const cancelled = transactionService.cancelScan(validatedUserId);

        return {
          success: true,
          cancelled,
        };
      } catch (error) {
        logService.error("Cancel scan failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Scan and extract transactions from emails
  // Rate limited: 5 second cooldown per user to prevent scan spam.
  // Scans hit external email APIs (Gmail, Outlook).
  ipcMain.handle(
    "transactions:scan",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Starting transaction scan", "Transactions", {
          userId,
        });

        // Validate input
        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Rate limit check - 5 second cooldown per user
        const { allowed, remainingMs } = rateLimiters.scan.canExecute(
          "transactions:scan",
          validatedUserId
        );
        if (!allowed && remainingMs !== undefined) {
          const seconds = Math.ceil(remainingMs / 1000);
          logService.warn(
            `Rate limited transactions:scan for user ${validatedUserId}. Retry in ${seconds}s`,
            "Transactions"
          );
          return {
            success: false,
            error: `Please wait ${seconds} seconds before starting another scan.`,
            rateLimited: true,
          };
        }

        const sanitizedOptions = sanitizeObject(options || {}) as ScanOptions;

        const result = await transactionService.scanAndExtractTransactions(
          validatedUserId,
          {
            ...sanitizedOptions,
            onProgress: (progress: unknown) => {
              // Send progress updates to renderer
              if (mainWindow) {
                mainWindow.webContents.send(
                  "transactions:scan-progress",
                  progress,
                );
              }
            },
          },
        );

        logService.info("Transaction scan complete", "Transactions", {
          userId: validatedUserId,
          result,
        });

        return {
          ...result,
        };
      } catch (error) {
        logService.error("Transaction scan failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get all transactions for a user
  ipcMain.handle(
    "transactions:get-all",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate input
        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const transactions =
          await transactionService.getTransactions(validatedUserId);

        // Debug: log detection fields being returned to frontend
        if (transactions.length > 0) {
          logService.debug("First transaction detection fields", "TransactionHandlers", {
            id: transactions[0].id,
            detection_source: transactions[0].detection_source,
            detection_status: transactions[0].detection_status,
            detection_confidence: transactions[0].detection_confidence,
          });
        }

        return {
          success: true,
          transactions,
        };
      } catch (error) {
        logService.error("Get transactions failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Create manual transaction
  ipcMain.handle(
    "transactions:create",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      transactionData: unknown,
    ): Promise<TransactionResponse> => {
      try {
        // Validate inputs
        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }
        const validatedData = validateTransactionData(transactionData, false);

        const transaction = await transactionService.createManualTransaction(
          validatedUserId,
          validatedData as unknown as Partial<NewTransaction>,
        );

        // Audit log transaction creation
        await auditService.log({
          userId: validatedUserId,
          action: "TRANSACTION_CREATE",
          resourceType: "TRANSACTION",
          resourceId: transaction.id,
          metadata: { propertyAddress: transaction.property_address },
          success: true,
        });

        logService.info("Transaction created", "Transactions", {
          userId: validatedUserId,
          transactionId: transaction.id,
        });

        return {
          success: true,
          transaction,
        };
      } catch (error) {
        logService.error("Create transaction failed", "Transactions", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get transaction details with communications
  ipcMain.handle(
    "transactions:get-details",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate input
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }

        const details = await transactionService.getTransactionDetails(
          validatedTransactionId,
        );

        if (!details) {
          return {
            success: false,
            error: "Transaction not found",
          };
        }

        return {
          success: true,
          transaction: details,
        };
      } catch (error) {
        logService.error("Get transaction details failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Update transaction
  ipcMain.handle(
    "transactions:update",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      updates: unknown,
    ): Promise<TransactionResponse> => {
      try {
        // Validate inputs
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }
        const validatedUpdates = validateTransactionData(
          sanitizeObject(updates || {}),
          true,
        );

        // Get transaction before update for audit logging (to get user_id)
        const existingTransaction =
          await transactionService.getTransactionDetails(
            validatedTransactionId,
          );
        const userId = existingTransaction?.user_id || "unknown";

        const updated = await transactionService.updateTransaction(
          validatedTransactionId,
          validatedUpdates as unknown as Partial<UpdateTransaction>,
        );

        // Audit log transaction update
        await auditService.log({
          userId,
          action: "TRANSACTION_UPDATE",
          resourceType: "TRANSACTION",
          resourceId: validatedTransactionId,
          metadata: { updatedFields: Object.keys(validatedUpdates) },
          success: true,
        });

        logService.info("Transaction updated", "Transactions", {
          userId,
          transactionId: validatedTransactionId,
        });

        return {
          success: true,
          transaction: updated,
        };
      } catch (error) {
        logService.error("Update transaction failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Delete transaction
  ipcMain.handle(
    "transactions:delete",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate input
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }

        // Get transaction before delete for audit logging
        const existingTransaction =
          await transactionService.getTransactionDetails(
            validatedTransactionId,
          );
        const userId = existingTransaction?.user_id || "unknown";
        const propertyAddress =
          existingTransaction?.property_address || "unknown";

        await transactionService.deleteTransaction(validatedTransactionId);

        // Audit log transaction deletion
        await auditService.log({
          userId,
          action: "TRANSACTION_DELETE",
          resourceType: "TRANSACTION",
          resourceId: validatedTransactionId,
          metadata: { propertyAddress },
          success: true,
        });

        logService.info("Transaction deleted", "Transactions", {
          userId,
          transactionId: validatedTransactionId,
        });

        return {
          success: true,
        };
      } catch (error) {
        logService.error("Delete transaction failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Create audited transaction with contact assignments
  ipcMain.handle(
    "transactions:create-audited",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      transactionData: unknown,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Creating audited transaction", "Transactions", {
          userId,
        });

        // Validate inputs
        const validatedUserId = validateUserId(userId);
        const validatedData = validateTransactionData(
          sanitizeObject(transactionData || {}),
          false,
        );

        const transaction = await transactionService.createAuditedTransaction(
          validatedUserId as string,
          validatedData as any,
        );

        return {
          success: true,
          transaction,
        };
      } catch (error) {
        logService.error("Create audited transaction failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get transaction with contacts
  ipcMain.handle(
    "transactions:get-with-contacts",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate input
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }

        const transaction = await transactionService.getTransactionWithContacts(
          validatedTransactionId,
        );

        if (!transaction) {
          return {
            success: false,
            error: "Transaction not found",
          };
        }

        return {
          success: true,
          transaction,
        };
      } catch (error) {
        logService.error(
          "Get transaction with contacts failed",
          "Transactions",
          {
            transactionId,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Assign contact to transaction
  ipcMain.handle(
    "transactions:assign-contact",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      contactId: string,
      role: string,
      roleCategory: string,
      isPrimary: boolean,
      notes?: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate inputs
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }
        const validatedContactId = validateContactId(contactId);

        // Validate role and roleCategory as strings
        if (!role || typeof role !== "string" || role.trim().length === 0) {
          throw new ValidationError(
            "Role is required and must be a non-empty string",
            "role",
          );
        }
        if (
          !roleCategory ||
          typeof roleCategory !== "string" ||
          roleCategory.trim().length === 0
        ) {
          throw new ValidationError(
            "Role category is required and must be a non-empty string",
            "roleCategory",
          );
        }

        // Validate isPrimary as boolean
        if (typeof isPrimary !== "boolean") {
          throw new ValidationError("isPrimary must be a boolean", "isPrimary");
        }

        // Validate notes (optional)
        const validatedNotes =
          notes && typeof notes === "string" ? notes.trim() : null;

        await transactionService.assignContactToTransaction(
          validatedTransactionId as string,
          validatedContactId as string,
          role.trim(),
          roleCategory.trim(),
          isPrimary,
          validatedNotes ?? undefined,
        );

        return {
          success: true,
        };
      } catch (error) {
        logService.error(
          "Assign contact to transaction failed",
          "Transactions",
          {
            transactionId,
            contactId,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Remove contact from transaction
  ipcMain.handle(
    "transactions:remove-contact",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      contactId: string,
    ): Promise<TransactionResponse> => {
      try {
        // Validate inputs
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }
        const validatedContactId = validateContactId(contactId);

        await transactionService.removeContactFromTransaction(
          validatedTransactionId as string,
          validatedContactId as string,
        );

        return {
          success: true,
        };
      } catch (error) {
        logService.error(
          "Remove contact from transaction failed",
          "Transactions",
          {
            transactionId,
            contactId,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Batch update contact assignments for a transaction
  ipcMain.handle(
    "transactions:batchUpdateContacts",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      operations: Array<{
        action: "add" | "remove";
        contactId: string;
        role?: string;
        roleCategory?: string;
        specificRole?: string;
        isPrimary?: boolean;
        notes?: string;
      }>,
    ): Promise<TransactionResponse> => {
      try {
        // Validate transaction ID
        const validatedTransactionId = validateTransactionId(transactionId);
        if (!validatedTransactionId) {
          throw new ValidationError(
            "Transaction ID validation failed",
            "transactionId",
          );
        }

        // Validate operations array
        if (!Array.isArray(operations)) {
          throw new ValidationError(
            "Operations must be an array",
            "operations",
          );
        }

        // Validate each operation
        const validatedOperations = operations.map((op, index) => {
          if (!op.action || (op.action !== "add" && op.action !== "remove")) {
            throw new ValidationError(
              `Invalid action at index ${index}: must be 'add' or 'remove'`,
              "operations",
            );
          }

          const validatedContactId = validateContactId(op.contactId);
          if (!validatedContactId) {
            throw new ValidationError(
              `Invalid contact ID at index ${index}`,
              "operations",
            );
          }

          return {
            action: op.action,
            contactId: validatedContactId,
            role: op.role?.trim(),
            roleCategory: op.roleCategory?.trim(),
            specificRole: op.specificRole?.trim(),
            isPrimary: op.isPrimary ?? false,
            notes: op.notes?.trim(),
          };
        });

        await transactionService.batchUpdateContactAssignments(
          validatedTransactionId as string,
          validatedOperations,
        );

        logService.info(
          "Batch contact assignments updated",
          "Transactions",
          {
            transactionId: validatedTransactionId,
            operationCount: validatedOperations.length,
          },
        );

        return {
          success: true,
        };
      } catch (error) {
        logService.error(
          "Batch update contact assignments failed",
          "Transactions",
          {
            transactionId,
            operationCount: operations?.length ?? 0,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Unlink communication (email) from transaction
  ipcMain.handle(
    "transactions:unlink-communication",
    async (
      event: IpcMainInvokeEvent,
      communicationId: string,
      reason?: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Unlinking communication from transaction", "Transactions", {
          communicationId,
          reason,
        });

        // Validate communication ID (using same format as contact ID)
        if (
          !communicationId ||
          typeof communicationId !== "string" ||
          communicationId.trim().length === 0
        ) {
          return {
            success: false,
            error: "Invalid communication ID",
          };
        }

        await transactionService.unlinkCommunication(
          communicationId.trim(),
          reason,
        );

        logService.info("Communication unlinked successfully", "Transactions", {
          communicationId,
        });

        return {
          success: true,
        };
      } catch (error) {
        logService.error("Unlink communication failed", "Transactions", {
          communicationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Re-analyze property (rescan emails for specific address)
  ipcMain.handle(
    "transactions:reanalyze",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      provider: string,
      propertyAddress: string,
      dateRange?: unknown,
    ): Promise<TransactionResponse> => {
      try {
        // Validate inputs
        const validatedUserId = validateUserId(userId);
        const validatedProvider = validateProvider(provider);

        // Validate property address
        if (
          !propertyAddress ||
          typeof propertyAddress !== "string" ||
          propertyAddress.trim().length < 5
        ) {
          throw new ValidationError(
            "Property address is required and must be at least 5 characters",
            "propertyAddress",
          );
        }

        // Validate dateRange (optional object with start/end)
        const sanitizedDateRange = sanitizeObject(dateRange || {});

        const result = await transactionService.reanalyzeProperty(
          validatedUserId as string,
          validatedProvider as OAuthProvider,
          propertyAddress.trim(),
          sanitizedDateRange as { start?: Date; end?: Date },
        );

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logService.error("Reanalyze property failed", "Transactions", {
          userId,
          propertyAddress,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Export transaction to PDF
  ipcMain.handle(
    "transactions:export-pdf",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      outputPath?: string,
    ): Promise<TransactionResponse> => {
      try {
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
          validatedPath || pdfExportService.getDefaultExportPath(details);

        // Generate PDF
        const generatedPath = await pdfExportService.generateTransactionPDF(
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
      } catch (error) {
        logService.error("PDF export failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Bulk delete transactions
  ipcMain.handle(
    "transactions:bulk-delete",
    async (
      event: IpcMainInvokeEvent,
      transactionIds: string[],
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Starting bulk delete", "Transactions", {
          count: transactionIds?.length || 0,
        });

        // Validate input
        if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
          throw new ValidationError(
            "Transaction IDs must be a non-empty array",
            "transactionIds",
          );
        }

        // Validate each transaction ID
        const validatedIds: string[] = [];
        for (const id of transactionIds) {
          const validatedId = validateTransactionId(id);
          if (!validatedId) {
            throw new ValidationError(
              `Invalid transaction ID: ${id}`,
              "transactionIds",
            );
          }
          validatedIds.push(validatedId);
        }

        // Delete each transaction
        let deletedCount = 0;
        const errors: string[] = [];

        for (const transactionId of validatedIds) {
          try {
            // Get transaction before delete for audit logging
            const existingTransaction =
              await transactionService.getTransactionDetails(transactionId);
            const userId = existingTransaction?.user_id || "unknown";
            const propertyAddress =
              existingTransaction?.property_address || "unknown";

            await transactionService.deleteTransaction(transactionId);

            // Audit log transaction deletion
            await auditService.log({
              userId,
              action: "TRANSACTION_DELETE",
              resourceType: "TRANSACTION",
              resourceId: transactionId,
              metadata: { propertyAddress, bulkOperation: true },
              success: true,
            });

            deletedCount++;
          } catch (err) {
            errors.push(
              `Failed to delete ${transactionId}: ${err instanceof Error ? err.message : "Unknown error"}`,
            );
          }
        }

        logService.info("Bulk delete completed", "Transactions", {
          deletedCount,
          errorCount: errors.length,
        });

        return {
          success: errors.length === 0,
          deletedCount,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        logService.error("Bulk delete failed", "Transactions", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Bulk update transaction status
  ipcMain.handle(
    "transactions:bulk-update-status",
    async (
      event: IpcMainInvokeEvent,
      transactionIds: string[],
      status: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Starting bulk status update", "Transactions", {
          count: transactionIds?.length || 0,
          status,
        });

        // Validate input
        if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
          throw new ValidationError(
            "Transaction IDs must be a non-empty array",
            "transactionIds",
          );
        }

        // Validate status - allow all 4 transaction statuses
        if (!status || !["pending", "active", "closed", "rejected"].includes(status)) {
          throw new ValidationError(
            "Status must be 'pending', 'active', 'closed', or 'rejected'",
            "status",
          );
        }

        // Validate each transaction ID
        const validatedIds: string[] = [];
        for (const id of transactionIds) {
          const validatedId = validateTransactionId(id);
          if (!validatedId) {
            throw new ValidationError(
              `Invalid transaction ID: ${id}`,
              "transactionIds",
            );
          }
          validatedIds.push(validatedId);
        }

        // TASK-984: Validate that manual transactions cannot be set to pending/rejected
        // These statuses are only meaningful for AI-detected transactions
        if (status === "pending" || status === "rejected") {
          const manualTransactionIds: string[] = [];
          for (const transactionId of validatedIds) {
            const tx = await transactionService.getTransactionDetails(transactionId);
            if (tx?.detection_source === "manual") {
              manualTransactionIds.push(transactionId);
            }
          }

          if (manualTransactionIds.length > 0) {
            throw new ValidationError(
              `Cannot set manual transactions to "${status}". Manual transactions can only be "active" or "closed".`,
              "status",
            );
          }
        }

        // Update each transaction
        let updatedCount = 0;
        const errors: string[] = [];

        for (const transactionId of validatedIds) {
          try {
            // Get transaction before update for audit logging
            const existingTransaction =
              await transactionService.getTransactionDetails(transactionId);
            const userId = existingTransaction?.user_id || "unknown";

            await transactionService.updateTransaction(transactionId, {
              status: status as "pending" | "active" | "closed" | "rejected",
            });

            // Audit log transaction update
            await auditService.log({
              userId,
              action: "TRANSACTION_UPDATE",
              resourceType: "TRANSACTION",
              resourceId: transactionId,
              metadata: { updatedFields: ["status"], newStatus: status, bulkOperation: true },
              success: true,
            });

            updatedCount++;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            logService.error("Failed to update transaction status", "Transactions", {
              transactionId,
              status,
              error: errorMsg,
              stack: err instanceof Error ? err.stack : undefined,
            });
            errors.push(`Failed to update ${transactionId}: ${errorMsg}`);
          }
        }

        logService.info("Bulk status update completed", "Transactions", {
          updatedCount,
          errorCount: errors.length,
        });

        return {
          success: errors.length === 0,
          updatedCount,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        logService.error("Bulk status update failed", "Transactions", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get unlinked messages (not attached to any transaction)
  ipcMain.handle(
    "transactions:get-unlinked-messages",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Getting unlinked messages", "Transactions", { userId });

        // Validate input
        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const messages = await transactionService.getUnlinkedMessages(validatedUserId);

        return {
          success: true,
          messages,
        };
      } catch (error) {
        logService.error("Get unlinked messages failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get unlinked emails (not attached to any transaction)
  ipcMain.handle(
    "transactions:get-unlinked-emails",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Getting unlinked emails", "Transactions", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const emails = await transactionService.getUnlinkedEmails(validatedUserId);

        return {
          success: true,
          emails,
        };
      } catch (error) {
        logService.error("Get unlinked emails failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get message contacts for contact-first browsing
  ipcMain.handle(
    "transactions:get-message-contacts",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Getting message contacts", "Transactions", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const contacts = await transactionService.getMessageContacts(validatedUserId);

        return {
          success: true,
          contacts,
        };
      } catch (error) {
        logService.error("Get message contacts failed", "Transactions", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get messages for a specific contact
  ipcMain.handle(
    "transactions:get-messages-by-contact",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      contact: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Getting messages by contact", "Transactions", { userId, contact });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        if (!contact || typeof contact !== "string") {
          throw new ValidationError("Contact is required", "contact");
        }

        const messages = await transactionService.getMessagesByContact(validatedUserId, contact);

        return {
          success: true,
          messages,
        };
      } catch (error) {
        logService.error("Get messages by contact failed", "Transactions", {
          userId,
          contact,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Link messages to a transaction
  ipcMain.handle(
    "transactions:link-messages",
    async (
      event: IpcMainInvokeEvent,
      messageIds: string[],
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Linking messages to transaction", "Transactions", {
          messageCount: messageIds?.length || 0,
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

        // Validate message IDs
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          throw new ValidationError(
            "Message IDs must be a non-empty array",
            "messageIds",
          );
        }

        // Validate each message ID
        for (const id of messageIds) {
          if (!id || typeof id !== "string" || id.trim().length === 0) {
            throw new ValidationError(`Invalid message ID: ${id}`, "messageIds");
          }
        }

        await transactionService.linkMessages(messageIds, validatedTransactionId);

        logService.info("Messages linked successfully", "Transactions", {
          messageCount: messageIds.length,
          transactionId: validatedTransactionId,
        });

        return {
          success: true,
        };
      } catch (error) {
        logService.error("Link messages failed", "Transactions", {
          messageCount: messageIds?.length || 0,
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Unlink messages from a transaction (sets transaction_id to null)
  ipcMain.handle(
    "transactions:unlink-messages",
    async (
      event: IpcMainInvokeEvent,
      messageIds: string[],
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Unlinking messages from transaction", "Transactions", {
          messageCount: messageIds?.length || 0,
        });

        // Validate message IDs
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          throw new ValidationError(
            "Message IDs must be a non-empty array",
            "messageIds",
          );
        }

        // Validate each message ID
        for (const id of messageIds) {
          if (!id || typeof id !== "string" || id.trim().length === 0) {
            throw new ValidationError(`Invalid message ID: ${id}`, "messageIds");
          }
        }

        await transactionService.unlinkMessages(messageIds);

        logService.info("Messages unlinked successfully", "Transactions", {
          messageCount: messageIds.length,
        });

        return {
          success: true,
        };
      } catch (error) {
        logService.error("Unlink messages failed", "Transactions", {
          messageCount: messageIds?.length || 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Enhanced export with options
  ipcMain.handle(
    "transactions:export-enhanced",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      try {
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
          sanitizedOptions,
        );

        // Update export tracking in database
        const db = require("./services/databaseService").default;
        await db.updateTransaction(validatedTransactionId, {
          export_status: "exported",
          export_format: sanitizedOptions.exportFormat || "pdf",
          last_exported_on: new Date().toISOString(),
          export_count: (details.export_count || 0) + 1,
        });

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
      } catch (error) {
        logService.error("Enhanced export failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Auto-link text messages to a transaction based on assigned contacts
  ipcMain.handle(
    "transactions:auto-link-texts",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Auto-linking texts to transaction", "Transactions", {
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

        const result = await autoLinkTextsToTransaction(validatedTransactionId);

        logService.info("Auto-link texts complete", "Transactions", {
          transactionId: validatedTransactionId,
          linked: result.linked,
          skipped: result.skipped,
          errors: result.errors.length,
        });

        return {
          success: result.errors.length === 0,
          linked: result.linked,
          skipped: result.skipped,
          errors: result.errors.length > 0 ? result.errors : undefined,
        };
      } catch (error) {
        logService.error("Auto-link texts failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Export transaction to organized folder structure
  ipcMain.handle(
    "transactions:export-folder",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      try {
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

        // Export to folder structure
        const exportPath = await folderExportService.exportTransactionToFolder(
          details,
          (details as any).communications || [],
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
        const db = require("./services/databaseService").default;
        await db.updateTransaction(validatedTransactionId, {
          export_status: "exported",
          export_format: "folder",
          last_exported_on: new Date().toISOString(),
          export_count: (details.export_count || 0) + 1,
        });

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
      } catch (error) {
        logService.error("Folder export failed", "Transactions", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
};
