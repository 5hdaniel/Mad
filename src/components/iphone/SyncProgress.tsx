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
  isWaitingForPasscode = false,
}) => {
  /**
   * Option C: 2-Level Progress Display
   * Level 1: Combined title + context (bold, larger)
   * Level 2: Dynamic detail from progress.message (smaller, gray)
   */
  const getPhaseTitle = (): string => {
    // Special state: waiting for passcode
    if (isWaitingForPasscode) {
      return "Enter passcode on iPhone";
    }

    switch (progress.phase) {
      case "preparing":
        return "Preparing backup...";
      case "backing_up":
        return "Backing up - Keep connected";
      case "extracting":
        return "Reading messages - Safe to disconnect";
      case "storing":
        return "Saving to database - Safe to disconnect";
      case "complete":
        return "Sync complete!";
      case "error":
        return "Sync failed";
      default:
        return "Processing...";
    }
  };

  const isComplete = progress.phase === "complete";
  const isError = progress.phase === "error";
  const isBackingUp = progress.phase === "backing_up";
  const isPreparing = progress.phase === "preparing";
  const isExtracting = progress.phase === "extracting";
  const isStoring = progress.phase === "storing";
  const hasStartedTransfer = (progress.bytesProcessed ?? 0) > 0 || (progress.processedFiles ?? 0) > 0;

  // Backup is done once we move to extracting or storing phase
  const backupComplete = isExtracting || isStoring || isComplete;

  // Show passcode waiting warning (special state with detailed instructions)
  const showPasscodeWarning = isWaitingForPasscode;

  // Show first sync time warning once transfer has started
  const showFirstSyncHint = !isComplete && !isError && isBackingUp && hasStartedTransfer;

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
        ) : isWaitingForPasscode ? (
          // Special icon for passcode waiting - phone with keypad
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center animate-pulse">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {/* Phone outline */}
              <rect x="7" y="2" width="10" height="20" rx="2" strokeWidth={2} />
              {/* Keypad dots */}
              <circle cx="10" cy="10" r="1" fill="currentColor" />
              <circle cx="12" cy="10" r="1" fill="currentColor" />
              <circle cx="14" cy="10" r="1" fill="currentColor" />
              <circle cx="10" cy="13" r="1" fill="currentColor" />
              <circle cx="12" cy="13" r="1" fill="currentColor" />
              <circle cx="14" cy="13" r="1" fill="currentColor" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Level 1: Phase Title (combined title + context) */}
      <h3 className="text-lg font-semibold text-gray-800 text-center mb-1">
        {getPhaseTitle()}
      </h3>

      {/* Level 2: Dynamic detail message from backend */}
      {progress.message && !isComplete && (
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

      {/* Determinate Progress Bar - for extracting and storing phases where we have progress */}
      {!isComplete && !isError && (isExtracting || isStoring) && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">
            {progress.percent}% complete
          </p>
        </div>
      )}

      {/* Passcode Waiting Warning - detailed instructions when waiting for passcode */}
      {showPasscodeWarning && (
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
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <div className="text-sm text-amber-700">
            <p className="text-xs text-amber-600">
              After entering your passcode, it may take several minutes before the sync starts.
              Please don't disconnect or close this window.
            </p>
          </div>
        </div>
      )}

      {/* First Sync Time Warning - shown once transfer has started */}
      {showFirstSyncHint && (
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

      {/* Don't Disconnect Warning - shown during backup (but NOT when waiting for passcode, that has its own message) */}
      {!isComplete && !isError && (isBackingUp || isPreparing) && !isWaitingForPasscode && (
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
            Please keep your iPhone connected until backup completes.
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
