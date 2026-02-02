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
import { useSyncQueue } from "./useSyncQueue";

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

  // Use SyncQueue as single source of truth for sync state
  const { state: queueState, isRunning } = useSyncQueue();

  // Progress-only state - IPC listeners update progress, SyncQueue handles state
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
   * State is tracked via SyncQueueService
   */
  const syncEmails = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('emails');
    setProgress((prev) => ({ ...prev, emails: null }));

    try {
      const result = await window.api.transactions.scan(uid);

      if (result.success) {
        setProgress((prev) => ({ ...prev, emails: 100 }));
        syncQueue.complete('emails');
      } else {
        syncQueue.error('emails', result.error || 'Email sync failed');
      }
    } catch (error) {
      console.error("[useAutoRefresh] Email sync error:", error);
      syncQueue.error('emails', error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  /**
   * Start messages sync (macOS Messages app)
   * State is tracked via SyncQueueService, progress via IPC listener
   */
  const syncMessages = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('messages');
    setProgress((prev) => ({ ...prev, messages: null }));

    try {
      const result = await window.api.messages.importMacOSMessages(uid);

      if (result.success) {
        setProgress((prev) => ({ ...prev, messages: 100 }));
        syncQueue.complete('messages');
      } else {
        syncQueue.error('messages', result.error || 'Message import failed');
      }
    } catch (error) {
      console.error("[useAutoRefresh] Message sync error:", error);
      syncQueue.error('messages', error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  /**
   * Start contacts sync
   * On macOS, contacts are loaded from the system Contacts database
   * State is tracked via SyncQueueService
   */
  const syncContacts = useCallback(async (uid: string): Promise<void> => {
    syncQueue.start('contacts');
    setProgress((prev) => ({ ...prev, contacts: null }));

    try {
      // Load contacts from local database (macOS) or just get all contacts
      await window.api.contacts.getAll(uid);
      setProgress((prev) => ({ ...prev, contacts: 100 }));
      syncQueue.complete('contacts');
    } catch (error) {
      console.error("[useAutoRefresh] Contact sync error:", error);
      syncQueue.error('contacts', error instanceof Error ? error.message : 'Unknown error');
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
      // Reset SyncQueue for new sync run
      syncQueue.reset();

      // Messages sync only (macOS)
      // Skip if already imported this session
      const messagesAlreadyImported = skipNextMessagesSync || hasMessagesImportTriggered();
      if (isMacOS && hasPermissions && !messagesAlreadyImported) {
        // Queue messages sync
        syncQueue.queue('messages');
        try {
          await syncMessages(uid);
        } catch (error) {
          console.error("[useAutoRefresh] messages sync failed:", error);
        }
      } else if (skipNextMessagesSync) {
        skipNextMessagesSync = false;
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
   * isAnySyncing derived from SyncQueue (single source of truth)
   */
  const isAnySyncing = isRunning;

  /**
   * currentSyncMessage simplified - could derive from SyncQueue state if needed
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
  // isSyncing is derived from SyncQueue, progress from IPC listeners
  const syncStatus: SyncStatus = {
    emails: {
      isSyncing: queueState.emails.state === 'running',
      progress: progress.emails,
      message: '',
      error: queueState.emails.error || null,
    },
    messages: {
      isSyncing: queueState.messages.state === 'running',
      progress: progress.messages,
      message: '',
      error: queueState.messages.error || null,
    },
    contacts: {
      isSyncing: queueState.contacts.state === 'running',
      progress: progress.contacts,
      message: '',
      error: queueState.contacts.error || null,
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
