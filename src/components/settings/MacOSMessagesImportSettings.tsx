/**
 * MacOSMessagesImportSettings Component (TASK-1710, TASK-1752)
 *
 * Settings section for importing messages from macOS Messages app.
 * Only visible on macOS platform.
 *
 * Features:
 * - Shows inline progress bar during import (no modal)
 * - Supports cancellation
 * - Displays results after import completes
 *
 * @module settings/MacOSMessagesImportSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";

/** Import progress state for inline display */
interface ImportProgressState {
  phase: "deleting" | "attachments" | "importing";
  current: number;
  total: number;
  percent: number;
}

interface MacOSMessagesImportSettingsProps {
  userId: string;
}

/**
 * Messages import settings for macOS users.
 * Allows manual import of messages from the macOS Messages app.
 */
export function MacOSMessagesImportSettings({
  userId,
}: MacOSMessagesImportSettingsProps) {
  const { isMacOS } = usePlatform();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<ImportProgressState | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    messagesImported: number;
    error?: string;
    cancelled?: boolean;
  } | null>(null);
  const [importStatus, setImportStatus] = useState<{
    messageCount?: number;
    lastImportAt?: string | null;
  } | null>(null);

  // Load import status on mount
  useEffect(() => {
    if (!isMacOS || !userId) return;
    loadImportStatus();
  }, [isMacOS, userId]);

  const loadImportStatus = async () => {
    try {
      const result = await window.api.messages.getImportStatus(userId);
      if (result.success) {
        setImportStatus({
          messageCount: result.messageCount,
          lastImportAt: result.lastImportAt,
        });
      }
    } catch (error) {
      console.error("Failed to load import status:", error);
    }
  };

  // Format the last import time for display
  const formatLastImport = (lastImportAt: string | null | undefined): string => {
    if (!lastImportAt) return "Never imported";

    const importDate = new Date(lastImportAt);
    const now = new Date();
    const diffMs = now.getTime() - importDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  // Subscribe to import progress updates
  useEffect(() => {
    if (!isMacOS) return;

    const cleanup = window.api.messages.onImportProgress((progress) => {
      // Cast to ensure all required fields are present (TASK-1710)
      setImportProgress(progress as ImportProgressState);
    });

    return cleanup;
  }, [isMacOS]);

  const handleImport = useCallback(
    async (forceReimport = false) => {
      if (!userId || isImporting) return;

      setIsImporting(true);
      setImportProgress(null);
      setLastResult(null);

      try {
        // Type assertion: window.d.ts has the correct signature but TS doesn't pick it up
        // See BACKLOG-199 for investigation
        const importFn = window.api.messages.importMacOSMessages as (
          userId: string,
          forceReimport?: boolean
        ) => Promise<{
          success: boolean;
          messagesImported: number;
          error?: string;
        }>;
        const result = await importFn(userId, forceReimport);

        // Check if cancelled
        const wasCancelled = result.error === "Import cancelled";

        setLastResult({
          success: result.success,
          messagesImported: result.messagesImported,
          error: wasCancelled ? undefined : result.error,
          cancelled: wasCancelled,
        });

        // Reload status after successful import
        if (result.success) {
          await loadImportStatus();
        }
      } catch (error) {
        setLastResult({
          success: false,
          messagesImported: 0,
          error: error instanceof Error ? error.message : "Import failed",
        });
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
    },
    [userId, isImporting]
  );

  const handleCancel = useCallback(() => {
    // Type assertion for cancelImport method (TASK-1710)
    const cancelFn = (window.api.messages as { cancelImport?: () => void })
      .cancelImport;
    if (cancelFn) {
      cancelFn();
    }
  }, []);

  // Only render on macOS
  if (!isMacOS) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h4 className="text-sm font-medium text-gray-900">macOS Messages</h4>
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Import messages from the macOS Messages app to enable linking with your
        transactions.
      </p>

      {/* Import status display */}
      {importStatus && (
        <div className="mb-3 text-xs text-gray-500">
          Last imported: {formatLastImport(importStatus.lastImportAt)}
          {importStatus.messageCount !== undefined && (
            <> | {importStatus.messageCount.toLocaleString()} messages</>
          )}
        </div>
      )}

      {/* Result display */}
      {lastResult && !isImporting && (
        <div
          className={`mb-3 p-2 rounded text-xs ${
            lastResult.cancelled
              ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
              : lastResult.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {lastResult.cancelled ? (
            <>
              Import cancelled.{" "}
              {lastResult.messagesImported > 0 && (
                <>
                  <strong>
                    {lastResult.messagesImported.toLocaleString()}
                  </strong>{" "}
                  messages were imported before cancellation.
                </>
              )}
            </>
          ) : lastResult.success ? (
            <>
              Successfully imported{" "}
              <strong>{lastResult.messagesImported.toLocaleString()}</strong>{" "}
              new messages.
            </>
          ) : (
            <>Import failed: {lastResult.error}</>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleImport(false)}
          disabled={isImporting}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? "Importing..." : "Import Messages"}
        </button>
        <button
          onClick={() => handleImport(true)}
          disabled={isImporting}
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete all existing messages and re-import from scratch"
        >
          Force Re-import
        </button>
      </div>

      {/* Inline progress bar during import (TASK-1752) */}
      {isImporting && (
        <div className="mt-3">
          {importProgress ? (
            <>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>
                  {importProgress.phase === "deleting"
                    ? "Clearing existing messages..."
                    : importProgress.phase === "attachments"
                      ? "Processing attachments..."
                      : "Importing messages..."}
                </span>
                <span>{importProgress.percent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    importProgress.phase === "deleting"
                      ? "bg-orange-500"
                      : importProgress.phase === "attachments"
                        ? "bg-green-500"
                        : "bg-blue-500"
                  }`}
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {importProgress.current.toLocaleString()} /{" "}
                {importProgress.total.toLocaleString()}
                {importProgress.phase === "deleting"
                  ? " cleared"
                  : importProgress.phase === "attachments"
                    ? " attachments"
                    : " messages"}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Preparing import...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MacOSMessagesImportSettings;
