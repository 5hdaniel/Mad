/**
 * SyncStatusIndicator Component
 *
 * Unified notification component for sync operations on the dashboard.
 * This is the SINGLE notification system - handles both progress AND completion.
 *
 * IMPORTANT: Sync progress is shown for ALL users (not gated by license).
 * AI-specific features (pending transaction count, "Review Now" button) are
 * gated internally via useLicense() hook.
 *
 * Flow:
 * 1. During sync: Shows progress bar with current operation (all users)
 * 2. After sync: Shows completion message with dismiss button (all users)
 * 3. After dismiss: Disappears completely
 *
 * The completion message adapts based on license and pending count:
 * - If hasAIAddon && pending > 0: Shows "X transactions found" with "Review Now" button
 * - Otherwise: Shows "Sync Complete" with generic success message
 *
 * @module components/dashboard/SyncStatusIndicator
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLicense } from "../../contexts/LicenseContext";
import { useSyncOrchestrator } from "../../hooks/useSyncOrchestrator";
import type { SyncType, SyncItemStatus } from "../../services/SyncOrchestratorService";

interface SyncStatusIndicatorProps {
  /** Pending transaction count (shown in completion message) */
  pendingCount?: number;
  /** Callback when user clicks "Review Now" */
  onViewPending?: () => void;
  /** Callback to open Settings modal (for message cap warnings) */
  onOpenSettings?: () => void;
  /** When true, suppress auto-dismiss so the tour anchor stays visible (TASK-2081) */
  isTourActive?: boolean;
}

/**
 * Get display label for a sync type
 */
const getLabelForType = (type: SyncType): string => {
  switch (type) {
    case 'contacts':
      return 'Contacts';
    case 'emails':
      return 'Emails';
    case 'messages':
      return 'Messages';
    default:
      return type;
  }
};

/**
 * Status to color mapping for pills
 */
const statusColors: Record<SyncItemStatus, string> = {
  pending: 'bg-gray-100 text-gray-500',
  running: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

/**
 * Unified sync notification - handles progress and completion.
 * Replaces the need for separate AIStatusCard for sync status.
 */
export function SyncStatusIndicator({
  pendingCount = 0,
  onViewPending,
  onOpenSettings,
  isTourActive = false,
}: SyncStatusIndicatorProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wasSyncingRef = useRef(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get license status for AI-specific features (pending count, Review Now button)
  const { hasAIAddon } = useLicense();

  // Use SyncOrchestrator as single source of truth for sync state
  const { queue, isRunning, overallProgress } = useSyncOrchestrator();

  // Use isRunning from SyncOrchestrator as authoritative "is syncing" state
  const isAnySyncing = isRunning;

  // Check if any sync in the queue has an error
  const hasError = queue.some(item => item.status === 'error');

  // Check if any sync item has a warning (e.g., message cap exceeded)
  const syncWarning = queue.find(item => item.warning)?.warning;

  // Track transition from syncing to not syncing
  // NOTE: isTourActive is included in deps to gate auto-dismiss during the onboarding tour.
  // When the tour is active, completion stays visible so the [data-tour="sync-status"] anchor
  // is not removed mid-step. A separate effect below handles starting the timer when the tour ends.
  useEffect(() => {
    if (isAnySyncing) {
      wasSyncingRef.current = true;
      setDismissed(false); // Reset dismissed state when new sync starts
      // Cancel any pending auto-dismiss timer when new sync starts
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      setShowCompletion(false);
    } else if (wasSyncingRef.current && !isAnySyncing) {
      // Just finished syncing - show completion message
      setShowCompletion(true);
      wasSyncingRef.current = false;

      // Only auto-dismiss if tour is NOT active (TASK-2081)
      if (!isTourActive) {
        autoDismissTimerRef.current = setTimeout(() => {
          setShowCompletion(false);
          setDismissed(true);
          autoDismissTimerRef.current = null;
        }, 3000);
      }

      return () => {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
      };
    }
  }, [isAnySyncing, isTourActive]);

  // TASK-2081: When tour ends while completion is still showing, start the auto-dismiss timer.
  // This is a separate effect to avoid re-firing the sync transition logic above.
  useEffect(() => {
    if (!isTourActive && showCompletion && !dismissed && !isAnySyncing) {
      autoDismissTimerRef.current = setTimeout(() => {
        setShowCompletion(false);
        setDismissed(true);
        autoDismissTimerRef.current = null;
      }, 3000);

      return () => {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
      };
    }
  }, [isTourActive, showCompletion, dismissed, isAnySyncing]);

  // Handle manual dismiss (also cancels auto-dismiss timer)
  const handleDismiss = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
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
    // Only show pending count styling/message for AI add-on users
    const hasPending = hasAIAddon && pendingCount > 0;

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
                  : "Sync Complete"}
              </h3>
              <p
                className={`text-xs ${
                  hasPending ? "text-indigo-700" : "text-green-600"
                }`}
              >
                {hasPending
                  ? "New transactions detected and ready for review"
                  : "All data synced successfully"}
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

        {/* Message cap warning */}
        {syncWarning && onOpenSettings && (
          <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-xs text-amber-700">{syncWarning}</p>
            </div>
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap ml-3"
            >
              Adjust Limits
            </button>
          </div>
        )}
      </div>
    );
  }

  // Don't render if no sync is in progress and queue is empty
  if (!isAnySyncing && queue.length === 0) {
    return null;
  }

  // Get the currently running sync's progress for display
  const runningItem = queue.find(item => item.status === 'running');
  const activeProgress = runningItem?.progress ?? null;

  // Render a status pill for each sync item in queue order
  const renderPill = (type: SyncType, status: SyncItemStatus, progress: number, error?: string, phase?: string) => {
    const baseLabel = getLabelForType(type);
    // Show phase for running messages sync (e.g., "Messages - querying")
    const label = status === 'running' && phase ? `${baseLabel} - ${phase}` : baseLabel;
    const colorClass = statusColors[status];

    // Error state - red with tooltip
    if (status === 'error') {
      return (
        <span
          key={type}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} cursor-help`}
          title={error || 'Sync failed'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {baseLabel}
        </span>
      );
    }

    // Complete state - green with checkmark
    if (status === 'complete') {
      return (
        <span
          key={type}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {baseLabel}
        </span>
      );
    }

    // Running state - blue with optional phase (progress shown separately)
    if (status === 'running') {
      return (
        <span
          key={type}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
        >
          {label}
        </span>
      );
    }

    // Pending state - gray
    return (
      <span
        key={type}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {baseLabel}
      </span>
    );
  };

  // Show compact sync progress
  return (
    <div
      className={`${hasError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg px-3 py-2 mb-3 animate-fade-in`}
      data-testid="sync-status-indicator"
    >
      {/* Status pills row - render in queue order */}
      <div className="flex items-center gap-2 mb-2">
        {/* Spinning sync icon (counter-clockwise) */}
        <svg
          className={`w-4 h-4 ${hasError ? 'text-red-600' : 'text-blue-600'} ${isAnySyncing ? 'animate-spin' : ''} flex-shrink-0`}
          style={isAnySyncing ? { animationDirection: 'reverse' } : undefined}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className={`text-xs font-medium ${hasError ? 'text-red-800' : 'text-blue-800'}`}>
          {isAnySyncing ? 'Syncing:' : hasError ? 'Sync Error:' : 'Sync:'}
        </span>
        {/* Render pills in queue order */}
        {queue.map((item) => renderPill(item.type, item.status, item.progress, item.error, item.phase))}
        {activeProgress !== null && (
          <span className="text-xs text-blue-600 ml-auto">{activeProgress}%</span>
        )}
      </div>

      {/* Single progress bar - shows current item's progress to match the % text */}
      <div className={`w-full ${hasError ? 'bg-red-200' : 'bg-blue-200'} rounded-full h-1.5 overflow-hidden`}>
        {isAnySyncing ? (
          activeProgress !== null && activeProgress > 0 ? (
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${activeProgress}%` }}
            />
          ) : (
            <div className="bg-blue-500 h-1.5 rounded-full animate-indeterminate" />
          )
        ) : hasError ? (
          <div className="bg-red-500 h-1.5 rounded-full w-full" />
        ) : (
          <div className="bg-green-500 h-1.5 rounded-full w-full" />
        )}
      </div>

      {/* Disabled tools notice - only show when syncing */}
      {isAnySyncing && (
        <p className="text-xs text-blue-600 mt-2 text-center">
          Audit tools are disabled during sync to ensure accurate data
        </p>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
