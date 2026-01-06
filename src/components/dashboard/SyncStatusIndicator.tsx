/**
 * SyncStatusIndicator Component
 *
 * Displays the current sync status on the dashboard.
 * Shows progress for email, messages, and contacts sync operations.
 * Non-intrusive but visible - appears above the AI status card.
 *
 * @module components/dashboard/SyncStatusIndicator
 */

import React from "react";
import type { SyncStatus } from "../../hooks/useSyncStatus";

interface SyncStatusIndicatorProps {
  /** Current sync status for all operations */
  status: SyncStatus;
  /** Whether any sync is in progress */
  isAnySyncing: boolean;
  /** Current status message to display */
  currentMessage: string | null;
}

/**
 * Visual indicator for background sync operations.
 * Only renders when a sync is in progress.
 */
export function SyncStatusIndicator({
  status,
  isAnySyncing,
  currentMessage,
}: SyncStatusIndicatorProps) {
  // Don't render if no sync is in progress
  if (!isAnySyncing) {
    return null;
  }

  // Calculate overall progress (average of active syncs)
  const activeProgress = [
    status.emails.isSyncing ? status.emails.progress : null,
    status.messages.isSyncing ? status.messages.progress : null,
    status.contacts.isSyncing ? status.contacts.progress : null,
  ].filter((p): p is number => p !== null);

  const overallProgress = activeProgress.length > 0
    ? Math.round(activeProgress.reduce((a, b) => a + b, 0) / activeProgress.length)
    : null;

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 animate-fade-in"
      data-testid="sync-status-indicator"
    >
      <div className="flex items-center gap-3">
        {/* Animated sync icon */}
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-blue-600 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>

        {/* Status text and progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-800 truncate">
              {currentMessage || "Syncing..."}
            </span>
            {overallProgress !== null && (
              <span className="text-xs text-blue-600 ml-2">
                {overallProgress}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          {overallProgress !== null && (
            <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          )}

          {/* Indeterminate progress bar */}
          {overallProgress === null && (
            <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full animate-indeterminate" />
            </div>
          )}
        </div>
      </div>

      {/* Show individual sync statuses if multiple are running */}
      {(status.emails.isSyncing && status.messages.isSyncing) ||
       (status.emails.isSyncing && status.contacts.isSyncing) ||
       (status.messages.isSyncing && status.contacts.isSyncing) ? (
        <div className="mt-2 pt-2 border-t border-blue-200">
          <div className="flex flex-wrap gap-2 text-xs text-blue-600">
            {status.emails.isSyncing && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Emails
              </span>
            )}
            {status.messages.isSyncing && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Messages
              </span>
            )}
            {status.contacts.isSyncing && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Contacts
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SyncStatusIndicator;
