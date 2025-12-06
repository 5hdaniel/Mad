import React from "react";
import type { SyncProgressProps } from "../../types/iphone";

/**
 * SyncProgress Component
 * Displays backup/sync progress with visual feedback
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
      <h3 className="text-lg font-semibold text-gray-800 text-center mb-2">
        {getPhaseLabel()}
      </h3>

      {/* Progress Message */}
      {progress.message && (
        <p className="text-sm text-gray-500 text-center mb-4">
          {progress.message}
        </p>
      )}

      {/* Progress Bar */}
      {!isComplete && !isError && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">Progress</span>
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progress.percent)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* File Progress */}
      {progress.processedFiles !== undefined &&
        progress.totalFiles !== undefined && (
          <p className="text-xs text-gray-400 text-center">
            {progress.processedFiles} of {progress.totalFiles} files processed
          </p>
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
