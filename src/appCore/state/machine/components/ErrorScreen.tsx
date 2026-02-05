/**
 * Error Screen Component
 * TASK-1800: Enhanced with error reporting to Supabase
 * TASK-1802: Added Reset App Data self-healing feature
 *
 * Displays error information when the application encounters
 * a non-recoverable error during initialization. Users can optionally
 * submit feedback about what they were doing when the error occurred.
 *
 * @module appCore/state/machine/components/ErrorScreen
 */

import React, { useState } from "react";
import type { AppError } from "../types";

interface ErrorScreenProps {
  /** Error details to display */
  error: AppError;
  /** Callback when user clicks retry (optional) */
  onRetry?: () => void;
}

/**
 * Error screen shown when app encounters a non-recoverable error.
 * Displays error message, code, optional retry button, error reporting,
 * and a reset app data option for self-healing.
 */
export function ErrorScreen({
  error,
  onRetry,
}: ErrorScreenProps): React.ReactElement {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmitReport = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await window.api.errorLogging.submit({
        errorType: "app_error",
        errorCode: error.code,
        errorMessage: error.message,
        stackTrace: typeof error.details === "string" ? error.details : undefined,
        userFeedback: feedback || undefined,
        currentScreen: "ErrorScreen",
      });

      if (result.success) {
        setSubmitted(true);
      } else {
        // Silent fail - don't show another error to the user
        // The error has already been queued for retry
        setSubmitted(true);
      }
    } catch {
      // Silent fail - don't show another error when user already has one
      // Just mark as submitted to provide closure
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirmation !== "RESET") return;

    setIsResetting(true);
    setResetError(null);

    try {
      const result = await window.api.app.reset();
      if (!result.success) {
        setResetError(result.error || "Reset failed. Please try again.");
        setIsResetting(false);
      }
      // If successful, app will quit and relaunch - this code won't execute
    } catch {
      setResetError("An unexpected error occurred during reset.");
      setIsResetting(false);
    }
  };

  const handleCloseResetDialog = () => {
    setShowResetDialog(false);
    setResetConfirmation("");
    setResetError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
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

        {/* Error report section */}
        {!submitted ? (
          <div className="mb-6 text-left">
            <label
              htmlFor="feedback"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Help us improve (optional)
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What were you doing when this happened?"
              className="w-full p-3 border border-gray-300 rounded-lg mb-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              disabled={isSubmitting}
            />
            {submitError && (
              <p className="text-red-500 text-sm mb-3">{submitError}</p>
            )}
            <button
              onClick={handleSubmitReport}
              disabled={isSubmitting}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              type="button"
            >
              {isSubmitting ? "Submitting..." : "Submit Error Report"}
            </button>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">
              Thank you! Your report has been submitted.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              type="button"
            >
              Try Again
            </button>
          )}

          {/* Reset App Data button */}
          <button
            onClick={() => setShowResetDialog(true)}
            className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            type="button"
          >
            Reset App Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              Reset App Data
            </h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete all local data:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 text-sm space-y-1">
              <li>All imported transactions</li>
              <li>All imported messages and emails</li>
              <li>Email account connections</li>
              <li>App preferences and settings</li>
              <li>Local database and cached data</li>
            </ul>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-800 text-sm">
                <strong>Your Supabase account and cloud data will NOT be affected.</strong>
                {" "}You will need to reconnect your email accounts after reset.
              </p>
            </div>
            <p className="text-gray-800 font-medium mb-2">
              Type <span className="font-mono bg-gray-100 px-1">RESET</span> to confirm:
            </p>
            <input
              type="text"
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Type RESET"
              disabled={isResetting}
              autoComplete="off"
            />
            {resetError && (
              <p className="text-red-500 text-sm mb-4">{resetError}</p>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCloseResetDialog}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isResetting}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetConfirmation !== "RESET" || isResetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {isResetting ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
