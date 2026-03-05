/**
 * SyncStatusBar Component
 *
 * Persistent, non-blocking status bar that shows iPhone sync progress.
 * Renders in AppShell between the offline banner and scrollable content.
 * Replaces the modal for progress display -- modal remains for setup only.
 *
 * States:
 * - Hidden when idle
 * - Compact bar during syncing (phase, progress, bytes, cancel)
 * - Completion message (auto-dismiss after 5s)
 * - Error message (manual dismiss)
 *
 * @module components/iphone/SyncStatusBar
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { BackupProgress, SyncStatus } from "../../types/iphone";

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

interface SyncStatusBarProps {
  syncStatus: SyncStatus;
  progress: BackupProgress | null;
  error: string | null;
  onCancel: () => void;
}

/**
 * Get display label for sync phase
 */
function getPhaseLabel(phase: BackupProgress["phase"]): string {
  switch (phase) {
    case "preparing":
      return "Preparing sync...";
    case "backing_up":
      return "Exporting iPhone data...";
    case "extracting":
      return "Reading messages...";
    case "storing":
      return "Saving to database...";
    case "complete":
      return "iPhone sync complete";
    case "error":
      return "iPhone sync failed";
    default:
      return "Processing...";
  }
}

export function SyncStatusBar({
  syncStatus,
  progress,
  error,
  onCancel,
}: SyncStatusBarProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [showError, setShowError] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<SyncStatus>(syncStatus);

  // Clear auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
    };
  }, []);

  // Track status transitions
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = syncStatus;

    // Transition to complete: show completion briefly
    if (syncStatus === "complete" && prev === "syncing") {
      setShowCompletion(true);
      setShowError(false);

      // Auto-dismiss after 5 seconds
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
      autoDismissRef.current = setTimeout(() => {
        setShowCompletion(false);
        autoDismissRef.current = null;
      }, 5000);
    }

    // Transition to error: show error (manual dismiss)
    if (syncStatus === "error" && prev === "syncing") {
      setShowError(true);
      setShowCompletion(false);
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    }

    // New sync started: reset states
    if (syncStatus === "syncing" && prev !== "syncing") {
      setShowCompletion(false);
      setShowError(false);
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    }
  }, [syncStatus]);

  // Dismiss handler for error/completion
  const handleDismiss = useCallback(() => {
    setShowCompletion(false);
    setShowError(false);
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }, []);

  // Determine visibility
  const isSyncing = syncStatus === "syncing";
  const isVisible = isSyncing || showCompletion || showError;

  if (!isVisible) {
    return null;
  }

  // Completion state
  if (showCompletion) {
    return (
      <div
        className="flex-shrink-0 bg-green-50 border-b border-green-200 px-4 py-3"
        data-testid="sync-status-bar-complete"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-800">
              {progress?.message || "iPhone sync complete"}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-green-400 hover:text-green-600 rounded transition-colors"
            title="Dismiss"
            aria-label="Dismiss notification"
            data-testid="sync-status-bar-dismiss"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (showError) {
    return (
      <div
        className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-3"
        data-testid="sync-status-bar-error"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-red-800">
              iPhone sync failed{error ? `: ${error}` : ""}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
            title="Dismiss"
            aria-label="Dismiss error"
            data-testid="sync-status-bar-dismiss"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Active syncing state
  const phase = progress?.phase ?? "preparing";
  const isIndeterminate = phase === "backing_up" || phase === "preparing";
  const percent = progress?.percent ?? 0;
  const hasBytes = (progress?.bytesProcessed ?? 0) > 0;
  const hasFiles = (progress?.processedFiles ?? 0) > 0;

  return (
    <div
      className="flex-shrink-0 bg-purple-50 border-b border-purple-200 px-4 py-2.5"
      data-testid="sync-status-bar"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Phase info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Spinning indicator */}
          <div className="w-5 h-5 flex-shrink-0">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>

          {/* Phase label and progress */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-purple-800 whitespace-nowrap">
                {getPhaseLabel(phase)}
              </span>

              {/* Progress bar */}
              <div className="flex-1 max-w-[200px] hidden sm:block">
                <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
                  {isIndeterminate ? (
                    <div
                      className="h-full w-1/3 bg-purple-500 rounded-full"
                      style={{
                        animation: "indeterminate 1.5s ease-in-out infinite",
                      }}
                    />
                  ) : (
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Percentage for determinate phases */}
              {!isIndeterminate && percent > 0 && (
                <span className="text-xs text-purple-600 whitespace-nowrap">
                  {percent}%
                </span>
              )}
            </div>

            {/* Stats line */}
            {(hasBytes || hasFiles) && (
              <div className="text-xs text-purple-600 mt-0.5">
                {hasBytes && (
                  <span>{formatBytes(progress?.bytesProcessed)} transferred</span>
                )}
                {hasBytes && hasFiles && <span> &middot; </span>}
                {hasFiles && (
                  <span>
                    {(progress?.processedFiles ?? 0).toLocaleString()} files
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cancel button */}
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs font-medium text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded transition-colors whitespace-nowrap flex-shrink-0"
          data-testid="sync-status-bar-cancel"
        >
          Cancel
        </button>
      </div>

      {/* Indeterminate animation keyframes */}
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

export default SyncStatusBar;
