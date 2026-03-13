/**
 * Typed IPC error contract for standardized error handling across all IPC handlers.
 *
 * This module defines the canonical error types and result shapes for IPC communication
 * between the Electron main process and renderer. It pairs with `wrapHandler` utility
 * to provide consistent error handling across all handler files.
 *
 * @module types/ipc-errors
 */

/**
 * Standardized error codes for IPC handler errors.
 * Used to classify errors for consistent handling on the renderer side.
 */
export enum IpcErrorCode {
  /** Unclassified or unexpected error */
  UNKNOWN = "UNKNOWN",
  /** Input validation failed (e.g., missing required field, invalid format) */
  VALIDATION = "VALIDATION",
  /** Requested resource was not found */
  NOT_FOUND = "NOT_FOUND",
  /** User lacks permission for the requested action */
  PERMISSION = "PERMISSION",
  /** Database operation failed */
  DATABASE = "DATABASE",
  /** Network request failed (e.g., Supabase, OAuth provider) */
  NETWORK = "NETWORK",
  /** Operation timed out */
  TIMEOUT = "TIMEOUT",
  /** Authentication or session error */
  AUTH = "AUTH",
  /** File system operation failed */
  FILESYSTEM = "FILESYSTEM",
}

/**
 * Standard error shape returned by IPC handlers on failure.
 * All failed IPC responses include `success: false` and an error message string.
 *
 * Note: The current `wrapHandler` returns `{ success: false, error: string }` for
 * backward compatibility with the renderer. The `IpcErrorCode` is available for
 * future use when the renderer is updated to handle structured errors (TASK-2170).
 */
export interface IpcError {
  success: false;
  error: string;
}

/**
 * Standard success shape returned by IPC handlers.
 * The `data` field type varies per handler.
 */
export interface IpcSuccess<T = unknown> {
  success: true;
  data: T;
}

/**
 * Union type representing either a successful or failed IPC result.
 */
export type IpcResult<T = unknown> = IpcSuccess<T> | IpcError;
