// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================

import { ipcMain, BrowserWindow, shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "./services/transactionService";
import auditService from "./services/auditService";
import logService from "./services/logService";
import { autoLinkAllToTransaction } from "./services/messageMatchingService";
import { autoLinkCommunicationsForContact } from "./services/autoLinkService";
import { dbAll } from "./services/db/core/dbConnection";
import { createEmail, getEmailByExternalId } from "./services/db/emailDbService";
import { createCommunication } from "./services/db/communicationDbService";
import submissionService from "./services/submissionService";
import submissionSyncService from "./services/submissionSyncService";
import type { SubmissionProgress } from "./services/submissionService";
import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  OAuthProvider,
} from "./types/models";

// Services (still JS - to be migrated)
const enhancedExportService =
  require("./services/enhancedExportService").default;
const folderExportService = require("./services/folderExportService").default;
const databaseService = require("./services/databaseService").default;
const gmailFetchService = require("./services/gmailFetchService").default;
const outlookFetchService = require("./services/outlookFetchService").default;

// TASK-1775: Email attachment download service
import emailAttachmentService from "./services/emailAttachmentService";

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
 * Cleanup transaction handlers (call on app quit)
 */
export const cleanupTransactionHandlers = (): void => {
  // Stop submission sync service
  submissionSyncService.stopPeriodicSync();
};

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
        const sanitizedUpdates = sanitizeObject(updates || {});
        const validatedUpdates = validateTransactionData(
          sanitizedUpdates,
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

        // TASK-1031: createAuditedTransaction now auto-links communications
        // for all assigned contacts internally
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

        // TASK-1031: assignContactToTransaction now auto-links communications
        // for the newly added contact
        const result = await transactionService.assignContactToTransaction(
          validatedTransactionId as string,
          validatedContactId as string,
          role.trim(),
          roleCategory.trim(),
          isPrimary,
          validatedNotes ?? undefined,
        );

        // Log auto-link results if any communications were linked
        if (result.autoLink) {
          const { emailsLinked, messagesLinked } = result.autoLink;
          if (emailsLinked > 0 || messagesLinked > 0) {
            logService.info("Auto-linked communications for new contact", "Transactions", {
              transactionId: validatedTransactionId,
              contactId: validatedContactId,
              emailsLinked,
              messagesLinked,
            });
          }
        }

        return {
          success: true,
          // TASK-1031: Return auto-link results so UI can notify user
          autoLink: result.autoLink,
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

        // TASK-1126: Auto-link communications for each added contact
        const autoLinkResults: Array<{
          contactId: string;
          emailsLinked: number;
          messagesLinked: number;
          alreadyLinked: number;
          errors: number;
        }> = [];

        const addOperations = validatedOperations.filter(
          (op) => op.action === "add"
        );

        for (const op of addOperations) {
          try {
            const result = await autoLinkCommunicationsForContact({
              contactId: op.contactId,
              transactionId: validatedTransactionId as string,
            });

            autoLinkResults.push({
              contactId: op.contactId,
              ...result,
            });

            logService.debug(
              "Auto-link complete for contact",
              "Transactions",
              {
                contactId: op.contactId,
                emailsLinked: result.emailsLinked,
                messagesLinked: result.messagesLinked,
                alreadyLinked: result.alreadyLinked,
              }
            );
          } catch (error) {
            // Log but don't fail the entire operation
            logService.warn(
              `Auto-link failed for contact ${op.contactId}`,
              "Transactions",
              {
                error: error instanceof Error ? error.message : "Unknown",
              }
            );
          }
        }

        return {
          success: true,
          autoLinkResults:
            autoLinkResults.length > 0 ? autoLinkResults : undefined,
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

  // Get unlinked emails - fetches directly from email provider (Gmail/Outlook)
  ipcMain.handle(
    "transactions:get-unlinked-emails",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Fetching emails from provider", "Transactions", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Check which provider the user is authenticated with
        const googleToken = await databaseService.getOAuthToken(validatedUserId, "google", "mailbox");
        const microsoftToken = await databaseService.getOAuthToken(validatedUserId, "microsoft", "mailbox");

        let emails: Array<{
          id: string;
          subject: string | null;
          sender: string | null;
          sent_at: string | null;
          body_preview?: string | null;
          provider: "gmail" | "outlook";
        }> = [];

        // Fetch from Gmail if authenticated
        if (googleToken) {
          try {
            const isReady = await gmailFetchService.initialize(validatedUserId);
            if (isReady) {
              // Fetch recent emails (last 100)
              const gmailEmails = await gmailFetchService.searchEmails({
                maxResults: 100,
              });
              emails = gmailEmails.map((email: { id: string; subject: string | null; from: string | null; date: string | null; plainBody: string | null }) => ({
                id: `gmail:${email.id}`,
                subject: email.subject,
                sender: email.from,
                sent_at: email.date ? new Date(email.date).toISOString() : null,
                body_preview: email.plainBody?.substring(0, 200) || null,
                provider: "gmail" as const,
              }));
              logService.info(`Fetched ${emails.length} emails from Gmail`, "Transactions");
            }
          } catch (gmailError) {
            logService.warn("Failed to fetch from Gmail", "Transactions", {
              error: gmailError instanceof Error ? gmailError.message : "Unknown",
            });
          }
        }

        // Fetch from Outlook if authenticated (and no Gmail emails)
        if (microsoftToken && emails.length === 0) {
          try {
            const isReady = await outlookFetchService.initialize(validatedUserId);
            if (isReady) {
              // Fetch recent emails (last 100)
              const outlookEmails = await outlookFetchService.searchEmails({
                maxResults: 100,
              });
              emails = outlookEmails.map((email: { id: string; subject: string | null; from: string | null; date: string | null; plainBody: string | null }) => ({
                id: `outlook:${email.id}`,
                subject: email.subject,
                sender: email.from,
                sent_at: email.date ? new Date(email.date).toISOString() : null,
                body_preview: email.plainBody?.substring(0, 200) || null,
                provider: "outlook" as const,
              }));
              logService.info(`Fetched ${emails.length} emails from Outlook`, "Transactions");
            }
          } catch (outlookError) {
            logService.warn("Failed to fetch from Outlook", "Transactions", {
              error: outlookError instanceof Error ? outlookError.message : "Unknown",
            });
          }
        }

        if (emails.length === 0 && !googleToken && !microsoftToken) {
          return {
            success: false,
            error: "No email account connected. Please connect Gmail or Outlook in Settings.",
          };
        }

        return {
          success: true,
          emails,
        };
      } catch (error) {
        logService.error("Get emails from provider failed", "Transactions", {
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

  // Link emails to a transaction - fetches full email from provider and saves to database
  ipcMain.handle(
    "transactions:link-emails",
    async (
      event: IpcMainInvokeEvent,
      emailIds: string[],
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Linking emails to transaction", "Transactions", {
          emailCount: emailIds?.length || 0,
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

        // Validate email IDs
        if (!Array.isArray(emailIds) || emailIds.length === 0) {
          throw new ValidationError(
            "Email IDs must be a non-empty array",
            "emailIds",
          );
        }

        // Get transaction to get user_id
        const transaction = await transactionService.getTransactionDetails(validatedTransactionId);
        if (!transaction) {
          throw new ValidationError("Transaction not found", "transactionId");
        }

        // Import the function we need
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createCommunication } = require("./services/db/communicationDbService");

        // Group emails by provider
        const gmailIds: string[] = [];
        const outlookIds: string[] = [];
        for (const emailId of emailIds) {
          if (!emailId || typeof emailId !== "string") continue;
          if (emailId.startsWith("gmail:")) {
            gmailIds.push(emailId.replace("gmail:", ""));
          } else if (emailId.startsWith("outlook:")) {
            outlookIds.push(emailId.replace("outlook:", ""));
          }
        }

        let linkedCount = 0;

        // Fetch and save Gmail emails
        if (gmailIds.length > 0) {
          try {
            const isReady = await gmailFetchService.initialize(transaction.user_id);
            if (isReady) {
              for (const messageId of gmailIds) {
                try {
                  const email = await gmailFetchService.getEmailById(messageId);

                  // BACKLOG-506: Check if email already exists (dedup by external_id)
                  let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: transaction.user_id,
                      external_id: messageId,
                      source: "gmail",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // TASK-1775: Download email attachments if present
                  if (email.hasAttachments && email.attachments && email.attachments.length > 0) {
                    try {
                      await emailAttachmentService.downloadEmailAttachments(
                        transaction.user_id,
                        emailRecord.id,
                        messageId, // External email ID (Gmail message ID)
                        "gmail",
                        email.attachments.map((att: { filename?: string; name?: string; mimeType?: string; contentType?: string; size?: number; attachmentId?: string; id?: string }) => ({
                          filename: att.filename || att.name || "attachment",
                          mimeType: att.mimeType || att.contentType || "application/octet-stream",
                          size: att.size || 0,
                          attachmentId: att.attachmentId || att.id,
                        }))
                      );
                    } catch (attachmentError) {
                      // Log but don't fail - attachment download is non-blocking
                      logService.warn("Failed to download Gmail email attachments", "Transactions", {
                        emailId: emailRecord.id,
                        error: attachmentError instanceof Error ? attachmentError.message : "Unknown",
                      });
                    }
                  }

                  // Create junction link in communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
                  linkedCount++;
                } catch (emailError) {
                  logService.warn(`Failed to fetch Gmail email ${messageId}`, "Transactions", {
                    error: emailError instanceof Error ? emailError.message : "Unknown",
                  });
                }
              }
            }
          } catch (gmailError) {
            logService.error("Gmail fetch failed", "Transactions", {
              error: gmailError instanceof Error ? gmailError.message : "Unknown",
            });
          }
        }

        // Fetch and save Outlook emails
        if (outlookIds.length > 0) {
          try {
            const isReady = await outlookFetchService.initialize(transaction.user_id);
            if (isReady) {
              for (const messageId of outlookIds) {
                try {
                  const email = await outlookFetchService.getEmailById(messageId);

                  // BACKLOG-506: Check if email already exists (dedup by external_id)
                  let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: transaction.user_id,
                      external_id: messageId,
                      source: "outlook",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // TASK-1775: Download email attachments if present
                  if (email.hasAttachments && email.attachments && email.attachments.length > 0) {
                    try {
                      await emailAttachmentService.downloadEmailAttachments(
                        transaction.user_id,
                        emailRecord.id,
                        messageId, // External email ID (Outlook message ID)
                        "outlook",
                        email.attachments.map((att: { filename?: string; name?: string; mimeType?: string; contentType?: string; size?: number; attachmentId?: string; id?: string }) => ({
                          filename: att.filename || att.name || "attachment",
                          mimeType: att.mimeType || att.contentType || "application/octet-stream",
                          size: att.size || 0,
                          attachmentId: att.attachmentId || att.id,
                        }))
                      );
                    } catch (attachmentError) {
                      // Log but don't fail - attachment download is non-blocking
                      logService.warn("Failed to download Outlook email attachments", "Transactions", {
                        emailId: emailRecord.id,
                        error: attachmentError instanceof Error ? attachmentError.message : "Unknown",
                      });
                    }
                  }

                  // Create junction link in communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
                  linkedCount++;
                } catch (emailError) {
                  logService.warn(`Failed to fetch Outlook email ${messageId}`, "Transactions", {
                    error: emailError instanceof Error ? emailError.message : "Unknown",
                  });
                }
              }
            }
          } catch (outlookError) {
            logService.error("Outlook fetch failed", "Transactions", {
              error: outlookError instanceof Error ? outlookError.message : "Unknown",
            });
          }
        }

        logService.info("Emails linked successfully", "Transactions", {
          requestedCount: emailIds.length,
          linkedCount,
          transactionId: validatedTransactionId,
        });

        return {
          success: true,
          linkedCount,
        };
      } catch (error) {
        logService.error("Link emails failed", "Transactions", {
          emailCount: emailIds?.length || 0,
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
      transactionId?: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Unlinking messages from transaction", "Transactions", {
          messageCount: messageIds?.length || 0,
          transactionId,
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

        // TASK-1116: Pass transactionId for thread-based unlinking
        await transactionService.unlinkMessages(messageIds, transactionId);

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
        logService.info("Auto-linking communications to transaction", "Transactions", {
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

        const result = await autoLinkAllToTransaction(validatedTransactionId);

        logService.info("Auto-link communications complete", "Transactions", {
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
        logService.error("Auto-link communications failed", "Transactions", {
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
        const db = require("./services/databaseService").default;
        await db.updateTransaction(validatedTransactionId, {
          export_status: "exported",
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

  // ============================================
  // SUBMISSION HANDLERS (BACKLOG-391)
  // ============================================

  // Submit transaction to broker portal for review
  ipcMain.handle(
    "transactions:submit",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
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
      } catch (error) {
        logService.error("Submit transaction failed", "Transactions", {
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

  // Resubmit transaction (creates new version)
  ipcMain.handle(
    "transactions:resubmit",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
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
      } catch (error) {
        logService.error("Resubmit transaction failed", "Transactions", {
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

  // Get submission status from cloud
  ipcMain.handle(
    "transactions:get-submission-status",
    async (
      event: IpcMainInvokeEvent,
      submissionId: string,
    ): Promise<TransactionResponse> => {
      try {
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
      } catch (error) {
        logService.error("Get submission status failed", "Transactions", {
          submissionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Re-sync auto-link communications for all contacts on a transaction
  // Use when contacts have been updated and user wants to re-link communications
  ipcMain.handle(
    "transactions:resync-auto-link",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Re-syncing auto-link for transaction", "Transactions", {
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

        // Get transaction with contacts
        const transactionDetails = await transactionService.getTransactionWithContacts(
          validatedTransactionId,
        );

        if (!transactionDetails) {
          return {
            success: false,
            error: "Transaction not found",
          };
        }

        const contactAssignments = (transactionDetails as any).contact_assignments || [];

        if (contactAssignments.length === 0) {
          return {
            success: true,
            message: "No contacts to sync",
            totalEmailsLinked: 0,
            totalMessagesLinked: 0,
            totalAlreadyLinked: 0,
          };
        }

        // Auto-link communications for each contact
        const results: Array<{
          contactId: string;
          emailsLinked: number;
          messagesLinked: number;
          alreadyLinked: number;
          errors: number;
        }> = [];

        let totalEmailsLinked = 0;
        let totalMessagesLinked = 0;
        let totalAlreadyLinked = 0;
        let totalErrors = 0;

        for (const assignment of contactAssignments) {
          try {
            const result = await autoLinkCommunicationsForContact({
              contactId: assignment.contact_id,
              transactionId: validatedTransactionId,
            });

            results.push({
              contactId: assignment.contact_id,
              ...result,
            });

            totalEmailsLinked += result.emailsLinked;
            totalMessagesLinked += result.messagesLinked;
            totalAlreadyLinked += result.alreadyLinked;
            totalErrors += result.errors;

            logService.debug(
              "Re-sync auto-link complete for contact",
              "Transactions",
              {
                contactId: assignment.contact_id,
                emailsLinked: result.emailsLinked,
                messagesLinked: result.messagesLinked,
                alreadyLinked: result.alreadyLinked,
              }
            );
          } catch (error) {
            totalErrors++;
            logService.warn(
              `Re-sync auto-link failed for contact ${assignment.contact_id}`,
              "Transactions",
              {
                error: error instanceof Error ? error.message : "Unknown",
              }
            );
          }
        }

        logService.info("Re-sync auto-link complete", "Transactions", {
          transactionId: validatedTransactionId,
          contactsProcessed: contactAssignments.length,
          totalEmailsLinked,
          totalMessagesLinked,
          totalAlreadyLinked,
          totalErrors,
        });

        return {
          success: true,
          contactsProcessed: contactAssignments.length,
          totalEmailsLinked,
          totalMessagesLinked,
          totalAlreadyLinked,
          totalErrors,
          results,
        };
      } catch (error) {
        logService.error("Re-sync auto-link failed", "Transactions", {
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

  // ============================================
  // SYNC FROM PROVIDER HANDLER (BACKLOG-457)
  // ============================================

  // Sync emails from email provider (Gmail/Outlook) for a transaction
  // This fetches NEW emails from the provider, stores them, then runs auto-link
  ipcMain.handle(
    "transactions:sync-and-fetch-emails",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
        logService.info("Sync and fetch emails for transaction", "Transactions", {
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

        // Get transaction with contacts
        const transactionDetails = await transactionService.getTransactionWithContacts(
          validatedTransactionId,
        );

        if (!transactionDetails) {
          return {
            success: false,
            error: "Transaction not found",
          };
        }

        const userId = transactionDetails.user_id;
        const contactAssignments = (transactionDetails as any).contact_assignments || [];

        if (contactAssignments.length === 0) {
          return {
            success: true,
            message: "No contacts to sync",
            emailsFetched: 0,
            emailsStored: 0,
            totalEmailsLinked: 0,
            totalMessagesLinked: 0,
          };
        }

        // Collect all contact emails
        const contactEmails: string[] = [];
        for (const assignment of contactAssignments) {
          // Get contact's email addresses from contact_emails table
          const emails = dbAll<{ email: string }>(
            "SELECT email FROM contact_emails WHERE contact_id = ?",
            [assignment.contact_id]
          );
          for (const e of emails) {
            if (e.email && !contactEmails.includes(e.email.toLowerCase())) {
              contactEmails.push(e.email.toLowerCase());
            }
          }
        }

        if (contactEmails.length === 0) {
          // No contact emails, just run the regular auto-link
          return {
            success: true,
            message: "No contact emails found, running local auto-link only",
            emailsFetched: 0,
            emailsStored: 0,
            totalEmailsLinked: 0,
            totalMessagesLinked: 0,
          };
        }

        // Determine date range from transaction (or default to 6 months)
        const startDate = transactionDetails.started_at
          ? new Date(transactionDetails.started_at)
          : new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000); // 6 months ago
        const endDate = transactionDetails.closed_at
          ? new Date(transactionDetails.closed_at)
          : new Date();
        // Add buffer days after closing
        endDate.setDate(endDate.getDate() + 30);

        // Build search query for contact emails
        // Gmail: "from:email1 OR from:email2 OR to:email1 OR to:email2"
        // Outlook: Similar but uses $filter
        const gmailQuery = contactEmails
          .map((email) => `from:${email} OR to:${email}`)
          .join(" OR ");

        logService.info("Fetching emails from provider", "Transactions", {
          contactEmailCount: contactEmails.length,
          gmailQuery: gmailQuery.substring(0, 100) + "...",
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        });

        let emailsFetched = 0;
        let emailsStored = 0;
        let providerUsed: "gmail" | "outlook" | null = null;

        // createCommunication and getCommunications are imported at the top

        // Check which provider the user is authenticated with
        const googleToken = await databaseService.getOAuthToken(userId, "google", "mailbox");
        const microsoftToken = await databaseService.getOAuthToken(userId, "microsoft", "mailbox");

        // Try Gmail first
        if (googleToken) {
          try {
            const isReady = await gmailFetchService.initialize(userId);
            if (isReady) {
              providerUsed = "gmail";
              const fetchedEmails = await gmailFetchService.searchEmails({
                query: gmailQuery,
                after: startDate,
                before: endDate,
                maxResults: 100,
              });
              emailsFetched = fetchedEmails.length;

              // Check for duplicates using the deduplication service
              const enrichedEmails = await gmailFetchService.checkDuplicates(userId, fetchedEmails);

              // Store new emails
              // BACKLOG-506: Deduplication is handled by getEmailByExternalId below
              for (const email of enrichedEmails) {
                // Skip if already flagged as duplicate by deduplication service
                if (email.duplicateOf) {
                  logService.debug(`Skipping duplicate email: ${email.subject}`, "Transactions");
                  continue;
                }

                try {
                  // BACKLOG-506: Check if email exists (deduplication by provider ID)
                  let emailRecord = await getEmailByExternalId(userId, email.id);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: userId,
                      external_id: email.id,  // Gmail API message ID
                      source: "gmail",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // Create junction link in communications (no content, just IDs)
                  await createCommunication({
                    user_id: userId,
                    transaction_id: validatedTransactionId,  // HOTFIX: Link to transaction!
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "scan",
                    link_confidence: 0.9,
                    has_attachments: email.hasAttachments || false,
                    is_false_positive: false,
                  });
                  emailsStored++;
                } catch (storeError) {
                  logService.warn(`Failed to store email: ${email.subject}`, "Transactions", {
                    error: storeError instanceof Error ? storeError.message : "Unknown",
                  });
                }
              }
              logService.info(`Gmail: Fetched ${emailsFetched}, stored ${emailsStored}`, "Transactions");
            }
          } catch (gmailError) {
            logService.warn("Failed to fetch from Gmail", "Transactions", {
              error: gmailError instanceof Error ? gmailError.message : "Unknown",
            });
          }
        }

        // Try Outlook if Gmail didn't work
        if (!providerUsed && microsoftToken) {
          try {
            const isReady = await outlookFetchService.initialize(userId);
            if (isReady) {
              providerUsed = "outlook";
              // Outlook uses OData filter, so we need to format the query differently
              // Build a query that searches for contact emails in subject or body
              // The searchEmails method handles the filtering
              const fetchedEmails = await outlookFetchService.searchEmails({
                // Outlook's search is less flexible, so just use date range
                // and filter by contact emails client-side
                after: startDate,
                before: endDate,
                maxResults: 200, // Fetch more since we'll filter client-side
              });

              // Filter to only emails involving our contacts
              const relevantEmails = fetchedEmails.filter((email: { from?: string | null; to?: string | null; cc?: string | null }) => {
                const fromEmail = email.from?.toLowerCase() || "";
                const toEmails = email.to?.toLowerCase() || "";
                const ccEmails = email.cc?.toLowerCase() || "";
                return contactEmails.some(
                  (contactEmail) =>
                    fromEmail.includes(contactEmail) ||
                    toEmails.includes(contactEmail) ||
                    ccEmails.includes(contactEmail)
                );
              });

              emailsFetched = relevantEmails.length;

              // Check for duplicates
              const enrichedEmails = await outlookFetchService.checkDuplicates(userId, relevantEmails);

              // Store new emails
              // BACKLOG-506: Deduplication is handled by getEmailByExternalId below
              for (const email of enrichedEmails) {
                if (email.duplicateOf) {
                  continue;
                }

                try {
                  // BACKLOG-506: Check if email exists (deduplication by provider ID)
                  let emailRecord = await getEmailByExternalId(userId, email.id);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: userId,
                      external_id: email.id,  // Outlook API message ID
                      source: "outlook",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // Create junction link in communications (no content, just IDs)
                  await createCommunication({
                    user_id: userId,
                    transaction_id: validatedTransactionId,  // HOTFIX: Link to transaction!
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "scan",
                    link_confidence: 0.9,
                    has_attachments: email.hasAttachments || false,
                    is_false_positive: false,
                  });
                  emailsStored++;
                } catch (storeError) {
                  logService.warn(`Failed to store email: ${email.subject}`, "Transactions", {
                    error: storeError instanceof Error ? storeError.message : "Unknown",
                  });
                }
              }
              logService.info(`Outlook: Fetched ${emailsFetched}, stored ${emailsStored}`, "Transactions");
            }
          } catch (outlookError) {
            logService.warn("Failed to fetch from Outlook", "Transactions", {
              error: outlookError instanceof Error ? outlookError.message : "Unknown",
            });
          }
        }

        if (!providerUsed) {
          return {
            success: false,
            error: "No email account connected. Please connect Gmail or Outlook in Settings.",
          };
        }

        // Now run auto-link to link the newly fetched emails to this transaction
        let totalEmailsLinked = 0;
        let totalMessagesLinked = 0;
        let totalAlreadyLinked = 0;
        let totalErrors = 0;

        for (const assignment of contactAssignments) {
          try {
            const result = await autoLinkCommunicationsForContact({
              contactId: assignment.contact_id,
              transactionId: validatedTransactionId,
            });

            totalEmailsLinked += result.emailsLinked;
            totalMessagesLinked += result.messagesLinked;
            totalAlreadyLinked += result.alreadyLinked;
            totalErrors += result.errors;
          } catch (error) {
            totalErrors++;
            logService.warn(
              `Auto-link failed for contact ${assignment.contact_id}`,
              "Transactions",
              {
                error: error instanceof Error ? error.message : "Unknown",
              }
            );
          }
        }

        logService.info("Sync and fetch emails complete", "Transactions", {
          transactionId: validatedTransactionId,
          provider: providerUsed,
          emailsFetched,
          emailsStored,
          totalEmailsLinked,
          totalMessagesLinked,
          totalAlreadyLinked,
          totalErrors,
        });

        return {
          success: true,
          provider: providerUsed,
          emailsFetched,
          emailsStored,
          totalEmailsLinked,
          totalMessagesLinked,
          totalAlreadyLinked,
          totalErrors,
        };
      } catch (error) {
        logService.error("Sync and fetch emails failed", "Transactions", {
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

  // ============================================
  // SYNC HANDLERS (BACKLOG-395)
  // ============================================

  // Set main window reference for sync service and start periodic sync
  if (mainWindow) {
    submissionSyncService.setMainWindow(mainWindow);
    // Start periodic sync with 1 minute interval
    // Sync will only query for transactions that have been submitted but not in terminal states
    submissionSyncService.startPeriodicSync(60000);
  }

  // Sync all submission statuses from cloud
  ipcMain.handle(
    "transactions:sync-submissions",
    async (): Promise<TransactionResponse> => {
      try {
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
      } catch (error) {
        logService.error("Manual sync failed", "SubmissionSync", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Sync a specific transaction's submission status
  ipcMain.handle(
    "transactions:sync-submission",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      try {
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
      } catch (error) {
        logService.error("Single sync failed", "SubmissionSync", {
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

  // TASK-1776: Get attachments for a specific email
  ipcMain.handle(
    "emails:get-attachments",
    async (
      event: IpcMainInvokeEvent,
      emailId: string,
    ): Promise<TransactionResponse> => {
      try {
        if (!emailId || typeof emailId !== "string") {
          throw new ValidationError("Email ID is required", "emailId");
        }

        const attachments = await emailAttachmentService.getAttachmentsForEmail(emailId);

        return {
          success: true,
          data: attachments,
        };
      } catch (error) {
        logService.error("Failed to get email attachments", "Transactions", {
          emailId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // TASK-1776: Open attachment with system viewer
  ipcMain.handle(
    "attachments:open",
    async (
      event: IpcMainInvokeEvent,
      storagePath: string,
    ): Promise<TransactionResponse> => {
      try {
        if (!storagePath || typeof storagePath !== "string") {
          throw new ValidationError("Storage path is required", "storagePath");
        }

        // Security: Validate path is within app data directory
        const appDataPath = require("electron").app.getPath("userData");
        const normalizedPath = require("path").normalize(storagePath);
        if (!normalizedPath.startsWith(appDataPath)) {
          throw new ValidationError("Invalid attachment path", "storagePath");
        }

        const result = await shell.openPath(normalizedPath);

        if (result) {
          // shell.openPath returns empty string on success, error message on failure
          return {
            success: false,
            error: result,
          };
        }

        return { success: true };
      } catch (error) {
        logService.error("Failed to open attachment", "Transactions", {
          storagePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Fix for TASK-1778: Get attachment data as base64 for CSP-safe image preview
  // CSP blocks file:// URLs, so we read the file and return as data: URL
  ipcMain.handle(
    "attachments:get-data",
    async (
      event: IpcMainInvokeEvent,
      storagePath: string,
      mimeType: string,
    ): Promise<TransactionResponse> => {
      try {
        if (!storagePath || typeof storagePath !== "string") {
          throw new ValidationError("Storage path is required", "storagePath");
        }

        // Security: Validate path is within app data directory
        const appDataPath = require("electron").app.getPath("userData");
        const normalizedPath = require("path").normalize(storagePath);
        if (!normalizedPath.startsWith(appDataPath)) {
          throw new ValidationError("Invalid attachment path", "storagePath");
        }

        // Read file as buffer and convert to base64
        const fs = require("fs");
        const buffer = fs.readFileSync(normalizedPath);
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${mimeType || "application/octet-stream"};base64,${base64}`;

        return {
          success: true,
          data: dataUrl,
        };
      } catch (error) {
        logService.error("Failed to get attachment data", "Transactions", {
          storagePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // TASK-1781: Get attachment counts for transaction (from actual downloaded files)
  // Returns counts from the attachments table, matching what submission service uploads
  ipcMain.handle(
    "transactions:get-attachment-counts",
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      auditStart?: string,
      auditEnd?: string,
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

        const db = databaseService.getRawDatabase();

        // Build date filter params
        const textDateParams: string[] = [validatedTransactionId];
        const emailDateParams: string[] = [validatedTransactionId];

        let textDateFilter = "";
        let emailDateFilter = "";

        if (auditStart) {
          textDateFilter += " AND m.sent_at >= ?";
          textDateParams.push(auditStart);
          emailDateFilter += " AND e.sent_at >= ?";
          emailDateParams.push(auditStart);
        }

        if (auditEnd) {
          // Add end of day to include all messages on the end date
          const endDate = new Date(auditEnd);
          endDate.setHours(23, 59, 59, 999);
          const endDateStr = endDate.toISOString();
          textDateFilter += " AND m.sent_at <= ?";
          textDateParams.push(endDateStr);
          emailDateFilter += " AND e.sent_at <= ?";
          emailDateParams.push(endDateStr);
        }

        // Count text message attachments (via message_id -> messages -> communications)
        // Mirrors the query in submissionService.loadTransactionAttachments
        const textCountSql = `
          SELECT COUNT(DISTINCT a.id) as count
          FROM attachments a
          INNER JOIN messages m ON a.message_id = m.id
          INNER JOIN communications c ON (
            (c.message_id IS NOT NULL AND c.message_id = m.id)
            OR
            (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
          )
          WHERE c.transaction_id = ?
          AND a.message_id IS NOT NULL
          AND a.storage_path IS NOT NULL
          ${textDateFilter}
        `;

        const textResult = db.prepare(textCountSql).get(...textDateParams) as { count: number };

        // Count email attachments (via email_id -> communications -> emails)
        const emailCountSql = `
          SELECT COUNT(DISTINCT a.id) as count
          FROM attachments a
          INNER JOIN emails e ON a.email_id = e.id
          INNER JOIN communications c ON c.email_id = e.id
          WHERE c.transaction_id = ?
          AND a.email_id IS NOT NULL
          AND a.storage_path IS NOT NULL
          ${emailDateFilter}
        `;

        const emailResult = db.prepare(emailCountSql).get(...emailDateParams) as { count: number };

        // Calculate total size of all attachments (text + email)
        const textSizeSql = `
          SELECT COALESCE(SUM(a.file_size_bytes), 0) as total_size
          FROM attachments a
          INNER JOIN messages m ON a.message_id = m.id
          INNER JOIN communications c ON (
            (c.message_id IS NOT NULL AND c.message_id = m.id)
            OR
            (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
          )
          WHERE c.transaction_id = ?
          AND a.message_id IS NOT NULL
          AND a.storage_path IS NOT NULL
          ${textDateFilter}
        `;

        const emailSizeSql = `
          SELECT COALESCE(SUM(a.file_size_bytes), 0) as total_size
          FROM attachments a
          INNER JOIN emails e ON a.email_id = e.id
          INNER JOIN communications c ON c.email_id = e.id
          WHERE c.transaction_id = ?
          AND a.email_id IS NOT NULL
          AND a.storage_path IS NOT NULL
          ${emailDateFilter}
        `;

        const textSizeResult = db.prepare(textSizeSql).get(...textDateParams) as { total_size: number };
        const emailSizeResult = db.prepare(emailSizeSql).get(...emailDateParams) as { total_size: number };

        const textAttachments = textResult?.count || 0;
        const emailAttachments = emailResult?.count || 0;
        const totalSizeBytes = (textSizeResult?.total_size || 0) + (emailSizeResult?.total_size || 0);

        return {
          success: true,
          data: {
            textAttachments,
            emailAttachments,
            total: textAttachments + emailAttachments,
            totalSizeBytes,
          },
        };
      } catch (error) {
        logService.error("Failed to get attachment counts", "Transactions", {
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

  // TASK-1783: Get attachment buffer as base64 (for DOCX conversion with mammoth)
  // Unlike get-data, this returns raw base64 without data: URL prefix
  ipcMain.handle(
    "attachments:get-buffer",
    async (
      event: IpcMainInvokeEvent,
      storagePath: string,
    ): Promise<TransactionResponse> => {
      try {
        if (!storagePath || typeof storagePath !== "string") {
          throw new ValidationError("Storage path is required", "storagePath");
        }

        // Security: Validate path is within app data directory
        const appDataPath = require("electron").app.getPath("userData");
        const normalizedPath = require("path").normalize(storagePath);
        if (!normalizedPath.startsWith(appDataPath)) {
          throw new ValidationError("Invalid attachment path", "storagePath");
        }

        // Read file as buffer and convert to base64
        const fs = require("fs");
        const buffer = fs.readFileSync(normalizedPath);
        const base64 = buffer.toString("base64");

        return {
          success: true,
          data: base64,
        };
      } catch (error) {
        logService.error("Failed to get attachment buffer", "Transactions", {
          storagePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
};
