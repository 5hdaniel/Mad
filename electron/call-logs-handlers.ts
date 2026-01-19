// ============================================
// CALL LOGS IPC HANDLERS
// Manages phone call log history for compliance audit packages
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { callLogsService } from "./services/callLogsService";
import auditService from "./services/auditService";
import logService from "./services/logService";
import type {
  CallLog,
  NewCallLog,
  UpdateCallLog,
  CallLogFilters,
  CallLogWithContacts,
} from "./types/models";

import {
  ValidationError,
  validateUserId,
  validateString,
  validateTransactionId,
} from "./utils/validation";

// Response type for call log handlers
interface CallLogResponse {
  success: boolean;
  error?: string;
  callLog?: CallLog;
  callLogs?: CallLog[] | CallLogWithContacts[];
  count?: number;
  stats?: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    missedCalls: number;
    totalDuration: number;
    transactionRelatedCalls: number;
  };
}

/**
 * Validate call log ID
 */
function validateCallLogId(id: unknown): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new ValidationError("Call log ID is required", "callLogId");
  }
  return id.trim();
}

/**
 * Validate new call log data
 */
function validateNewCallLog(data: unknown): NewCallLog {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Call log data is required", "data");
  }

  const callLog = data as Partial<NewCallLog>;

  if (!callLog.user_id) {
    throw new ValidationError("User ID is required", "user_id");
  }

  if (!callLog.source) {
    throw new ValidationError("Source is required", "source");
  }

  if (!callLog.call_type) {
    throw new ValidationError("Call type is required", "call_type");
  }

  // Validate source value
  const validSources = ["manual", "iphone_backup", "android_backup", "import"];
  if (!validSources.includes(callLog.source)) {
    throw new ValidationError(
      `Invalid source. Must be one of: ${validSources.join(", ")}`,
      "source",
    );
  }

  // Validate call_type value
  const validCallTypes = ["voice", "video", "voicemail"];
  if (!validCallTypes.includes(callLog.call_type)) {
    throw new ValidationError(
      `Invalid call type. Must be one of: ${validCallTypes.join(", ")}`,
      "call_type",
    );
  }

  // Validate direction if provided
  if (callLog.direction) {
    const validDirections = ["inbound", "outbound", "missed"];
    if (!validDirections.includes(callLog.direction)) {
      throw new ValidationError(
        `Invalid direction. Must be one of: ${validDirections.join(", ")}`,
        "direction",
      );
    }
  }

  // Validate outcome if provided
  if (callLog.outcome) {
    const validOutcomes = ["completed", "missed", "declined", "voicemail", "failed", "cancelled"];
    if (!validOutcomes.includes(callLog.outcome)) {
      throw new ValidationError(
        `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`,
        "outcome",
      );
    }
  }

  return callLog as NewCallLog;
}

/**
 * Register all call log IPC handlers
 */
export function registerCallLogsHandlers(): void {
  // Get all call logs for a user
  ipcMain.handle(
    "call-logs:get-all",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Getting all call logs", "CallLogs", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const callLogs = await callLogsService.getByUserId(validatedUserId);

        logService.info(`Found ${callLogs.length} call logs`, "CallLogs", {
          userId,
        });

        return {
          success: true,
          callLogs,
          count: callLogs.length,
        };
      } catch (error) {
        logService.error("Get call logs failed", "CallLogs", {
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

  // Get call logs with contact details
  ipcMain.handle(
    "call-logs:get-with-contacts",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Getting call logs with contacts", "CallLogs", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const callLogs = await callLogsService.getWithContacts(validatedUserId);

        return {
          success: true,
          callLogs,
          count: callLogs.length,
        };
      } catch (error) {
        logService.error("Get call logs with contacts failed", "CallLogs", {
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

  // Get call logs for a transaction
  ipcMain.handle(
    "call-logs:get-by-transaction",
    async (
      _event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Getting call logs for transaction", "CallLogs", {
          transactionId,
        });

        const validatedId = validateTransactionId(transactionId, true);
        if (!validatedId) {
          throw new ValidationError("Transaction ID is required", "transactionId");
        }

        const callLogs = await callLogsService.getByTransactionId(validatedId);

        return {
          success: true,
          callLogs,
          count: callLogs.length,
        };
      } catch (error) {
        logService.error("Get call logs by transaction failed", "CallLogs", {
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

  // Get filtered call logs
  ipcMain.handle(
    "call-logs:get-filtered",
    async (
      _event: IpcMainInvokeEvent,
      filters: CallLogFilters,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Getting filtered call logs", "CallLogs", { filters });

        const callLogs = await callLogsService.getFiltered(filters);

        return {
          success: true,
          callLogs,
          count: callLogs.length,
        };
      } catch (error) {
        logService.error("Get filtered call logs failed", "CallLogs", {
          filters,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Create a new call log
  ipcMain.handle(
    "call-logs:create",
    async (
      _event: IpcMainInvokeEvent,
      callLogData: NewCallLog,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Creating call log", "CallLogs", {
          userId: callLogData.user_id,
        });

        const validatedData = validateNewCallLog(callLogData);

        const callLog = await auditService.withAudit(
          {
            userId: validatedData.user_id,
            action: "DATA_ACCESS",
            resourceType: "COMMUNICATION",
            metadata: { operation: "call_log_create" },
          },
          async () => {
            return callLogsService.create(validatedData);
          },
        );

        return {
          success: true,
          callLog,
        };
      } catch (error) {
        logService.error("Create call log failed", "CallLogs", {
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

  // Update a call log
  ipcMain.handle(
    "call-logs:update",
    async (
      _event: IpcMainInvokeEvent,
      callLogId: string,
      updates: Partial<CallLog>,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Updating call log", "CallLogs", { callLogId });

        const validatedId = validateCallLogId(callLogId);

        const updateData: UpdateCallLog = {
          id: validatedId,
          ...updates,
        };

        const callLog = await callLogsService.update(updateData);

        return {
          success: true,
          callLog,
        };
      } catch (error) {
        logService.error("Update call log failed", "CallLogs", {
          callLogId,
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

  // Delete a call log
  ipcMain.handle(
    "call-logs:delete",
    async (
      _event: IpcMainInvokeEvent,
      callLogId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Deleting call log", "CallLogs", { callLogId });

        const validatedId = validateCallLogId(callLogId);

        const deleted = await callLogsService.delete(validatedId);

        return {
          success: deleted,
          error: deleted ? undefined : "Call log not found",
        };
      } catch (error) {
        logService.error("Delete call log failed", "CallLogs", {
          callLogId,
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

  // Link call log to transaction
  ipcMain.handle(
    "call-logs:link-to-transaction",
    async (
      _event: IpcMainInvokeEvent,
      callLogId: string,
      transactionId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Linking call log to transaction", "CallLogs", {
          callLogId,
          transactionId,
        });

        const validatedCallLogId = validateCallLogId(callLogId);
        const validatedTransactionId = validateTransactionId(transactionId, true);
        if (!validatedTransactionId) {
          throw new ValidationError("Transaction ID is required", "transactionId");
        }

        const callLog = await callLogsService.linkToTransaction(
          validatedCallLogId,
          validatedTransactionId,
        );

        return {
          success: true,
          callLog,
        };
      } catch (error) {
        logService.error("Link call log to transaction failed", "CallLogs", {
          callLogId,
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

  // Unlink call log from transaction
  ipcMain.handle(
    "call-logs:unlink-from-transaction",
    async (
      _event: IpcMainInvokeEvent,
      callLogId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Unlinking call log from transaction", "CallLogs", {
          callLogId,
        });

        const validatedId = validateCallLogId(callLogId);

        const callLog = await callLogsService.unlinkFromTransaction(validatedId);

        return {
          success: true,
          callLog,
        };
      } catch (error) {
        logService.error("Unlink call log from transaction failed", "CallLogs", {
          callLogId,
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

  // Get call log statistics
  ipcMain.handle(
    "call-logs:get-stats",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Getting call log stats", "CallLogs", { userId });

        const validatedUserId = validateUserId(userId);
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        const stats = await callLogsService.getStats(validatedUserId);

        return {
          success: true,
          stats,
        };
      } catch (error) {
        logService.error("Get call log stats failed", "CallLogs", {
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

  // Get call log count for transaction
  ipcMain.handle(
    "call-logs:get-count-for-transaction",
    async (
      _event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<CallLogResponse> => {
      try {
        const validatedId = validateTransactionId(transactionId, true);
        if (!validatedId) {
          throw new ValidationError("Transaction ID is required", "transactionId");
        }

        const count = await callLogsService.getCountForTransaction(validatedId);

        return {
          success: true,
          count,
        };
      } catch (error) {
        logService.error("Get call log count failed", "CallLogs", {
          transactionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Bulk create call logs (for imports)
  ipcMain.handle(
    "call-logs:bulk-create",
    async (
      _event: IpcMainInvokeEvent,
      callLogs: NewCallLog[],
    ): Promise<CallLogResponse> => {
      try {
        logService.info("Bulk creating call logs", "CallLogs", {
          count: callLogs.length,
        });

        // Validate each call log
        const validatedLogs = callLogs.map((log) => validateNewCallLog(log));

        const count = await callLogsService.bulkCreate(validatedLogs);

        return {
          success: true,
          count,
        };
      } catch (error) {
        logService.error("Bulk create call logs failed", "CallLogs", {
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

  logService.info("Call logs handlers registered", "CallLogs");
}
