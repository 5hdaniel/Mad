/**
 * useMacOSMessagesImport Hook
 *
 * Handles automatic import of messages from macOS Messages app on startup.
 * Only runs on macOS when Full Disk Access permission is granted.
 *
 * @module hooks/useMacOSMessagesImport
 */

import { useEffect, useRef, useCallback } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { shouldSkipMessagesSync } from "./useSyncStatus";

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
  const hasImportedRef = useRef(false);
  const isImportingRef = useRef(false);

  const triggerImport = useCallback(async () => {
    if (!userId || isImportingRef.current) return;

    isImportingRef.current = true;
    try {
      const result = await window.api.messages.importMacOSMessages(userId);
      if (result.success) {
        // Log success for debugging
        if (result.messagesImported > 0) {
          // Messages imported successfully - this is normal background operation
        }
      } else if (result.error) {
        // Only log actual errors, not permission issues (expected when FDA not granted)
        if (!result.error.includes("Full Disk Access")) {
          console.warn("[useMacOSMessagesImport] Import failed:", result.error);
        }
      }
    } catch (error) {
      console.error("[useMacOSMessagesImport] Import error:", error);
    } finally {
      isImportingRef.current = false;
    }
  }, [userId]);

  // Auto-import on startup (runs once per app session)
  useEffect(() => {
    // Skip if any conditions not met
    if (!isMacOS) return;
    if (!userId) return;
    if (!hasPermissions) return;
    if (!isDatabaseInitialized) return;
    if (isOnboarding) return;
    if (hasImportedRef.current) return;

    // Check if we just imported during onboarding - skip to avoid duplicate import
    // Note: shouldSkipMessagesSync() also clears the flag, but useSyncStatus.runAutoSync
    // will also check and clear it - the first one to run will clear it
    if (shouldSkipMessagesSync()) {
      console.log("[useMacOSMessagesImport] Skipping import - just completed onboarding import");
      hasImportedRef.current = true; // Mark as done to prevent future attempts this session
      return;
    }

    // Mark as imported to prevent duplicate runs
    hasImportedRef.current = true;

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
