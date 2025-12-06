// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "./services/transactionService";
import auditService from "./services/auditService";
import logService from "./services/logService";
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
        const { databaseService: db } =
          require("./services/databaseService").default;
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
};
