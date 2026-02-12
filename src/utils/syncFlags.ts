/**
 * Sync Flag Utilities
 *
 * Module-level flags to coordinate sync operations across components.
 * These prevent duplicate syncs when multiple code paths could trigger
 * the same sync operation (e.g., PermissionsStep vs useAutoRefresh).
 *
 * TASK-1786: Extracted from useMacOSMessagesImport.ts during cleanup.
 *
 * @module utils/syncFlags
 */

// Module-level flag to track if messages import has been triggered this session.
// This persists across component remounts and React StrictMode double-mounts.
// Used to coordinate between PermissionsStep (onboarding) and useAutoRefresh (dashboard).
let hasTriggeredMessagesImport = false;

/**
 * Check if messages import has been triggered this session.
 * Used by useAutoRefresh to avoid duplicate message syncs on macOS.
 */
export function hasMessagesImportTriggered(): boolean {
  return hasTriggeredMessagesImport;
}

/**
 * Mark messages import as triggered.
 * Called by PermissionsStep during onboarding to prevent duplicate imports
 * when the user lands on the dashboard.
 */
export function setMessagesImportTriggered(): void {
  hasTriggeredMessagesImport = true;
}

/**
 * Reset the import trigger flag.
 * Used for testing and logout scenarios.
 */
export function resetMessagesImportTrigger(): void {
  hasTriggeredMessagesImport = false;
}
