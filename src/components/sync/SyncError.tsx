import React from "react";
import type { SyncErrorCode } from "./types";

interface SyncErrorProps {
  error: SyncErrorCode | string;
  onRetry: () => void;
  onCancel: () => void;
}

const friendlyErrors: Record<string, string> = {
  DEVICE_DISCONNECTED:
    "Your iPhone was disconnected. Please reconnect and try again.",
  DEVICE_LOCKED: "Please unlock your iPhone and try again.",
  BACKUP_FAILED: "The sync could not be completed. Please try again.",
  PASSWORD_INCORRECT: "The backup password was incorrect. Please try again.",
};

export const SyncError: React.FC<SyncErrorProps> = ({
  error,
  onRetry,
  onCancel,
}) => {
  const message =
    friendlyErrors[error] || "An unexpected error occurred. Please try again.";

  return (
    <div className="sync-error">
      <div className="error-icon-container mb-4">
        <svg
          className="w-16 h-16 text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-medium mb-2">Sync Failed</h3>

      <p className="text-gray-600 mb-4 max-w-xs text-center">{message}</p>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="btn-secondary px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="btn-primary px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
