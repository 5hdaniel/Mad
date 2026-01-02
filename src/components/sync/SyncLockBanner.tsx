import React from "react";

interface SyncLockBannerProps {
  /** Human-readable name of the operation in progress */
  operationName: string;
  /** Optional callback to refresh sync status */
  onRetry?: () => void;
}

/**
 * SyncLockBanner Component
 *
 * Displays a warning banner when a sync operation is already in progress,
 * preventing users from triggering concurrent sync operations.
 *
 * TASK-910: Created for sync lock UI
 */
export function SyncLockBanner({
  operationName,
  onRetry,
}: SyncLockBannerProps): React.ReactElement {
  return (
    <div
      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
      role="alert"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        {/* Spinning indicator */}
        <div
          className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-sm font-medium text-yellow-800">
            Sync In Progress
          </h3>
          <p className="text-sm text-yellow-700 mt-1">
            {operationName}. Please wait for it to complete before starting
            another sync.
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="mt-3 text-sm text-yellow-700 hover:text-yellow-900 underline focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded"
        >
          Check again
        </button>
      )}
    </div>
  );
}

export default SyncLockBanner;
