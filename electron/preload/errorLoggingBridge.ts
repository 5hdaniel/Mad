/**
 * Error Logging Bridge
 * TASK-1800: Production Error Logging to Supabase
 *
 * Exposes error logging IPC methods to renderer process.
 */

import { ipcRenderer } from "electron";

/**
 * Payload for submitting an error report (matches main process type)
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
 * Error logging bridge for renderer process
 */
export const errorLoggingBridge = {
  /**
   * Submit an error report to Supabase
   * @param payload - Error details and user feedback
   * @returns Result with success status and error ID
   */
  submit: (payload: ErrorLogPayload): Promise<ErrorLogResult> =>
    ipcRenderer.invoke("error-logging:submit", payload),

  /**
   * Process any queued errors (call when connection restored)
   * @returns Number of errors successfully processed
   */
  processQueue: (): Promise<{ success: boolean; processedCount?: number; error?: string }> =>
    ipcRenderer.invoke("error-logging:process-queue"),

  /**
   * Get current queue size (for diagnostics)
   * @returns Queue size
   */
  getQueueSize: (): Promise<{ success: boolean; queueSize?: number; error?: string }> =>
    ipcRenderer.invoke("error-logging:get-queue-size"),
};
