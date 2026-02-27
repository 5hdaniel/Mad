/**
 * Error Logging Service
 * TASK-1800: Production Error Logging to Supabase
 *
 * Submits user-facing errors to Supabase error_logs table for production monitoring.
 * Only logs errors shown on ErrorScreen - not all console.error calls.
 */

import supabaseService from "./supabaseService";
import { getDeviceId } from "./deviceService";
import logService from "./logService";
import { app } from "electron";
import os from "os";
import { randomUUID } from "crypto";

/**
 * Payload for submitting an error report
 */
export interface ErrorLogPayload {
  /** Type of error (e.g., 'app_error', 'auth_error', 'db_error') */
  errorType: string;
  /** Error code from AppError */
  errorCode?: string;
  /** Error message (user-safe, no PII) */
  errorMessage: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Current screen/route when error occurred */
  currentScreen?: string;
  /** User-provided feedback about what they were doing */
  userFeedback?: string;
  /** Navigation/action breadcrumbs leading to error */
  breadcrumbs?: Record<string, unknown>[];
  /** Sanitized app state snapshot (no PII) */
  appState?: Record<string, unknown>;
}

/**
 * Result of submitting an error log
 */
export interface ErrorLogResult {
  /** True if submission succeeded */
  success: boolean;
  /** UUID of the created error_log record (if successful) */
  errorId?: string;
  /** Error message if submission failed */
  error?: string;
}

/**
 * Service for submitting error logs to Supabase.
 * Handles offline queueing and PII sanitization.
 */
class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private offlineQueue: ErrorLogPayload[] = [];
  private isProcessingQueue = false;
  private sessionId: string;

  private constructor() {
    // Generate a unique session ID for this app session using cryptographic randomness
    this.sessionId = `session_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  /**
   * Submit an error report to Supabase
   * Queues for later if offline
   */
  async submitError(payload: ErrorLogPayload): Promise<ErrorLogResult> {
    try {
      const client = supabaseService.getClient();

      // Get current user if authenticated (optional - errors can be logged anonymously)
      let userId: string | null = null;
      try {
        const { data: { user } } = await client.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // User may not be authenticated - that's OK
      }

      // Get system info
      const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      let diskFreeGB: number | null = null;
      try {
        const freeMemory = os.freemem();
        diskFreeGB = Math.round((freeMemory / 1024 / 1024 / 1024) * 100) / 100;
      } catch {
        // May not be available on all platforms
      }

      const logEntry = {
        user_id: userId,
        device_id: this.getDeviceIdSafe(),
        session_id: this.sessionId,
        app_version: app.getVersion(),
        electron_version: process.versions.electron,
        os_name: os.type(),
        os_version: os.release(),
        platform: process.platform,
        error_type: payload.errorType,
        error_code: payload.errorCode ?? null,
        error_message: payload.errorMessage,
        stack_trace: payload.stackTrace ?? null,
        current_screen: payload.currentScreen ?? null,
        user_feedback: payload.userFeedback ?? null,
        breadcrumbs: payload.breadcrumbs ?? null,
        app_state: this.sanitizeAppState(payload.appState),
        network_status: this.getNetworkStatus(),
        memory_usage_mb: memoryUsageMB,
        disk_free_gb: diskFreeGB,
        error_timestamp: new Date().toISOString(),
      };

      const { data, error } = await client
        .from("error_logs")
        .insert(logEntry)
        .select("id")
        .single();

      if (error) {
        logService.warn("[ErrorLogging] Failed to submit error to Supabase", "ErrorLoggingService", {
          error: error.message,
        });
        // Queue for retry
        this.queueForRetry(payload);
        return { success: false, error: error.message };
      }

      logService.info("[ErrorLogging] Error submitted successfully", "ErrorLoggingService", {
        errorId: data.id,
        errorType: payload.errorType,
      });

      return { success: true, errorId: data.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logService.error("[ErrorLogging] Exception submitting error", "ErrorLoggingService", {
        error: errorMessage,
      });
      // Queue for retry
      this.queueForRetry(payload);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get device ID safely with fallback
   */
  private getDeviceIdSafe(): string {
    try {
      return getDeviceId();
    } catch (error) {
      logService.warn("[ErrorLogging] Failed to get device ID", "ErrorLoggingService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return `unknown_${os.hostname()}`;
    }
  }

  /**
   * Get network status (online/offline)
   */
  private getNetworkStatus(): string {
    // In Electron main process, we can't use navigator.onLine
    // Use a simple check based on DNS resolution
    return "unknown"; // Simplified - could be enhanced with actual network check
  }

  /**
   * Sanitize app state to remove any PII
   * CRITICAL: Never include transaction details, contact names, message content
   */
  private sanitizeAppState(appState?: Record<string, unknown>): Record<string, unknown> | null {
    if (!appState) return null;

    // Create a safe copy, excluding PII-containing fields
    const piiFields = [
      "transactions",
      "contacts",
      "messages",
      "emails",
      "addresses",
      "phoneNumbers",
      "names",
      "user",
      "userData",
      "profile",
      "credentials",
      "tokens",
      "apiKeys",
    ];

    const safeState: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(appState)) {
      // Skip PII fields
      if (piiFields.includes(key.toLowerCase())) {
        continue;
      }

      // For nested objects, only include primitive values or counts
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          // For arrays, just include the count
          safeState[`${key}Count`] = value.length;
        } else {
          // For objects, skip them to be safe
          safeState[`${key}Type`] = "object";
        }
      } else {
        // Include primitive values (string, number, boolean, null)
        safeState[key] = value;
      }
    }

    return Object.keys(safeState).length > 0 ? safeState : null;
  }

  /**
   * Queue an error for retry when connection is restored
   */
  private queueForRetry(payload: ErrorLogPayload): void {
    // Limit queue size to prevent memory issues
    const MAX_QUEUE_SIZE = 50;
    if (this.offlineQueue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest entry
      this.offlineQueue.shift();
    }
    this.offlineQueue.push(payload);
    logService.debug("[ErrorLogging] Error queued for retry", "ErrorLoggingService", {
      queueSize: this.offlineQueue.length,
    });
  }

  /**
   * Process queued errors (call when connection is restored)
   * Returns the number of successfully processed items
   */
  async processOfflineQueue(): Promise<number> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return 0;
    }

    this.isProcessingQueue = true;
    let processedCount = 0;

    try {
      // Process items in order
      while (this.offlineQueue.length > 0) {
        const payload = this.offlineQueue[0];
        const result = await this.submitError(payload);

        if (result.success) {
          // Remove from queue only if successful
          this.offlineQueue.shift();
          processedCount++;
        } else {
          // Stop processing on first failure (will retry later)
          break;
        }
      }

      logService.info("[ErrorLogging] Processed offline queue", "ErrorLoggingService", {
        processed: processedCount,
        remaining: this.offlineQueue.length,
      });
    } finally {
      this.isProcessingQueue = false;
    }

    return processedCount;
  }

  /**
   * Get current queue size (for diagnostics)
   */
  getQueueSize(): number {
    return this.offlineQueue.length;
  }
}

// Export singleton instance getter
export const getErrorLoggingService = (): ErrorLoggingService => {
  return ErrorLoggingService.getInstance();
};

export default ErrorLoggingService;
