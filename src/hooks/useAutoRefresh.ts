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

import { useEffect, useCallback, useState, useRef } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { hasMessagesImportTriggered } from "./useMacOSMessagesImport";
import { syncQueue } from "../services/SyncQueueService";

// Module-level flag to track if auto-refresh has been triggered this session
// Using module-level prevents React strict mode from triggering twice
let hasTriggeredAutoRefresh = false;

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

  // Local sync state - updated by sync functions, not subscription-based
  // This avoids re-renders during onboarding when syncQueue state changes
  const [localSyncState, setLocalSyncState] = useState<{
    emails: { isSyncing: boolean; error: string | null };
    messages: { isSyncing: boolean; error: string | null };
    contacts: { isSyncing: boolean; error: string | null };
  }>({
    emails: { isSyncing: false, error: null },
    messages: { isSyncing: false, error: null },
    contacts: { isSyncing: false, error: null },
  });

  // Progress-only state - IPC listeners update progress
  const [progress, setProgress] = useState<{
    messages: number | null;
    contacts: number | null;
    emails: number | null;
  }>({ messages: null, contacts: null, emails: null });

  // Note: using module-level hasTriggeredAutoRefresh instead of ref to prevent
  // React strict mode from triggering twice (each instance would have its own ref)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  // Subscribe to message import progress (for progress display only)
  // Sync state is managed by SyncQueueService
  useEffect(() => {
    const cleanup = window.api.messages.onImportProgress((progressData) => {
      setProgress((prev) => ({ ...prev, messages: progressData.percent }));
    });

    return cleanup;
  }, []);

  // Subscribe to contacts import progress (for progress display only)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactsApi = window.api.contacts as any;
    if (!contactsApi?.onImportProgress) return;

    const cleanup = contactsApi.onImportProgress(
      (progressData: { current: number; total: number; percent: number }) => {
        setProgress((prev) => ({ ...prev, contacts: progressData.percent }));
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
   * State is tracked locally and via SyncQueueService
   */
  const syncEmails = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('emails');
    setLocalSyncState((prev) => ({ ...prev, emails: { isSyncing: true, error: null } }));
    setProgress((prev) => ({ ...prev, emails: null }));

    try {
      const result = await window.api.transactions.scan(uid);

      if (result.success) {
        setProgress((prev) => ({ ...prev, emails: 100 }));
        syncQueue.complete('emails');
        setLocalSyncState((prev) => ({ ...prev, emails: { isSyncing: false, error: null } }));
      } else {
        const errorMsg = result.error || 'Email sync failed';
        syncQueue.error('emails', errorMsg);
        setLocalSyncState((prev) => ({ ...prev, emails: { isSyncing: false, error: errorMsg } }));
      }
    } catch (error) {
      console.error("[useAutoRefresh] Email sync error:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      syncQueue.error('emails', errorMsg);
      setLocalSyncState((prev) => ({ ...prev, emails: { isSyncing: false, error: errorMsg } }));
    }
  }, []);

  /**
   * Start messages sync (macOS Messages app)
   * State is tracked locally and via SyncQueueService, progress via IPC listener
   */
  const syncMessages = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('messages');
    setLocalSyncState((prev) => ({ ...prev, messages: { isSyncing: true, error: null } }));
    setProgress((prev) => ({ ...prev, messages: null }));

    try {
      const result = await window.api.messages.importMacOSMessages(uid);

      if (result.success) {
        setProgress((prev) => ({ ...prev, messages: 100 }));
        syncQueue.complete('messages');
        setLocalSyncState((prev) => ({ ...prev, messages: { isSyncing: false, error: null } }));
      } else {
        const errorMsg = result.error || 'Message import failed';
        syncQueue.error('messages', errorMsg);
        setLocalSyncState((prev) => ({ ...prev, messages: { isSyncing: false, error: errorMsg } }));
      }
    } catch (error) {
      console.error("[useAutoRefresh] Message sync error:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      syncQueue.error('messages', errorMsg);
      setLocalSyncState((prev) => ({ ...prev, messages: { isSyncing: false, error: errorMsg } }));
    }
  }, []);

  /**
   * Start contacts sync
   * On macOS, contacts are loaded from the system Contacts database
   * State is tracked locally and via SyncQueueService
   */
  const syncContacts = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('contacts');
    setLocalSyncState((prev) => ({ ...prev, contacts: { isSyncing: true, error: null } }));
    setProgress((prev) => ({ ...prev, contacts: null }));

    try {
      // Load contacts from local database (macOS) or just get all contacts
      await window.api.contacts.getAll(uid);
      setProgress((prev) => ({ ...prev, contacts: 100 }));
      syncQueue.complete('contacts');
      setLocalSyncState((prev) => ({ ...prev, contacts: { isSyncing: false, error: null } }));
    } catch (error) {
      console.error("[useAutoRefresh] Contact sync error:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      syncQueue.error('contacts', errorMsg);
      setLocalSyncState((prev) => ({ ...prev, contacts: { isSyncing: false, error: errorMsg } }));
    }
  }, []);

  /**
   * Run ONLY messages sync on startup.
   * Contacts and emails are loaded on-demand by their respective UI components.
   *
   * Running multiple syncs caused INP issues because UI components also
   * trigger their own data loading concurrently.
   */
  const runAutoRefresh = useCallback(
    async (uid: string, _emailConnected: boolean): Promise<void> => {
      const alreadyTriggered = hasMessagesImportTriggered();

      // Skip if already imported this session (e.g., during onboarding via PermissionsStep)
      // Don't reset the SyncQueue if import is already in progress from onboarding
      if (alreadyTriggered) {
        return;
      }

      // Reset SyncQueue for new sync run (only if we're starting fresh)
      syncQueue.reset();

      // Messages sync only (macOS)
      if (isMacOS && hasPermissions) {
        // Queue messages sync
        syncQueue.queue('messages');
        try {
          await syncMessages(uid);
        } catch (error) {
          console.error("[useAutoRefresh] messages sync failed:", error);
        }
      }

      // Contacts - loaded on-demand by useContactList
      // Emails - disabled, users trigger manually
    },
    [isMacOS, hasPermissions, syncMessages]
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
   * isAnySyncing derived from local state (avoids subscription-based re-renders)
   */
  const isAnySyncing = localSyncState.emails.isSyncing ||
    localSyncState.messages.isSyncing ||
    localSyncState.contacts.isSyncing;

  /**
   * currentSyncMessage simplified - could derive from state if needed
   */
  const currentSyncMessage: string | null = null;

  // Track previous syncing state for notification trigger
  const wasSyncingRef = useRef(false);

  // Send OS notification when sync completes
  useEffect(() => {
    // Detect transition from syncing to not syncing
    if (wasSyncingRef.current && !isAnySyncing) {
      // Sync just completed - send notification
      window.api.notification?.send(
        "Sync Complete",
        "Magic Audit is ready to use. Your data has been synchronized."
      ).catch(() => {
        // Silently ignore notification failures
      });
    }
    wasSyncingRef.current = isAnySyncing;
  }, [isAnySyncing]);

  // Construct syncStatus for backward compatibility with Dashboard
  // isSyncing from local state, progress from IPC listeners
  const syncStatus: SyncStatus = {
    emails: {
      isSyncing: localSyncState.emails.isSyncing,
      progress: progress.emails,
      message: '',
      error: localSyncState.emails.error,
    },
    messages: {
      isSyncing: localSyncState.messages.isSyncing,
      progress: progress.messages,
      message: '',
      error: localSyncState.messages.error,
    },
    contacts: {
      isSyncing: localSyncState.contacts.isSyncing,
      progress: progress.contacts,
      message: '',
      error: localSyncState.contacts.error,
    },
  };

  return {
    syncStatus,
    isAnySyncing,
    currentSyncMessage,
    triggerRefresh,
  };
}

export default useAutoRefresh;
