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

  // Check completion status
  const emailsComplete = !status.emails.isSyncing && status.emails.progress === 100;
  const messagesComplete = !status.messages.isSyncing && status.messages.progress === 100;
  const contactsComplete = !status.contacts.isSyncing && status.contacts.progress === 100;

  // Don't render if no sync is in progress
  if (!isAnySyncing) {
    return null;
  }

  // Get the active sync's progress for the main progress bar
  const activeProgress = status.messages.isSyncing && status.messages.progress !== null
    ? status.messages.progress
    : status.contacts.isSyncing && status.contacts.progress !== null
      ? status.contacts.progress
      : status.emails.isSyncing && status.emails.progress !== null
        ? status.emails.progress
        : null;

  // Render a status pill for each sync type (no spinners, just color)
  const renderPill = (label: string, isSyncing: boolean, isComplete: boolean) => {
    if (isComplete) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {label}
        </span>
      );
    }
    if (isSyncing) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        {label}
      </span>
    );
  };

  // Show compact sync progress
  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 animate-fade-in"
      data-testid="sync-status-indicator"
    >
      {/* Status pills row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Spinning sync icon (counter-clockwise) */}
        <svg className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" style={{ animationDirection: 'reverse' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-xs font-medium text-blue-800">Syncing:</span>
        {renderPill("Emails", status.emails.isSyncing, emailsComplete)}
        {renderPill("Messages", status.messages.isSyncing, messagesComplete)}
        {renderPill("Contacts", status.contacts.isSyncing, contactsComplete)}
        {activeProgress !== null && (
          <span className="text-xs text-blue-600 ml-auto">{activeProgress}%</span>
        )}
      </div>

      {/* Single progress bar */}
      <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
        {activeProgress !== null ? (
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${activeProgress}%` }}
          />
        ) : (
          <div className="bg-blue-500 h-1.5 rounded-full animate-indeterminate" />
        )}
      </div>
    </div>
  );
}

export default SyncStatusIndicator;
