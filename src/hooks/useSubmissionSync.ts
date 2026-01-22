/**
 * Submission Sync Hook (BACKLOG-395)
 *
 * React hook for syncing submission status changes from Supabase cloud.
 * Listens for status change events and provides manual sync trigger.
 */
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./useToast";

// ============================================
// TYPES
// ============================================

export interface StatusChangeEvent {
  transactionId: string;
  propertyAddress: string;
  oldStatus: string;
  newStatus: string;
  reviewNotes?: string;
  title: string;
  message: string;
}

export interface UseSubmissionSyncResult {
  /** Timestamp of last successful sync */
  lastSynced: Date | null;
  /** Whether a sync is in progress */
  syncing: boolean;
  /** Trigger a manual sync */
  syncNow: () => Promise<void>;
  /** Status change events (most recent first) */
  recentChanges: StatusChangeEvent[];
  /** Clear recent changes */
  clearRecentChanges: () => void;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Hook for managing submission status sync
 *
 * @param options - Configuration options
 * @param options.onStatusChange - Callback when status changes (for query invalidation)
 * @param options.showToasts - Whether to show toast notifications (default: true)
 */
export function useSubmissionSync(options?: {
  onStatusChange?: (event: StatusChangeEvent) => void;
  showToasts?: boolean;
}): UseSubmissionSyncResult {
  const { showToasts = true } = options || {};
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [recentChanges, setRecentChanges] = useState<StatusChangeEvent[]>([]);

  const { showToast, showSuccess, showWarning } = useToast();

  // Listen for status change events from main process
  useEffect(() => {
    // Use type assertion for new API methods (added in BACKLOG-395)
    const transactions = window.api.transactions as typeof window.api.transactions & {
      onSubmissionStatusChanged: (callback: (data: StatusChangeEvent) => void) => () => void;
    };

    const unsubscribe = transactions.onSubmissionStatusChanged((data: StatusChangeEvent) => {
      // Add to recent changes
      setRecentChanges((prev) => [data, ...prev].slice(0, 10)); // Keep last 10

      // Call external handler if provided
      if (options?.onStatusChange) {
        options.onStatusChange(data);
      }

      // Show toast notification if enabled
      if (showToasts) {
        const toastFn = getToastFunction(data.newStatus);
        toastFn(data.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [options?.onStatusChange, showToasts, showToast, showSuccess, showWarning]);

  /**
   * Get appropriate toast function based on status
   */
  function getToastFunction(status: string) {
    switch (status) {
      case "approved":
        return (message: string) => showSuccess(message);
      case "needs_changes":
      case "rejected":
        return (message: string) => showWarning(message);
      default:
        return (message: string) => showToast(message, "info");
    }
  }

  /**
   * Trigger a manual sync
   */
  const syncNow = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      // Use type assertion for new API methods (added in BACKLOG-395)
      const transactions = window.api.transactions as typeof window.api.transactions & {
        syncSubmissions: () => Promise<{
          success: boolean;
          updated?: number;
          failed?: number;
          error?: string;
        }>;
      };
      const result = await transactions.syncSubmissions();
      if (result.success) {
        setLastSynced(new Date());
        if (result.updated && result.updated > 0 && showToasts) {
          showToast(`${result.updated} submission${result.updated > 1 ? "s" : ""} updated`, "info");
        }
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  }, [syncing, showToasts, showToast]);

  /**
   * Clear recent changes
   */
  const clearRecentChanges = useCallback(() => {
    setRecentChanges([]);
  }, []);

  return {
    lastSynced,
    syncing,
    syncNow,
    recentChanges,
    clearRecentChanges,
  };
}

export default useSubmissionSync;
