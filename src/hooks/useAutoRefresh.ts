/**
 * useAutoRefresh Hook
 *
 * TASK-1003: Auto-refresh data sources on app load.
 * TASK-1783: Migrated to use SyncOrchestratorService.
 *
 * Automatically syncs all available data sources when the user opens
 * the application, eliminating the need to manually click "Auto Detect".
 *
 * Behavior:
 * - Triggers after auth + database ready + on dashboard
 * - Adds 1.5 second delay to not slow startup
 * - Runs syncs sequentially via SyncOrchestrator (contacts -> emails -> messages)
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
import { hasMessagesImportTriggered, setMessagesImportTriggered } from "../utils/syncFlags";
import { useSyncOrchestrator } from "./useSyncOrchestrator";
import type { SyncType, SyncItem } from "../services/SyncOrchestratorService";

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
  sync?: {
    autoSyncOnLogin?: boolean;
  };
  notifications?: {
    enabled?: boolean;
  };
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
  /** Whether user has AI addon (gates email sync with AI transaction detection) */
  hasAIAddon?: boolean;
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

// Auto-refresh delay in milliseconds
// Delay before auto-triggering sync on dashboard load
const AUTO_REFRESH_DELAY_MS = 1500;

/**
 * Map a SyncItem from orchestrator queue to SyncOperation for public API
 */
function mapQueueItemToSyncOperation(item?: SyncItem): SyncOperation {
  if (!item) return { ...initialSyncOperation };
  return {
    isSyncing: item.status === 'running' || item.status === 'pending',
    progress: item.progress,
    message: '',
    error: item.error ?? null,
  };
}

/**
 * Hook for automatically refreshing data sources on app load.
 *
 * Triggers background sync when:
 * - User reaches the dashboard
 * - Auto-sync preference is enabled (default: true)
 * - User is authenticated and database is initialized
 * - Not in onboarding flow
 *
 * Sync runs sequentially via SyncOrchestrator:
 * - Contacts (macOS only, if permissions granted)
 * - Emails (if email connected and AI addon enabled) - includes AI transaction detection
 * - Messages (macOS only, if permissions granted)
 */
export function useAutoRefresh({
  userId,
  hasEmailConnected,
  isDatabaseInitialized,
  hasPermissions,
  isOnDashboard,
  isOnboarding = false,
  hasAIAddon = false,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const { isMacOS } = usePlatform();

  // Get orchestrator state and actions
  const { queue, isRunning, requestSync } = useSyncOrchestrator();

  // Note: using module-level hasTriggeredAutoRefresh instead of ref to prevent
  // React strict mode from triggering twice (each instance would have its own ref)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  // Load auto-sync and notification preferences
  useEffect(() => {
    if (!userId || !isDatabaseInitialized) return;

    const loadPreference = async () => {
      try {
        const result = await window.api.preferences.get(userId);
        if (result.success && result.preferences) {
          const prefs = result.preferences as AutoSyncPreferences;
          // Default to true if not set
          const enabled = prefs.sync?.autoSyncOnLogin !== false;
          setAutoSyncEnabled(enabled);
          // Load notification preference (default to true if not set)
          const notifEnabled = prefs.notifications?.enabled !== false;
          setNotificationsEnabled(notifEnabled);
        }
      } catch {
        // Default to enabled on error
        setAutoSyncEnabled(true);
        setNotificationsEnabled(true);
      } finally {
        setHasLoadedPreference(true);
      }
    };

    loadPreference();
  }, [userId, isDatabaseInitialized]);

  /**
   * Run sync via orchestrator.
   *
   * This runs when:
   * 1. User completes onboarding without PermissionsStep (FDA already granted)
   * 2. User returns to app after session restart
   *
   * If PermissionsStep ran, hasMessagesImportTriggered() returns true and we skip.
   */
  const runAutoRefresh = useCallback(
    (uid: string, emailConnected: boolean): void => {
      // Build list of sync types based on platform and permissions
      // Order: Contacts (fast) → Emails (if AI addon) → Messages (slow)
      const typesToSync: SyncType[] = [];

      // TASK-1953: Contacts sync includes both macOS Contacts and Outlook contacts.
      // Trigger contacts sync if macOS with permissions OR if email is connected
      // (Outlook contacts work on all platforms via Graph API).
      if ((isMacOS && hasPermissions) || emailConnected) {
        typesToSync.push('contacts');
      }
      // Only sync emails if AI addon enabled and email connected
      if (hasAIAddon && emailConnected) {
        typesToSync.push('emails');
      }
      if (isMacOS && hasPermissions) {
        typesToSync.push('messages');
      }

      // Request sync from orchestrator (runs sequentially)
      if (typesToSync.length > 0) {
        requestSync(typesToSync, uid);
      }
    },
    [isMacOS, hasPermissions, hasAIAddon, requestSync]
  );

  /**
   * Trigger a manual refresh
   */
  const triggerRefresh = useCallback(async () => {
    if (!userId) return;
    runAutoRefresh(userId, hasEmailConnected);
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

    // Run refresh after delay to let UI settle
    const timeoutId = setTimeout(() => {
      // Skip if already imported this session (e.g., during onboarding via PermissionsStep)
      if (hasMessagesImportTriggered()) {
        return;
      }
      setMessagesImportTriggered();
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

  // Track previous syncing state for notification trigger
  const wasSyncingRef = useRef(false);

  // Send OS notification when sync completes (gated on user preference)
  useEffect(() => {
    // Detect transition from syncing to not syncing
    if (wasSyncingRef.current && !isRunning && notificationsEnabled) {
      // Sync just completed - send notification
      window.api.notification?.send(
        "Sync Complete",
        "Magic Audit is ready to use. Your data has been synchronized."
      ).catch(() => {
        // Silently ignore notification failures
      });
    }
    wasSyncingRef.current = isRunning;
  }, [isRunning, notificationsEnabled]);

  // Derive syncStatus from orchestrator queue for backward compatibility
  const syncStatus: SyncStatus = {
    emails: mapQueueItemToSyncOperation(queue.find(q => q.type === 'emails')),
    messages: mapQueueItemToSyncOperation(queue.find(q => q.type === 'messages')),
    contacts: mapQueueItemToSyncOperation(queue.find(q => q.type === 'contacts')),
  };

  return {
    syncStatus,
    isAnySyncing: isRunning,
    currentSyncMessage: null,
    triggerRefresh,
  };
}

export default useAutoRefresh;
