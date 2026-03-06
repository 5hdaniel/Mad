/**
 * SyncStatusBanner Component
 *
 * Full-width banner for sync progress shown when NOT on the dashboard.
 * Follows the same pattern as OfflineBanner — sits between the title bar
 * and content area in AppShell.
 *
 * The dashboard has its own card-style SyncStatusIndicator; this banner
 * provides equivalent visibility on other screens.
 */

import React from "react";
import type { BackupProgress, SyncStatus } from "../../types/iphone";

interface SyncStatusBannerProps {
  iPhoneSyncStatus?: SyncStatus;
  iPhoneProgress?: BackupProgress | null;
  iPhoneError?: string | null;
  onViewDetails?: () => void;
  onCancel?: () => void;
}

const getPhaseLabel = (phase: BackupProgress["phase"]): string => {
  switch (phase) {
    case "preparing":
      return "Preparing import...";
    case "backing_up":
      return "Importing iPhone data...";
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
};

export function SyncStatusBanner({
  iPhoneSyncStatus,
  iPhoneProgress,
  iPhoneError,
  onViewDetails,
  onCancel,
}: SyncStatusBannerProps) {
  const isSyncing = iPhoneSyncStatus === "syncing";
  const isError = iPhoneSyncStatus === "error";

  // Only show during active sync or error
  if (!isSyncing && !isError) return null;

  const phase = iPhoneProgress?.phase ?? "preparing";

  // Error state
  if (isError) {
    return (
      <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm font-medium text-red-800">
              iPhone sync failed{iPhoneError ? `: ${iPhoneError}` : ""}
            </p>
          </div>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-3 py-1.5 text-xs font-medium text-red-800 bg-red-200 hover:bg-red-300 rounded-md transition-colors"
            >
              Details
            </button>
          )}
        </div>
      </div>
    );
  }

  // Syncing state
  return (
    <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0"
            style={{ animationDirection: "reverse" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <p className="text-sm font-medium text-blue-800">
            {getPhaseLabel(phase)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-3 py-1.5 text-xs font-medium text-blue-800 bg-blue-200 hover:bg-blue-300 rounded-md transition-colors"
            >
              Details
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-blue-400 hover:text-blue-600 rounded transition-colors"
              title="Cancel sync"
              aria-label="Cancel sync"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
