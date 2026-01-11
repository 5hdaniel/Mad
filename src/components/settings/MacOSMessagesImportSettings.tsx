/**
 * MacOSMessagesImportSettings Component
 *
 * Settings section for importing messages from macOS Messages app.
 * Only visible on macOS platform.
 *
 * @module settings/MacOSMessagesImportSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";

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
  const [importProgress, setImportProgress] = useState<{
    phase: "deleting" | "importing" | "attachments";
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    messagesImported: number;
    error?: string;
  } | null>(null);

  // Subscribe to import progress updates
  useEffect(() => {
    if (!isMacOS) return;

    const cleanup = window.api.messages.onImportProgress((progress) => {
      setImportProgress(progress);
    });

    return cleanup;
  }, [isMacOS]);

  const handleImport = useCallback(async (forceReimport = false) => {
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
      ) => Promise<{ success: boolean; messagesImported: number; error?: string }>;
      const result = await importFn(userId, forceReimport);
      setLastResult({
        success: result.success,
        messagesImported: result.messagesImported,
        error: result.error,
      });
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
  }, [userId, isImporting]);

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
          <h4 className="text-sm font-medium text-gray-900">
            macOS Messages
          </h4>
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Import messages from the macOS Messages app to enable linking with your
        transactions.
      </p>

      {/* Progress display */}
      {isImporting && importProgress && (
        <div className="mb-3">
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
            {importProgress.total.toLocaleString()}{" "}
            {importProgress.phase === "deleting"
              ? "deleted"
              : importProgress.phase === "attachments"
              ? "attachments"
              : "messages"}
          </p>
        </div>
      )}
      {/* Show "preparing" state when importing but no progress yet */}
      {isImporting && !importProgress && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Preparing...</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-gray-400 h-2 rounded-full w-full animate-pulse" />
          </div>
        </div>
      )}

      {/* Result display */}
      {lastResult && !isImporting && (
        <div
          className={`mb-3 p-2 rounded text-xs ${
            lastResult.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {lastResult.success ? (
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
    </div>
  );
}

export default MacOSMessagesImportSettings;
