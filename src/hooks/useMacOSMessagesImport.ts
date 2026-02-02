/**
 * useMacOSMessagesImport Hook
 *
 * Handles automatic import of messages from macOS Messages app on startup.
 * Only runs on macOS when Full Disk Access permission is granted.
 *
 * TASK-1113: Uses module-level guard to prevent duplicate sync triggers.
 * This is necessary because:
 * 1. React StrictMode causes effects to run twice in development
 * 2. Component remounts reset refs but not module-level state
 * 3. Multiple components using this hook would each get their own ref
 *
 * @module hooks/useMacOSMessagesImport
 */

import { useEffect, useRef, useCallback } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { syncQueue } from "../services/SyncQueueService";

// Module-level flag to track if import has been triggered this session.
// This persists across component remounts and React StrictMode double-mounts.
// TASK-1113: Fixes duplicate sync on dashboard load for returning users.
let hasTriggeredImport = false;

/**
 * Reset the import trigger flag.
 * Used for testing and logout scenarios.
 */
export function resetMessagesImportTrigger(): void {
  hasTriggeredImport = false;
}

/**
 * Mark messages import as triggered.
 * Called by PermissionsStep during onboarding to prevent duplicate imports
 * when the user lands on the dashboard.
 */
export function setMessagesImportTriggered(): void {
  hasTriggeredImport = true;
}

/**
 * Check if messages import has been triggered this session.
 * Used by useAutoRefresh to avoid duplicate message syncs on macOS.
 */
export function hasMessagesImportTriggered(): boolean {
  return hasTriggeredImport;
}

interface UseMacOSMessagesImportOptions {
  /** User ID to associate messages with */
  userId: string | null;
  /** Whether Full Disk Access permission is granted */
  hasPermissions: boolean;
  /** Whether database is initialized */
  isDatabaseInitialized: boolean;
  /** Whether this is during onboarding (skip auto-import if true) */
  isOnboarding?: boolean;
}

interface UseMacOSMessagesImportReturn {
  /** Manually trigger import */
  triggerImport: () => Promise<void>;
  /** Whether import is currently running */
  isImporting: boolean;
}

/**
 * Hook for automatic macOS Messages import on app startup.
 *
 * Automatically imports messages when:
 * - Platform is macOS
 * - User is authenticated (has userId)
 * - Full Disk Access permission is granted
 * - Database is initialized
 * - Not currently in onboarding flow
 *
 * The import runs in the background and doesn't block the UI.
 * Safe to call multiple times - messages are deduplicated.
 */
export function useMacOSMessagesImport({
  userId,
  hasPermissions,
  isDatabaseInitialized,
  isOnboarding = false,
}: UseMacOSMessagesImportOptions): UseMacOSMessagesImportReturn {
  const { isMacOS } = usePlatform();
  // Component-scoped ref for tracking import state during this render cycle
  // Note: hasTriggeredImport (module-level) prevents duplicate triggers across remounts
  const isImportingRef = useRef(false);

  const triggerImport = useCallback(async () => {
    if (!userId || isImportingRef.current) return;

    isImportingRef.current = true;

    // Update SyncQueueService so SyncStatusIndicator shows progress
    syncQueue.reset();
    syncQueue.queue('messages');
    syncQueue.start('messages');

    try {
      const result = await window.api.messages.importMacOSMessages(userId);
      if (result.success) {
        syncQueue.complete('messages');
        // Log success for debugging
        if (result.messagesImported > 0) {
          // Messages imported successfully - this is normal background operation
        }
      } else if (result.error) {
        syncQueue.error('messages', result.error);
        // Only log actual errors, not permission issues (expected when FDA not granted)
        if (!result.error.includes("Full Disk Access")) {
          console.warn("[useMacOSMessagesImport] Import failed:", result.error);
        }
      }
    } catch (error) {
      console.error("[useMacOSMessagesImport] Import error:", error);
      syncQueue.error('messages', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isImportingRef.current = false;
    }
  }, [userId]);

  // Auto-import on startup (runs once per app session)
  // TASK-1113: Uses module-level hasTriggeredImport to prevent duplicate triggers
  // across component remounts and React StrictMode double-mounts
  useEffect(() => {
    // Skip if any conditions not met
    if (!isMacOS) return;
    if (!userId) return;
    if (!hasPermissions) return;
    if (!isDatabaseInitialized) return;
    if (isOnboarding) return;
    // TASK-1113: Use module-level flag instead of component-scoped ref
    // This ensures import only triggers once per app session, regardless of remounts
    // Note: PermissionsStep calls setMessagesImportTriggered() during onboarding,
    // so hasTriggeredImport will already be true when user lands on dashboard
    if (hasTriggeredImport) return;

    // Mark as imported to prevent duplicate runs
    // TASK-1113: Module-level flag persists across remounts
    hasTriggeredImport = true;

    // Run import in background (non-blocking)
    // Small delay to let the app finish rendering first
    const timeoutId = setTimeout(() => {
      triggerImport();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    isMacOS,
    userId,
    hasPermissions,
    isDatabaseInitialized,
    isOnboarding,
    triggerImport,
  ]);

  return {
    triggerImport,
    isImporting: isImportingRef.current,
  };
}

export default useMacOSMessagesImport;
