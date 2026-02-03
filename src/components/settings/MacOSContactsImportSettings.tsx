/**
 * MacOSContactsImportSettings Component
 *
 * Settings section for syncing contacts from macOS Contacts app.
 * Only visible on macOS platform.
 *
 * Features:
 * - Shows sync status (last sync time, contact count)
 * - Import Contacts button for normal sync
 * - Force Re-import button for full resync
 *
 * @module settings/MacOSContactsImportSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import { useSyncOrchestrator } from "../../hooks/useSyncOrchestrator";

interface MacOSContactsImportSettingsProps {
  userId: string;
}

/**
 * Contacts sync settings for macOS users.
 * Allows manual sync of contacts from the macOS Contacts app.
 */
export function MacOSContactsImportSettings({
  userId,
}: MacOSContactsImportSettingsProps) {
  const { isMacOS } = usePlatform();
  const { queue, isRunning, forceSync } = useSyncOrchestrator();

  // Derive syncing state from orchestrator queue
  const contactsItem = queue.find(q => q.type === 'contacts');
  const isSyncing = contactsItem?.status === 'running' || contactsItem?.status === 'pending';

  // Show if any sync is running (to indicate orchestrator is busy)
  const isOrchestratorBusy = isRunning;

  const [lastResult, setLastResult] = useState<{
    success: boolean;
    inserted?: number;
    deleted?: number;
    total?: number;
    error?: string;
  } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncAt?: string | null;
    contactCount?: number;
  } | null>(null);

  // Load sync status on mount
  useEffect(() => {
    if (!isMacOS || !userId) return;
    loadSyncStatus();
  }, [isMacOS, userId]);

  // Update lastResult when contacts sync completes or errors
  useEffect(() => {
    if (contactsItem?.status === 'complete') {
      setLastResult({ success: true });
      loadSyncStatus();
    } else if (contactsItem?.status === 'error') {
      setLastResult({ success: false, error: contactsItem.error });
    }
  }, [contactsItem?.status, contactsItem?.error]);

  const loadSyncStatus = async () => {
    try {
      const result = await window.api.contacts.getExternalSyncStatus(userId);
      if (result.success) {
        setSyncStatus({
          lastSyncAt: result.lastSyncAt,
          contactCount: result.contactCount,
        });
      }
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  };

  const handleSync = useCallback(
    async (_forceReimport = false) => {
      if (!userId || isSyncing) return;

      setLastResult(null);

      // Use forceSync to start contacts sync immediately
      // This will cancel any running sync (user explicitly clicked button)
      forceSync(['contacts'], userId);
    },
    [userId, isSyncing, forceSync]
  );

  // Format the last sync time for display
  const formatLastSync = (lastSyncAt: string | null | undefined): string => {
    if (!lastSyncAt) return "Never synced";

    const syncDate = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  // Only render on macOS
  if (!isMacOS) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-violet-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h4 className="text-sm font-medium text-gray-900">macOS Contacts</h4>
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Import contacts from the macOS Contacts app to quickly assign them to
        transactions.
      </p>

      {/* Sync status display */}
      {syncStatus && (
        <div className="mb-3 text-xs text-gray-500">
          Last synced: {formatLastSync(syncStatus.lastSyncAt)}
          {syncStatus.contactCount !== undefined && (
            <> | {syncStatus.contactCount.toLocaleString()} contacts</>
          )}
        </div>
      )}

      {/* Result display */}
      {lastResult && !isSyncing && (
        <div
          className={`mb-3 p-2 rounded text-xs ${
            lastResult.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {lastResult.success ? (
            <>
              Sync complete.{" "}
              {lastResult.inserted !== undefined && lastResult.inserted > 0 && (
                <>
                  <strong>{lastResult.inserted.toLocaleString()}</strong> new
                  contacts added.{" "}
                </>
              )}
              {lastResult.deleted !== undefined && lastResult.deleted > 0 && (
                <>
                  <strong>{lastResult.deleted.toLocaleString()}</strong>{" "}
                  removed.{" "}
                </>
              )}
              {lastResult.total !== undefined && (
                <>
                  <strong>{lastResult.total.toLocaleString()}</strong> total.
                </>
              )}
              {lastResult.inserted === 0 && lastResult.deleted === 0 && (
                <>No changes detected.</>
              )}
            </>
          ) : (
            <>Sync failed: {lastResult.error}</>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleSync(false)}
          disabled={isSyncing}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? "Syncing..." : "Import Contacts"}
        </button>
        <button
          onClick={() => handleSync(true)}
          disabled={isSyncing}
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete all cached contacts and re-import from scratch"
        >
          Force Re-import
        </button>
      </div>

      {/* Loading indicator during sync */}
      {isSyncing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Syncing contacts from macOS...
        </div>
      )}
    </div>
  );
}

export default MacOSContactsImportSettings;
