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
 * TASK-1742: Respects import source preference.
 * When 'iphone-sync' is selected, auto-import is skipped (user must manually sync).
 *
 * @module hooks/useMacOSMessagesImport
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { shouldSkipMessagesSync } from "./useAutoRefresh";
import type { ImportSource, UserPreferences } from "../services/settingsService";

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
  /** Current import source preference (TASK-1742) */
  importSource: ImportSource;
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
  // TASK-1742: Track import source preference
  const [importSource, setImportSource] = useState<ImportSource>("macos-native");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  // Load import source preference
  useEffect(() => {
    if (!userId || !isMacOS) {
      setPreferenceLoaded(true);
      return;
    }

    const loadPreference = async () => {
      try {
        const result = await window.api.preferences.get(userId);
        const prefs = result.preferences as UserPreferences | undefined;
        if (result.success && prefs?.messages?.source) {
          setImportSource(prefs.messages.source);
        }
      } catch (error) {
        console.warn("[useMacOSMessagesImport] Failed to load import source preference:", error);
      } finally {
        setPreferenceLoaded(true);
      }
    };

    loadPreference();
  }, [userId, isMacOS]);

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
  // TASK-1113: Uses module-level hasTriggeredImport to prevent duplicate triggers
  // across component remounts and React StrictMode double-mounts
  // TASK-1742: Respects import source preference (skips auto-import when iphone-sync selected)
  useEffect(() => {
    // Skip if any conditions not met
    if (!isMacOS) return;
    if (!userId) return;
    if (!hasPermissions) return;
    if (!isDatabaseInitialized) return;
    if (isOnboarding) return;
    // TASK-1742: Wait for preference to load before deciding
    if (!preferenceLoaded) return;
    // TASK-1742: Skip auto-import when iPhone sync is selected
    // User will manually trigger sync via the iPhone sync flow
    if (importSource === "iphone-sync") {
      console.log("[useMacOSMessagesImport] Skipping auto-import - iPhone sync is selected");
      return;
    }
    // TASK-1113: Use module-level flag instead of component-scoped ref
    // This ensures import only triggers once per app session, regardless of remounts
    if (hasTriggeredImport) return;

    // Check if we just imported during onboarding - skip to avoid duplicate import
    // Note: shouldSkipMessagesSync() also clears the flag, but useSyncStatus.runAutoSync
    // will also check and clear it - the first one to run will clear it
    if (shouldSkipMessagesSync()) {
      console.log("[useMacOSMessagesImport] Skipping import - just completed onboarding import");
      hasTriggeredImport = true; // Mark as done to prevent future attempts this session
      return;
    }

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
    preferenceLoaded,
    importSource,
  ]);

  return {
    triggerImport,
    isImporting: isImportingRef.current,
    importSource,
  };
}

export default useMacOSMessagesImport;
