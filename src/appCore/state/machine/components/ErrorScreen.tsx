/**
 * Error Screen Component
 *
 * Displays error information when the application encounters
 * a non-recoverable error during initialization.
 *
 * @module appCore/state/machine/components/ErrorScreen
 */

import React from "react";
import type { AppError } from "../types";

interface ErrorScreenProps {
  /** Error details to display */
  error: AppError;
  /** Callback when user clicks retry (optional) */
  onRetry?: () => void;
}

/**
 * Error screen shown when app encounters a non-recoverable error.
 * Displays error message, code, and optional retry button.
 */
export function ErrorScreen({
  error,
  onRetry,
}: ErrorScreenProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <p className="text-sm text-gray-500 mb-6">Error code: {error.code}</p>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            type="button"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
