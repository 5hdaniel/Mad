/**
 * SyncStatusIndicator Component
 *
 * Unified notification component for sync operations on the dashboard.
 * This is the SINGLE notification system - handles both progress AND completion.
 *
 * Flow:
 * 1. During sync: Shows progress bar with current operation
 * 2. After sync: Shows completion message with dismiss button
 * 3. After dismiss: Disappears completely
 *
 * The completion message adapts based on pending transaction count:
 * - If pending > 0: Shows "X transactions found" with "Review Now" button
 * - If pending = 0: Shows "All Caught Up"
 *
 * @module components/dashboard/SyncStatusIndicator
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { SyncStatus } from "../../hooks/useAutoRefresh";

interface SyncStatusIndicatorProps {
  /** Current sync status for all operations */
  status: SyncStatus;
  /** Whether any sync is in progress */
  isAnySyncing: boolean;
  /** Current status message to display */
  currentMessage: string | null;
  /** Pending transaction count (shown in completion message) */
  pendingCount?: number;
  /** Callback when user clicks "Review Now" */
  onViewPending?: () => void;
}

/**
 * Unified sync notification - handles progress and completion.
 * Replaces the need for separate AIStatusCard for sync status.
 */
export function SyncStatusIndicator({
  status,
  isAnySyncing,
  currentMessage,
  pendingCount = 0,
  onViewPending,
}: SyncStatusIndicatorProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wasSyncingRef = useRef(false);
  const autoDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track transition from syncing to not syncing
  useEffect(() => {
    if (isAnySyncing) {
      wasSyncingRef.current = true;
      setDismissed(false); // Reset dismissed state when new sync starts
    } else if (wasSyncingRef.current && !isAnySyncing) {
      // Just finished syncing - show completion message
      setShowCompletion(true);
      wasSyncingRef.current = false;

      // Auto-dismiss after 5 seconds
      autoDismissTimeoutRef.current = setTimeout(() => {
        setShowCompletion(false);
        setDismissed(true);
      }, 5000);
    }

    return () => {
      if (autoDismissTimeoutRef.current) {
        clearTimeout(autoDismissTimeoutRef.current);
      }
    };
  }, [isAnySyncing]);

  // Handle manual dismiss
  const handleDismiss = useCallback(() => {
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
    }
    setShowCompletion(false);
    setDismissed(true);
  }, []);

  // Don't render if dismissed and not syncing
  if (dismissed && !isAnySyncing) {
    return null;
  }

  // Show completion state (after sync finishes)
  if (showCompletion && !isAnySyncing) {
    const hasPending = pendingCount > 0;

    return (
      <div
        className={`${
          hasPending
            ? "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200"
            : "bg-green-50 border-green-200"
        } border rounded-xl p-4 mb-4 animate-fade-in`}
        data-testid="sync-status-complete"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={`w-10 h-10 ${
                hasPending ? "bg-indigo-100" : "bg-green-100"
              } rounded-full flex items-center justify-center flex-shrink-0`}
            >
              {hasPending ? (
                <svg
                  className="w-5 h-5 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-green-600"
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
              )}
            </div>

            {/* Message */}
            <div>
              <h3
                className={`text-sm font-semibold ${
                  hasPending ? "text-indigo-900" : "text-green-800"
                }`}
              >
                {hasPending
                  ? `${pendingCount} transaction${pendingCount !== 1 ? "s" : ""} found`
                  : "All Caught Up"}
              </h3>
              <p
                className={`text-xs ${
                  hasPending ? "text-indigo-700" : "text-green-600"
                }`}
              >
                {hasPending
                  ? "New transactions detected and ready for review"
                  : "No new transactions found"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasPending && onViewPending && (
              <button
                onClick={onViewPending}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                Review Now
              </button>
            )}
            <button
              onClick={handleDismiss}
              className={`p-2 ${
                hasPending
                  ? "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100"
                  : "text-green-400 hover:text-green-600 hover:bg-green-100"
              } rounded-lg transition-colors`}
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <svg
                className="w-5 h-5"
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
      </div>
    );
  }

  // Don't render if no sync is in progress
  if (!isAnySyncing) {
    return null;
  }

  // Helper to render compact sync item
  const renderSyncItem = (
    label: string,
    isSyncing: boolean,
    progress: number | null,
    isComplete: boolean
  ) => {
    const isActive = isSyncing;
    const textColor = isComplete
      ? "text-green-600"
      : isActive
        ? "text-blue-600"
        : "text-gray-400";
    const barBgColor = isComplete
      ? "bg-green-200"
      : isActive
        ? "bg-blue-200"
        : "bg-gray-200";
    const barFillColor = isComplete
      ? "bg-green-500"
      : isActive
        ? "bg-blue-500"
        : "bg-gray-300";

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {/* Compact status icon */}
          {isComplete ? (
            <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : isActive ? (
            <svg className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" />
          )}
          <span className={`text-xs font-medium ${textColor} truncate`}>{label}</span>
          {progress !== null && isActive && (
            <span className="text-xs text-blue-500 ml-auto">{progress}%</span>
          )}
        </div>
        <div className={`w-full ${barBgColor} rounded-full h-1 overflow-hidden`}>
          {isComplete ? (
            <div className={`${barFillColor} h-1 rounded-full w-full`} />
          ) : isActive && progress !== null ? (
            <div className={`${barFillColor} h-1 rounded-full transition-all duration-300`} style={{ width: `${progress}%` }} />
          ) : isActive ? (
            <div className={`${barFillColor} h-1 rounded-full animate-indeterminate`} />
          ) : (
            <div className="h-1" />
          )}
        </div>
      </div>
    );
  };

  // Check completion status
  const emailsComplete = !status.emails.isSyncing && status.emails.progress === 100;
  const messagesComplete = !status.messages.isSyncing && status.messages.progress === 100;
  const contactsComplete = !status.contacts.isSyncing && status.contacts.progress === 100;

  // Show compact sync progress
  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 animate-fade-in"
      data-testid="sync-status-indicator"
    >
      <div className="flex items-center gap-4">
        {/* Sync icon */}
        <svg className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>

        {/* Three sync items in a row */}
        <div className="flex-1 flex items-center gap-4">
          {renderSyncItem("Emails", status.emails.isSyncing, status.emails.progress, emailsComplete)}
          {renderSyncItem("Messages", status.messages.isSyncing, status.messages.progress, messagesComplete)}
          {renderSyncItem("Contacts", status.contacts.isSyncing, status.contacts.progress, contactsComplete)}
        </div>
      </div>
    </div>
  );
}

export default SyncStatusIndicator;
