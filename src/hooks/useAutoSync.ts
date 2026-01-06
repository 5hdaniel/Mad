/**
 * useAutoSync Hook
 *
 * Manages automatic sync on login/dashboard entry.
 * Respects user's auto-sync preference and handles sync sequencing.
 *
 * @module hooks/useAutoSync
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { useSyncStatus } from "./useSyncStatus";

interface AutoSyncPreferences {
  autoSyncOnLogin?: boolean;
}

interface UseAutoSyncOptions {
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

interface UseAutoSyncReturn {
  /** Sync status for all operations */
  syncStatus: ReturnType<typeof useSyncStatus>["status"];
  /** Whether any sync is in progress */
  isAnySyncing: boolean;
  /** Current sync message to display */
  currentSyncMessage: string | null;
  /** Manually trigger a full sync */
  triggerSync: () => Promise<void>;
}

/**
 * Hook for automatic sync on dashboard entry.
 *
 * Triggers background sync when:
 * - User reaches the dashboard
 * - Auto-sync preference is enabled (default: true)
 * - User is authenticated and database is initialized
 * - Not in onboarding flow
 *
 * Sync sequence:
 * 1. Emails (if email connected)
 * 2. Messages (macOS only, if permissions granted)
 * 3. Contacts
 */
export function useAutoSync({
  userId,
  hasEmailConnected,
  isDatabaseInitialized,
  hasPermissions,
  isOnDashboard,
  isOnboarding = false,
}: UseAutoSyncOptions): UseAutoSyncReturn {
  const { isMacOS } = usePlatform();
  const syncStatus = useSyncStatus();
  const hasTriggeredRef = useRef(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

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
   * Trigger a manual sync
   */
  const triggerSync = useCallback(async () => {
    if (!userId) return;
    await syncStatus.runAutoSync(userId, hasEmailConnected);
  }, [userId, hasEmailConnected, syncStatus]);

  // Auto-trigger sync when entering dashboard
  useEffect(() => {
    // Skip if conditions not met
    if (!isOnDashboard) {
      // Reset trigger flag when leaving dashboard
      hasTriggeredRef.current = false;
      return;
    }
    if (!userId) return;
    if (!isDatabaseInitialized) return;
    if (isOnboarding) return;
    if (!hasLoadedPreference) return;
    if (!autoSyncEnabled) return;
    if (hasTriggeredRef.current) return;

    // Mark as triggered to prevent duplicate runs
    hasTriggeredRef.current = true;

    // Run sync after a short delay to let UI settle
    const timeoutId = setTimeout(() => {
      syncStatus.runAutoSync(userId, hasEmailConnected);
    }, 1500);

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
    syncStatus,
  ]);

  return {
    syncStatus: syncStatus.status,
    isAnySyncing: syncStatus.isAnySyncing,
    currentSyncMessage: syncStatus.currentMessage,
    triggerSync,
  };
}

export default useAutoSync;
