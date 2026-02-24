/**
 * ContactsImportSettings Component
 *
 * Unified settings section for contact sources and importing.
 * Combines persisted source toggles (from Supabase) with
 * import controls (sync, force re-import).
 *
 * Features:
 * - Source stats grid (macOS, iPhone, Outlook counts)
 * - Toggle switches for direct import sources + auto-discover
 * - macOS Contacts: sync status, import, force re-import (macOS only)
 * - Outlook Contacts: import button, reconnect-required handling
 *
 * @module settings/ContactsImportSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import { useSyncOrchestrator } from "../../hooks/useSyncOrchestrator";
import { useNetwork } from "../../contexts/NetworkContext";
import logger from '../../utils/logger';

interface ContactsImportSettingsProps {
  userId: string;
  /** Whether a Microsoft account is connected */
  isMicrosoftConnected?: boolean;
  /** Whether a Google account is connected */
  isGoogleConnected?: boolean;
  // Persisted source preferences (from Settings.tsx / Supabase)
  outlookContactsEnabled: boolean;
  macosContactsEnabled: boolean;
  gmailContactsEnabled: boolean;
  outlookEmailsInferred: boolean;
  gmailEmailsInferred: boolean;
  messagesInferred: boolean;
  loadingPreferences: boolean;
  onToggleSource: (category: "direct" | "inferred", key: string, currentValue: boolean) => void;
}

/**
 * Unified contacts settings: source toggles + import controls.
 * Shows toggle switches for all contact sources (persisted via Supabase)
 * and import controls for macOS Contacts and Outlook Contacts.
 */
export function ContactsImportSettings({
  userId,
  isMicrosoftConnected = false,
  isGoogleConnected = false,
  outlookContactsEnabled,
  macosContactsEnabled,
  gmailContactsEnabled,
  outlookEmailsInferred,
  gmailEmailsInferred,
  messagesInferred,
  loadingPreferences,
  onToggleSource,
}: ContactsImportSettingsProps) {
  const { isMacOS } = usePlatform();
  const { queue, isRunning, requestSync } = useSyncOrchestrator();
  // TASK-2056: Network status for disabling Outlook sync when offline
  const { isOnline } = useNetwork();

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
      logger.error("Failed to load sync status:", error);
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
    if (!userId || outlookSyncing || isSyncing || isOtherSyncRunning || !isOnline) return;

    setOutlookSyncing(true);
    setOutlookLastResult(null);
    setOutlookReconnectRequired(false);

    try {
      const result = await window.api.contacts.syncOutlookContacts(userId);

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
  }, [userId, outlookSyncing, isSyncing, isOtherSyncRunning, isOnline]);

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

  // Render nothing useful if no sources are available
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
          <h4 className="text-sm font-medium text-gray-900">Contacts</h4>
        </div>
        <p className="text-xs text-gray-500">
          Connect a Microsoft account or use macOS to import contacts.
        </p>
      </div>
    );
  }

  const anySyncing = isSyncing || outlookSyncing;

  // Unified import: triggers only user-selected sources
  // Fire-and-forget by design — each sync has its own loading/error state
  const handleImportAll = useCallback(async () => {
    if (anySyncing || isOtherSyncRunning) return;
    // macOS: call syncExternal directly to populate external_contacts from macOS Contacts
    if (hasMacOS && macosContactsEnabled) {
      handleSync(false);
      window.api.contacts.syncExternal(userId).then(() => loadSourceStats());
    }
    if (hasOutlook && outlookContactsEnabled) handleOutlookSync();
  }, [anySyncing, isOtherSyncRunning, hasMacOS, hasOutlook, macosContactsEnabled, outlookContactsEnabled, handleSync, handleOutlookSync, userId]);

  // Force re-import: wipe ALL sources, then import from enabled sources
  const [forceReimporting, setForceReimporting] = useState(false);
  const handleForceReimport = useCallback(async () => {
    if (anySyncing || isOtherSyncRunning || forceReimporting) return;
    setForceReimporting(true);
    try {
      const wipeResult = await window.api.contacts.forceReimport(userId);
      if (!wipeResult.success) {
        setLastResult({ success: false, error: wipeResult.error || "Failed to clear contacts" });
        return;
      }
      // Now trigger normal import to re-fetch fresh data
      await handleImportAll();
    } catch (error) {
      setLastResult({
        success: false,
        error: error instanceof Error ? error.message : "Force re-import failed",
      });
    } finally {
      setForceReimporting(false);
    }
  }, [anySyncing, isOtherSyncRunning, forceReimporting, userId, handleImportAll]);

  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const noSourcesSelected = (!hasMacOS || !macosContactsEnabled) && (!hasOutlook || !outlookContactsEnabled);

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <svg
          className="w-5 h-5 text-blue-600"
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
        <h4 className="text-sm font-medium text-gray-900">Contacts</h4>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Manage contact sources and import contacts for transaction assignment.
      </p>

      {/* Import From (direct) toggle switches */}
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Import From
        </p>
        <div className="space-y-2">
          {/* Outlook Contacts toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Outlook Contacts</span>
              {!isMicrosoftConnected && (
                <span className="text-xs text-gray-400">(not connected)</span>
              )}
            </div>
            <button
              onClick={() => onToggleSource("direct", "outlookContacts", outlookContactsEnabled)}
              disabled={loadingPreferences || !isMicrosoftConnected}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                outlookContactsEnabled ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={outlookContactsEnabled}
              aria-label="Outlook Contacts import"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  outlookContactsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Gmail Contacts toggle - Coming soon */}
          <div className="flex items-center justify-between py-1 opacity-50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Gmail Contacts</span>
              <span className="text-xs text-gray-400">Coming soon</span>
            </div>
            <button
              disabled
              className="ml-4 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
              role="switch"
              aria-checked={gmailContactsEnabled}
              aria-label="Gmail Contacts import"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gmailContactsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* macOS/iPhone Contacts toggle */}
          {isMacOS && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">macOS / iPhone Contacts</span>
              </div>
              <button
                onClick={() => onToggleSource("direct", "macosContacts", macosContactsEnabled)}
                disabled={loadingPreferences}
                className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  macosContactsEnabled ? "bg-blue-500" : "bg-gray-300"
                }`}
                role="switch"
                aria-checked={macosContactsEnabled}
                aria-label="macOS iPhone Contacts import"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    macosContactsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto-discover from conversations (inferred) toggle switches */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Auto-discover from conversations
        </p>
        <div className="space-y-2">
          {/* Outlook emails toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Outlook emails</span>
              {!isMicrosoftConnected && (
                <span className="text-xs text-gray-400">(not connected)</span>
              )}
            </div>
            <button
              onClick={() => onToggleSource("inferred", "outlookEmails", outlookEmailsInferred)}
              disabled={loadingPreferences || !isMicrosoftConnected}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                outlookEmailsInferred ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={outlookEmailsInferred}
              aria-label="Outlook emails auto-discover"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  outlookEmailsInferred ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Gmail emails toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Gmail emails</span>
              {!isGoogleConnected && (
                <span className="text-xs text-gray-400">(not connected)</span>
              )}
            </div>
            <button
              onClick={() => onToggleSource("inferred", "gmailEmails", gmailEmailsInferred)}
              disabled={loadingPreferences || !isGoogleConnected}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                gmailEmailsInferred ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={gmailEmailsInferred}
              aria-label="Gmail emails auto-discover"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gmailEmailsInferred ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Messages/SMS toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Messages / SMS</span>
            </div>
            <button
              onClick={() => onToggleSource("inferred", "messages", messagesInferred)}
              disabled={loadingPreferences}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                messagesInferred ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={messagesInferred}
              aria-label="Messages SMS auto-discover"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  messagesInferred ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Divider before import controls */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Import
        </p>
      </div>

      {/* Sync status (macOS) */}
      {hasMacOS && macosContactsEnabled && syncStatus && (
        <div className="mb-3 text-xs text-gray-500">
          Last synced: {formatLastSync(syncStatus.lastSyncAt)}
          {syncStatus.contactCount !== undefined && (
            <> | {syncStatus.contactCount.toLocaleString()} contacts</>
          )}
        </div>
      )}

      {/* Source stats grid (read-only indicators) */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {isMacOS && (
          <div className={`p-2 rounded border ${
            macosContactsEnabled
              ? "bg-violet-50 border-violet-200"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}>
            <div className={`text-lg font-semibold ${macosContactsEnabled ? "text-violet-700" : "text-gray-400"}`}>
              {sourceStats?.macos?.toLocaleString() ?? "—"}
            </div>
            <div className={`text-xs ${macosContactsEnabled ? "text-violet-600" : "text-gray-400"}`}>macOS</div>
          </div>
        )}
        {sourceStats && sourceStats.iphone > 0 && (
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-lg font-semibold text-blue-700">{sourceStats.iphone.toLocaleString()}</div>
            <div className="text-xs text-blue-600">iPhone</div>
          </div>
        )}
        {isMicrosoftConnected && (
          <div className={`p-2 rounded border ${
            outlookContactsEnabled
              ? "bg-indigo-50 border-indigo-200"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}>
            <div className={`text-lg font-semibold ${outlookContactsEnabled ? "text-indigo-700" : "text-gray-400"}`}>
              {sourceStats?.outlook?.toLocaleString() ?? "—"}
            </div>
            <div className={`text-xs ${outlookContactsEnabled ? "text-indigo-600" : "text-gray-400"}`}>Outlook</div>
          </div>
        )}
      </div>

      {/* Offline warning for Outlook contacts */}
      {!isOnline && hasOutlook && outlookContactsEnabled && (
        <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
          You are offline. Outlook contacts sync is unavailable.
        </div>
      )}

      {/* Reconnect required warning (Outlook) */}
      {outlookReconnectRequired && (
        <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
          Please disconnect and reconnect your Microsoft mailbox to grant contact access.
        </div>
      )}

      {/* Show message if another sync is running */}
      {isOtherSyncRunning && !anySyncing && (
        <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
          Another sync is in progress. Contacts will sync when it completes.
        </div>
      )}

      {/* macOS sync result */}
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
              {hasMacOS && "macOS contacts synced. "}
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
            <>Outlook sync failed: {outlookLastResult.error}</>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleImportAll}
          disabled={anySyncing || isOtherSyncRunning || noSourcesSelected}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {anySyncing ? "Syncing..." : isOtherSyncRunning ? "Sync in Progress..." : noSourcesSelected ? "Select a Source" : "Import Contacts"}
        </button>
        <button
          onClick={handleForceReimport}
          disabled={anySyncing || isOtherSyncRunning || noSourcesSelected || forceReimporting}
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Wipe all cached contacts from every source and re-import from enabled sources"
        >
          {forceReimporting ? "Clearing..." : "Force Re-import"}
        </button>
        {/* Info icon */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent blur from firing on self-click
              setShowInfoTooltip(!showInfoTooltip);
            }}
            onBlur={() => setShowInfoTooltip(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Import info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showInfoTooltip && (
            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200 text-xs text-gray-600 z-10">
              <p className="font-medium text-gray-900 mb-1">Import Contacts</p>
              <p className="mb-2">Adds new contacts, updates existing ones, and removes contacts deleted from the source.</p>
              <p className="font-medium text-gray-900 mb-1">Force Re-import</p>
              <p>Wipes all cached contacts from every source and imports fresh from enabled sources. Use if contacts look out of sync.</p>
            </div>
          )}
        </div>
      </div>

      {/* Loading indicators */}
      {isSyncing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Syncing contacts from macOS...
        </div>
      )}
      {outlookSyncing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Syncing contacts from Outlook...
        </div>
      )}
    </div>
  );
}

// Backward-compatible named export
export { ContactsImportSettings as MacOSContactsImportSettings };

export default ContactsImportSettings;
