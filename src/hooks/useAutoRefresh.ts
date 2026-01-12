/**
 * useAutoRefresh Hook
 *
 * TASK-1003: Auto-refresh data sources on app load.
 *
 * Automatically syncs all available data sources when the user opens
 * the application, eliminating the need to manually click "Auto Detect".
 *
 * Behavior:
 * - Triggers after auth + database ready + on dashboard
 * - Adds 2.5 second delay to not slow startup
 * - Runs syncs in parallel with Promise.allSettled
 * - Uses incremental sync (only new data)
 * - Handles errors silently (log only)
 * - Doesn't block UI
 *
 * Platform Matrix:
 * - Gmail: All platforms (API - fetch new emails since last sync)
 * - Outlook: All platforms (API - fetch new emails since last sync)
 * - Text Messages: macOS only (Local iMessage database)
 * - Contacts: macOS only (Local Contacts database)
 * - iPhone Backup: NOT triggered (requires manual device connection)
 *
 * @module hooks/useAutoRefresh
 */

import { useEffect, useCallback, useState } from "react";
import { usePlatform } from "../contexts/PlatformContext";

// Module-level flag to track if onboarding import just completed
// This is more reliable than localStorage across component remounts
let skipNextMessagesSync = false;

// Module-level flag to track if auto-refresh has been triggered this session
// Using module-level prevents React strict mode from triggering twice
let hasTriggeredAutoRefresh = false;

/**
 * Mark that onboarding import just completed - skip the next messages sync
 */
export function markOnboardingImportComplete(): void {
  console.log(
    "[useAutoRefresh] Marking onboarding import complete - will skip next messages sync"
  );
  skipNextMessagesSync = true;
}

/**
 * Check if we should skip the next messages sync
 * Does NOT clear the flag - only runAutoRefresh clears it
 */
export function shouldSkipMessagesSync(): boolean {
  return skipNextMessagesSync;
}

/**
 * Reset the auto-refresh trigger (for testing or logout)
 */
export function resetAutoRefreshTrigger(): void {
  hasTriggeredAutoRefresh = false;
}

/**
 * Individual sync operation status
 */
export interface SyncOperation {
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Progress percentage (0-100), null if indeterminate */
  progress: number | null;
  /** Status message to display */
  message: string;
  /** Error message if sync failed */
  error: string | null;
}

/**
 * Combined sync status for all operations
 */
export interface SyncStatus {
  emails: SyncOperation;
  messages: SyncOperation;
  contacts: SyncOperation;
}

/**
 * Auto-sync preferences from user settings
 */
interface AutoSyncPreferences {
  autoSyncOnLogin?: boolean;
}

interface UseAutoRefreshOptions {
  /** User ID to sync for */
  userId: string | null;
  /** Whether user has email connected */
  hasEmailConnected: boolean;
  /** Whether database is initialized */
  isDatabaseInitialized: boolean;
  /** Whether user has permissions (FDA on macOS) */
  hasPermissions: boolean;
  /** Whether we're on the dashboard (triggers sync) */
  isOnDashboard: boolean;
  /** Whether this is during onboarding (skip sync if true) */
  isOnboarding?: boolean;
}

interface UseAutoRefreshReturn {
  /** Sync status for all operations */
  syncStatus: SyncStatus;
  /** Whether any sync is in progress */
  isAnySyncing: boolean;
  /** Current sync message to display */
  currentSyncMessage: string | null;
  /** Manually trigger a full refresh */
  triggerRefresh: () => Promise<void>;
}

const initialSyncOperation: SyncOperation = {
  isSyncing: false,
  progress: null,
  message: "",
  error: null,
};

const initialSyncStatus: SyncStatus = {
  emails: { ...initialSyncOperation },
  messages: { ...initialSyncOperation },
  contacts: { ...initialSyncOperation },
};

// Auto-refresh delay in milliseconds (2.5 seconds as per task requirements)
const AUTO_REFRESH_DELAY_MS = 2500;

/**
 * Hook for automatically refreshing data sources on app load.
 *
 * Triggers background sync when:
 * - User reaches the dashboard
 * - Auto-sync preference is enabled (default: true)
 * - User is authenticated and database is initialized
 * - Not in onboarding flow
 *
 * Sync runs in parallel:
 * - Emails (if email connected) - includes AI transaction detection
 * - Messages (macOS only, if permissions granted)
 * - Contacts (macOS only, if permissions granted)
 */
export function useAutoRefresh({
  userId,
  hasEmailConnected,
  isDatabaseInitialized,
  hasPermissions,
  isOnDashboard,
  isOnboarding = false,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const { isMacOS } = usePlatform();
  const [status, setStatus] = useState<SyncStatus>(initialSyncStatus);
  // Note: using module-level hasTriggeredAutoRefresh instead of ref to prevent
  // React strict mode from triggering twice (each instance would have its own ref)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  // Subscribe to message import progress
  useEffect(() => {
    const cleanup = window.api.messages.onImportProgress((progress) => {
      if (progress.percent >= 100) {
        setStatus((prev) => ({
          ...prev,
          messages: {
            isSyncing: true,
            progress: 100,
            message: `Importing messages... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
        // Brief delay then mark complete
        setTimeout(() => {
          setStatus((prev) => ({
            ...prev,
            messages: {
              isSyncing: false,
              progress: 100,
              message: "Messages imported",
              error: null,
            },
          }));
        }, 500);
      } else {
        setStatus((prev) => ({
          ...prev,
          messages: {
            isSyncing: true,
            progress: progress.percent,
            message: `Importing messages... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
      }
    });

    return cleanup;
  }, []);

  // Subscribe to contacts import progress
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactsApi = window.api.contacts as any;
    if (!contactsApi?.onImportProgress) return;

    const cleanup = contactsApi.onImportProgress(
      (progress: { current: number; total: number; percent: number }) => {
        if (progress.percent >= 100) {
          setStatus((prev) => ({
            ...prev,
            contacts: {
              isSyncing: true,
              progress: 100,
              message: `Importing contacts... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
              error: null,
            },
          }));
          setTimeout(() => {
            setStatus((prev) => ({
              ...prev,
              contacts: {
                isSyncing: false,
                progress: 100,
                message: "Contacts imported",
                error: null,
              },
            }));
          }, 500);
        } else {
          setStatus((prev) => ({
            ...prev,
            contacts: {
              isSyncing: true,
              progress: progress.percent,
              message: `Importing contacts... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
              error: null,
            },
          }));
        }
      }
    );

    return cleanup;
  }, []);

  // Load auto-sync preference
  useEffect(() => {
    if (!userId || !isDatabaseInitialized) return;

    const loadPreference = async () => {
      try {
        const result = await window.api.preferences.get(userId);
        if (result.success && result.preferences) {
          const prefs = result.preferences as AutoSyncPreferences;
          // Default to true if not set
          const enabled = prefs.autoSyncOnLogin !== false;
          setAutoSyncEnabled(enabled);
        }
      } catch {
        // Default to enabled on error
        setAutoSyncEnabled(true);
      } finally {
        setHasLoadedPreference(true);
      }
    };

    loadPreference();
  }, [userId, isDatabaseInitialized]);

  /**
   * Start email sync (scan for real estate emails + AI transaction detection)
   */
  const syncEmails = useCallback(async (uid: string): Promise<void> => {
    setStatus((prev) => ({
      ...prev,
      emails: {
        isSyncing: true,
        progress: null, // Indeterminate
        message: "Syncing emails...",
        error: null,
      },
    }));

    try {
      const result = await window.api.transactions.scan(uid);

      setStatus((prev) => ({
        ...prev,
        emails: {
          isSyncing: false,
          progress: 100,
          message: result.success ? "Email sync complete" : "Email sync failed",
          error: result.error || null,
        },
      }));
    } catch (error) {
      console.error("[useAutoRefresh] Email sync error:", error);
      setStatus((prev) => ({
        ...prev,
        emails: {
          isSyncing: false,
          progress: null,
          message: "Email sync failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, []);

  /**
   * Start messages sync (macOS Messages app)
   */
  const syncMessages = useCallback(async (uid: string): Promise<void> => {
    setStatus((prev) => ({
      ...prev,
      messages: {
        isSyncing: true,
        progress: null, // Will be updated via IPC listener
        message: "Importing messages...",
        error: null,
      },
    }));

    try {
      const result = await window.api.messages.importMacOSMessages(uid);

      setStatus((prev) => ({
        ...prev,
        messages: {
          isSyncing: false,
          progress: 100,
          message: result.success
            ? result.messagesImported > 0
              ? `Imported ${result.messagesImported.toLocaleString()} messages`
              : "Messages up to date"
            : "Message import failed",
          error: result.error || null,
        },
      }));
    } catch (error) {
      console.error("[useAutoRefresh] Message sync error:", error);
      setStatus((prev) => ({
        ...prev,
        messages: {
          isSyncing: false,
          progress: null,
          message: "Message import failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, []);

  /**
   * Start contacts sync
   * On macOS, contacts are loaded from the system Contacts database
   */
  const syncContacts = useCallback(async (uid: string): Promise<void> => {
    setStatus((prev) => ({
      ...prev,
      contacts: {
        isSyncing: true,
        progress: null,
        message: "Syncing contacts...",
        error: null,
      },
    }));

    try {
      // Contacts are synced automatically with email scan
      // This ensures contacts are up to date
      await window.api.contacts.getAll(uid);

      setStatus((prev) => ({
        ...prev,
        contacts: {
          isSyncing: false,
          progress: 100,
          message: "Contacts synced",
          error: null,
        },
      }));
    } catch (error) {
      console.error("[useAutoRefresh] Contact sync error:", error);
      setStatus((prev) => ({
        ...prev,
        contacts: {
          isSyncing: false,
          progress: null,
          message: "Contact sync failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, []);

  /**
   * Run all applicable syncs in parallel using Promise.allSettled
   * This is the main auto-refresh function triggered on dashboard entry.
   *
   * Uses incremental sync:
   * - Email scan only fetches new emails since last sync
   * - Message import only imports new messages
   *
   * Includes AI transaction detection:
   * - transactions.scan automatically runs AI detection after fetching emails
   */
  const runAutoRefresh = useCallback(
    async (uid: string, emailConnected: boolean): Promise<void> => {
      console.log("[useAutoRefresh] Starting auto-refresh for user:", uid);

      // Build sync tasks based on platform and connections
      const syncTasks: Array<{ name: string; task: Promise<void> }> = [];

      // Email sync (all platforms, if email connected)
      // This includes AI transaction detection
      if (emailConnected) {
        syncTasks.push({
          name: "emails",
          task: syncEmails(uid),
        });
      }

      // Messages sync (macOS only)
      // Skip if we just imported during onboarding
      if (isMacOS && hasPermissions && !skipNextMessagesSync) {
        console.log("[useAutoRefresh] Adding messages sync to parallel tasks");
        syncTasks.push({
          name: "messages",
          task: syncMessages(uid),
        });
      } else if (skipNextMessagesSync) {
        // Clear the flag so future syncs work normally
        console.log(
          "[useAutoRefresh] Skipping messages sync - just did onboarding import"
        );
        skipNextMessagesSync = false;
      }

      // Contacts sync (macOS only, requires permissions)
      // Run in parallel but only if we have FDA
      if (isMacOS && hasPermissions && emailConnected) {
        syncTasks.push({
          name: "contacts",
          task: syncContacts(uid),
        });
      }

      if (syncTasks.length === 0) {
        console.log("[useAutoRefresh] No sync tasks to run");
        return;
      }

      console.log(
        `[useAutoRefresh] Running ${syncTasks.length} sync tasks in parallel:`,
        syncTasks.map((t) => t.name)
      );

      // Run all syncs in parallel with Promise.allSettled
      // This ensures one failure doesn't block others
      const results = await Promise.allSettled(
        syncTasks.map((t) => t.task)
      );

      // Log results for debugging (errors already logged in individual sync functions)
      results.forEach((result, index) => {
        const taskName = syncTasks[index].name;
        if (result.status === "rejected") {
          console.error(
            `[useAutoRefresh] ${taskName} sync rejected:`,
            result.reason
          );
        } else {
          console.log(`[useAutoRefresh] ${taskName} sync completed`);
        }
      });

      console.log("[useAutoRefresh] Auto-refresh complete");
    },
    [isMacOS, hasPermissions, syncEmails, syncMessages, syncContacts]
  );

  /**
   * Trigger a manual refresh
   */
  const triggerRefresh = useCallback(async () => {
    if (!userId) return;
    await runAutoRefresh(userId, hasEmailConnected);
  }, [userId, hasEmailConnected, runAutoRefresh]);

  // Auto-trigger refresh once per app session when first entering dashboard
  useEffect(() => {
    // Skip if not on dashboard (but don't reset flag - we only want to trigger once per session)
    if (!isOnDashboard) return;
    if (!userId) return;
    if (!isDatabaseInitialized) return;
    if (isOnboarding) return;
    if (!hasLoadedPreference) return;
    if (!autoSyncEnabled) return;
    // Use module-level flag to prevent React strict mode from triggering twice
    if (hasTriggeredAutoRefresh) return;

    // Mark as triggered to prevent duplicate runs
    hasTriggeredAutoRefresh = true;

    // Run refresh after delay to let UI settle (2.5 seconds as per task)
    const timeoutId = setTimeout(() => {
      console.log("[useAutoRefresh] Auto-triggering refresh after delay");
      runAutoRefresh(userId, hasEmailConnected);
    }, AUTO_REFRESH_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    isOnDashboard,
    userId,
    isDatabaseInitialized,
    isOnboarding,
    hasLoadedPreference,
    autoSyncEnabled,
    hasEmailConnected,
    isMacOS,
    hasPermissions,
    runAutoRefresh,
  ]);

  /**
   * Check if any sync is in progress
   */
  const isAnySyncing =
    status.emails.isSyncing ||
    status.messages.isSyncing ||
    status.contacts.isSyncing;

  /**
   * Get current status message to display
   * Prioritizes syncs with actual progress (percentage) over indeterminate syncs
   */
  const currentSyncMessage = (() => {
    // First priority: syncs with actual progress updates (more informative)
    if (status.messages.isSyncing && status.messages.progress !== null) {
      return status.messages.message;
    }
    if (status.contacts.isSyncing && status.contacts.progress !== null) {
      return status.contacts.message;
    }
    if (status.emails.isSyncing && status.emails.progress !== null) {
      return status.emails.message;
    }
    // Second priority: any active sync (indeterminate progress)
    if (status.messages.isSyncing) {
      return status.messages.message;
    }
    if (status.emails.isSyncing) {
      return status.emails.message;
    }
    if (status.contacts.isSyncing) {
      return status.contacts.message;
    }
    return null;
  })();

  return {
    syncStatus: status,
    isAnySyncing,
    currentSyncMessage,
    triggerRefresh,
  };
}

export default useAutoRefresh;
