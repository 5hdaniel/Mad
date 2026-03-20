/**
 * User-Facing Error Message Formatters (TASK-2276)
 *
 * Generates structured, actionable error messages for sync and disk failures.
 * These messages are displayed to the user via the enriched error event payload.
 *
 * Each formatter returns a UserFacingError with:
 * - title: Short heading for the error
 * - description: Detailed explanation with specific numbers where available
 * - actionSuggestion: What the user should do to resolve the issue
 * - code: Programmatic error code for UI handling
 *
 * IMPORTANT: Messages must NEVER include technical details (stack traces, error codes).
 * Technical details go to Sentry via Phase 1 diagnostic tasks.
 */

export interface UserFacingError {
  title: string;
  description: string;
  actionSuggestion: string;
  /** Error code for programmatic handling */
  code: UserErrorCode;
}

export type UserErrorCode =
  | "INSUFFICIENT_DISK_SPACE"
  | "MISSING_DRIVERS"
  | "DRIVER_SERVICE_STOPPED"
  | "DEVICE_NOT_DETECTED"
  | "SYNC_FAILED";

/**
 * Format a human-readable size string from megabytes.
 * Shows GB for values >= 1024 MB, otherwise MB.
 */
function formatSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${Math.round(mb)}MB`;
}

/**
 * Format error for insufficient disk space.
 * Includes the actual available and required amounts so the user
 * knows exactly how much space to free.
 */
export function formatDiskSpaceError(
  availableMB: number,
  requiredMB: number,
): UserFacingError {
  const availableStr = formatSize(availableMB);
  const requiredStr = formatSize(requiredMB);

  return {
    title: "Insufficient Disk Space",
    description: `iPhone sync requires at least ${requiredStr} of free space. You currently have ${availableStr} available.`,
    actionSuggestion:
      "Free up disk space by deleting unnecessary files, then try syncing again.",
    code: "INSUFFICIENT_DISK_SPACE",
  };
}

/**
 * Format error for missing Apple Mobile Device Support drivers (Windows only).
 * Directs user to install via Settings > Sync Tools.
 */
export function formatMissingDriversError(): UserFacingError {
  return {
    title: "Sync Tools Not Installed",
    description:
      "iPhone sync requires Apple Mobile Device Support drivers which are not currently installed on your computer.",
    actionSuggestion:
      "Go to Settings and click 'Install Sync Tools' to set up the required drivers.",
    code: "MISSING_DRIVERS",
  };
}

/**
 * Format error for Apple Mobile Device Service installed but not running.
 * Suggests restart or repair via Settings.
 */
export function formatDriverServiceStoppedError(): UserFacingError {
  return {
    title: "Sync Service Not Running",
    description:
      "Apple Mobile Device Service is installed but not currently running. This is required for iPhone detection.",
    actionSuggestion:
      "Restart your computer, or go to Settings > Sync Tools to repair the installation.",
    code: "DRIVER_SERVICE_STOPPED",
  };
}

/**
 * Format error for iPhone not detected via USB.
 * Provides step-by-step troubleshooting instructions.
 */
export function formatDeviceNotDetectedError(): UserFacingError {
  return {
    title: "iPhone Not Detected",
    description:
      "No iPhone was found connected to your computer. Make sure your iPhone is plugged in via USB and that you've tapped 'Trust' on the device.",
    actionSuggestion:
      "1. Check your USB cable connection\n2. Look for a 'Trust This Computer?' prompt on your iPhone\n3. If prompted, tap 'Trust' and enter your passcode",
    code: "DEVICE_NOT_DETECTED",
  };
}

/**
 * Format a generic sync failure error.
 * Used as a fallback when the specific failure reason is unknown.
 *
 * @param message - Optional detail message (should not contain technical info)
 */
export function formatSyncFailedError(message?: string): UserFacingError {
  return {
    title: "Sync Failed",
    description: message
      ? `iPhone sync could not be completed: ${message}`
      : "iPhone sync could not be completed due to an unexpected error.",
    actionSuggestion:
      "Try disconnecting and reconnecting your iPhone, then attempt the sync again. If the problem persists, restart the application.",
    code: "SYNC_FAILED",
  };
}
