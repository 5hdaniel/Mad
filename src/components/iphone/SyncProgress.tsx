import React from "react";
import type { SyncProgressProps } from "../../types/iphone";

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

/**
 * SyncProgress Component
 * Displays backup/sync progress with visual feedback
 *
 * Note: idevicebackup2 only provides per-file progress, not total backup size.
 * We emphasize bytes transferred (accurate) over percentages (estimated).
 */
export const SyncProgress: React.FC<SyncProgressProps> = ({
  progress,
  onCancel,
}) => {
  const getPhaseLabel = (): string => {
    switch (progress.phase) {
      case "preparing":
        return "Preparing backup...";
      case "backing_up":
        return "Backing up device...";
      case "extracting":
        return "Extracting messages and contacts...";
      case "complete":
        return "Sync complete!";
      case "error":
        return "An error occurred";
      default:
        return "Processing...";
    }
  };

  const isComplete = progress.phase === "complete";
  const isError = progress.phase === "error";
  const isBackingUp = progress.phase === "backing_up";
  const isPreparing = progress.phase === "preparing";
  const hasStartedTransfer = (progress.bytesProcessed ?? 0) > 0 || (progress.processedFiles ?? 0) > 0;

  // Show passcode hint only very early (before data starts flowing)
  const showPasscodeHint = !isComplete && !isError && (isPreparing || (isBackingUp && !hasStartedTransfer));

  // Show informational hints once transfer has started
  const showTransferHints = !isComplete && !isError && isBackingUp && hasStartedTransfer;

  return (
    <div className="p-6">
      {/* Progress Icon */}
      <div className="flex justify-center mb-4">
        {isComplete ? (
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : isError ? (
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
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
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Phase Label */}
      <h3 className="text-lg font-semibold text-gray-800 text-center mb-1">
        {getPhaseLabel()}
      </h3>

      {/* Status Message - shows what's actively happening */}
      {progress.message && !isComplete && !isError && (
        <p className="text-sm text-gray-500 text-center mb-3">
          {progress.message}
        </p>
      )}

      {/* Progress Bar - shown during backup phase */}
      {!isComplete && !isError && isBackingUp && (
        <div className="mb-4">
          {/* Determinate progress bar when we have estimated size */}
          {progress.estimatedTotalBytes && progress.estimatedTotalBytes > 0 && (progress.bytesProcessed ?? 0) > 0 ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs font-medium text-gray-600">
                  {Math.min(Math.round(((progress.bytesProcessed ?? 0) / progress.estimatedTotalBytes) * 100), 99)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(((progress.bytesProcessed ?? 0) / progress.estimatedTotalBytes) * 100, 99)}%`
                  }}
                />
              </div>
            </>
          ) : (
            /* Indeterminate progress bar when we don't have estimated size yet */
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full w-1/3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
                style={{
                  animation: 'indeterminate 1.5s ease-in-out infinite'
                }}
              />
            </div>
          )}
          <style>{`
            @keyframes indeterminate {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
        </div>
      )}

      {/* Primary Metric: Bytes Transferred (large and prominent) */}
      {hasStartedTransfer && !isComplete && (
        <div className="text-center mb-4">
          <p className="text-2xl font-bold text-gray-800">
            {formatBytes(progress.bytesProcessed)}
            {progress.estimatedTotalBytes && progress.estimatedTotalBytes > 0 && (
              <span className="text-lg font-normal text-gray-400">
                {" "}/ ~{formatBytes(progress.estimatedTotalBytes)}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500">
            transferred
            {progress.processedFiles !== undefined && progress.processedFiles > 0 && (
              <span> • {progress.processedFiles} files</span>
            )}
          </p>
        </div>
      )}

      {/* Determinate Progress Bar - only for extracting phase where we have accurate counts */}
      {!isComplete && !isError && progress.phase === "extracting" && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>
          {progress.processedFiles !== undefined && progress.totalFiles !== undefined && (
            <p className="text-xs text-gray-400 text-center mt-1">
              {progress.processedFiles} of {progress.totalFiles} files processed
            </p>
          )}
        </div>
      )}

      {/* Passcode Hint - only shown before data starts flowing */}
      {showPasscodeHint && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
          <svg
            className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-amber-700">
            <span className="font-medium">Check your iPhone!</span> You may need to enter your passcode to allow the backup.
          </p>
        </div>
      )}

      {/* First Sync Time Warning - shown once transfer has started */}
      {showTransferHints && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-4">
          <svg
            className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-blue-700">
            <span className="font-medium">First sync</span> may take up to two hours depending on your phone's data. Future syncs will be much faster.
          </p>
        </div>
      )}

      {/* Don't Disconnect Warning - shown throughout backup */}
      {!isComplete && !isError && (isBackingUp || isPreparing) && (
        <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mt-3">
          <svg
            className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-sm text-gray-600">
            Please keep your iPhone connected until sync is complete.
          </p>
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && !isComplete && !isError && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncProgress;
