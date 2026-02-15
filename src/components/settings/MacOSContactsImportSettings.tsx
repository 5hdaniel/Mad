/**
 * ContactsImportSettings Component
 *
 * Settings section for importing contacts from multiple sources.
 * Shows macOS Contacts import on macOS and Outlook Contacts when
 * a Microsoft account is connected.
 *
 * Features:
 * - macOS Contacts: sync status, import, force re-import (macOS only)
 * - Outlook Contacts: import button, reconnect-required handling
 *
 * @module settings/ContactsImportSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import { useSyncOrchestrator } from "../../hooks/useSyncOrchestrator";

interface ContactsImportSettingsProps {
  userId: string;
  /** Whether a Microsoft account is connected */
  isMicrosoftConnected?: boolean;
}

/**
 * Multi-source contacts import settings.
 * Shows import controls for macOS Contacts (macOS only) and
 * Outlook Contacts (when Microsoft account is connected).
 */
export function ContactsImportSettings({
  userId,
  isMicrosoftConnected = false,
}: ContactsImportSettingsProps) {
  const { isMacOS } = usePlatform();
  const { queue, isRunning, requestSync } = useSyncOrchestrator();

  // Derive syncing state from orchestrator queue
  const contactsItem = queue.find(q => q.type === 'contacts');
  const isSyncing = contactsItem?.status === 'running' || contactsItem?.status === 'pending';

  // Check if another sync (not contacts) is running
  const isOtherSyncRunning = isRunning && !isSyncing;

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

  // Source stats (TASK-1991)
  const [sourceStats, setSourceStats] = useState<Record<string, number> | null>(null);

  // Outlook-specific state
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [outlookReconnectRequired, setOutlookReconnectRequired] = useState(false);
  const [outlookLastResult, setOutlookLastResult] = useState<{
    success: boolean;
    count?: number;
    error?: string;
  } | null>(null);

  // Load sync status and source stats on mount
  useEffect(() => {
    if (!userId) return;
    loadSourceStats();
    if (!isMacOS) return;
    loadSyncStatus();
  }, [isMacOS, userId]);

  // Update lastResult when contacts sync completes or errors
  useEffect(() => {
    if (contactsItem?.status === 'complete') {
      setLastResult({ success: true });
      loadSyncStatus();
      loadSourceStats();
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

  const loadSourceStats = async () => {
    try {
      const result = await window.api.contacts.getSourceStats(userId);
      if (result.success && result.stats) {
        setSourceStats(result.stats);
      }
    } catch {
      // Non-critical — stats will show as loading
    }
  };

  const handleSync = useCallback(
    async (_forceReimport = false) => {
      if (!userId || isSyncing || isOtherSyncRunning) return;

      setLastResult(null);

      // Request sync - orchestrator will handle it
      requestSync(['contacts'], userId);
    },
    [userId, isSyncing, isOtherSyncRunning, requestSync]
  );

  const handleOutlookSync = useCallback(async () => {
    if (!userId || outlookSyncing || isSyncing || isOtherSyncRunning) return;

    setOutlookSyncing(true);
    setOutlookLastResult(null);
    setOutlookReconnectRequired(false);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactsApi = window.api.contacts as any;
      const result = await contactsApi.syncOutlookContacts(userId);

      if (result.success) {
        setOutlookLastResult({ success: true, count: result.count });
        loadSourceStats();
      } else if (result.reconnectRequired) {
        setOutlookReconnectRequired(true);
        setOutlookLastResult(null);
      } else {
        setOutlookLastResult({ success: false, error: result.error });
      }
    } catch (error) {
      setOutlookLastResult({
        success: false,
        error: error instanceof Error ? error.message : "Outlook contacts sync failed",
      });
    } finally {
      setOutlookSyncing(false);
    }
  }, [userId, outlookSyncing, isSyncing, isOtherSyncRunning]);

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

  const hasMacOS = isMacOS;
  const hasOutlook = isMicrosoftConnected;
  const hasAnySources = hasMacOS || hasOutlook;

  // Render nothing if no sources are available
  if (!hasAnySources) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-5 h-5 text-gray-400"
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
          <h4 className="text-sm font-medium text-gray-900">Import Contacts</h4>
        </div>
        <p className="text-xs text-gray-500">
          Connect a Microsoft account or use macOS to import contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* macOS Contacts Section */}
      {hasMacOS && (
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

          {/* Result display - hide when another sync is running */}
          {lastResult && !isSyncing && !isOtherSyncRunning && (
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

          {/* Show message if another sync is running */}
          {isOtherSyncRunning && (
            <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
              Another sync is in progress. Contacts will sync when it completes.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={isSyncing || isOtherSyncRunning}
              className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? "Syncing..." : isOtherSyncRunning ? "Sync in Progress..." : "Import Contacts"}
            </button>
            <button
              onClick={() => handleSync(true)}
              disabled={isSyncing || isOtherSyncRunning}
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
      )}

      {/* Source Stats Breakdown (TASK-1991) */}
      {sourceStats && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Contact Sources</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            {isMacOS && (
              <div className="p-2 bg-violet-50 rounded border border-violet-200">
                <div className="text-lg font-semibold text-violet-700">{sourceStats.macos.toLocaleString()}</div>
                <div className="text-xs text-violet-600">macOS</div>
              </div>
            )}
            {(sourceStats.iphone > 0) && (
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <div className="text-lg font-semibold text-blue-700">{sourceStats.iphone.toLocaleString()}</div>
                <div className="text-xs text-blue-600">iPhone</div>
              </div>
            )}
            {isMicrosoftConnected && (
              <div className="p-2 bg-indigo-50 rounded border border-indigo-200">
                <div className="text-lg font-semibold text-indigo-700">{sourceStats.outlook.toLocaleString()}</div>
                <div className="text-xs text-indigo-600">Outlook</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outlook Contacts Section */}
      {hasOutlook && (
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <h4 className="text-sm font-medium text-gray-900">Outlook Contacts</h4>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Import contacts from your connected Microsoft account.
          </p>

          {/* Reconnect required warning */}
          {outlookReconnectRequired && (
            <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
              Please disconnect and reconnect your Microsoft mailbox to grant contact access.
            </div>
          )}

          {/* Outlook sync result */}
          {outlookLastResult && !outlookSyncing && (
            <div
              className={`mb-3 p-2 rounded text-xs ${
                outlookLastResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {outlookLastResult.success ? (
                <>
                  Outlook contacts synced.{" "}
                  {outlookLastResult.count !== undefined && (
                    <strong>{outlookLastResult.count.toLocaleString()}</strong>
                  )}{" "}
                  contacts imported.
                </>
              ) : (
                <>Sync failed: {outlookLastResult.error}</>
              )}
            </div>
          )}

          {/* Show message if another sync is running */}
          {isOtherSyncRunning && !outlookSyncing && (
            <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
              Another sync is in progress. Please wait before importing Outlook contacts.
            </div>
          )}

          {!outlookReconnectRequired && (
            <button
              onClick={handleOutlookSync}
              disabled={outlookSyncing || isSyncing || isOtherSyncRunning}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {outlookSyncing ? "Syncing..." : "Import Outlook Contacts"}
            </button>
          )}

          {/* Loading indicator during Outlook sync */}
          {outlookSyncing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Syncing contacts from Outlook...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Backward-compatible named export
export { ContactsImportSettings as MacOSContactsImportSettings };

export default ContactsImportSettings;
