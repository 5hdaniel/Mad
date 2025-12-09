import React, { useState } from "react";
import { SetupProgressIndicator } from "./SetupProgressIndicator";

interface KeychainExplanationProps {
  onContinue: (dontShowAgain: boolean) => void;
  onBack?: () => void;
  isLoading?: boolean;
  hasPendingLogin?: boolean; // True when shown after OAuth (new user flow)
  skipExplanation?: boolean; // True when user previously checked "Don't show again"
}

/**
 * KeychainExplanation Component
 *
 * Shows users an explanation before the keychain prompt appears.
 * Three modes:
 * 1. Full explanation (new user or first time): Detailed explanation with checkbox
 * 2. Simple waiting (skipExplanation=true): Just a waiting message, no explanation
 * 3. Loading: Spinner while waiting for system dialog
 *
 * Includes a "Don't show this again" checkbox to skip explanation in the future.
 */
function KeychainExplanation({
  onContinue,
  onBack,
  isLoading = false,
  hasPendingLogin = false,
  skipExplanation = false,
}: KeychainExplanationProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    onContinue(dontShowAgain);
  };

  const bodyText = hasPendingLogin
    ? "Magic Audit needs to set up secure storage on your Mac to protect your data. This is a one-time setup that keeps your contacts and messages encrypted."
    : "Magic Audit needs to access your Mac's Keychain to decrypt your local database. This keeps your contacts and messages secure.";

  // Simple waiting mode - for returning users who checked "Don't show again"
  if (skipExplanation && !hasPendingLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-start justify-center pt-12 px-8 pb-8">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
              {isLoading ? (
                <svg
                  className="w-10 h-10 text-white animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {isLoading ? "Waiting for Authorization" : "Keychain Access"}
            </h2>
            <p className="text-gray-600 mb-8">
              {isLoading
                ? "Please enter your password in the system dialog."
                : "Click continue to enter your Mac password."}
            </p>
            {!isLoading && (
              <div className="flex gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleContinue}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full explanation mode
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-start justify-center pt-12 px-8 pb-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress Indicator */}
        <SetupProgressIndicator currentStep={3} isWindows={false} />

        {/* Icon and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            {isLoading ? (
              <svg
                className="w-10 h-10 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {isLoading ? "Waiting for Authorization" : "Secure Storage Setup"}
          </h2>
          <p className="text-gray-600">
            {isLoading
              ? "Please enter your password in the system dialog."
              : "Protect your data with macOS Keychain"}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">
              A system dialog should appear. If you don't see it, check behind this window.
            </p>
          </div>
        ) : (
          <>
            {/* Info box */}
            <div className="mb-6 bg-blue-50 rounded-xl p-4">
              <p className="text-gray-700 text-sm mb-3">{bodyText}</p>
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  Click <strong>"Always Allow"</strong> on the system dialog
                  to avoid entering your password each time.
                </p>
              </div>
            </div>

            {/* Don't show again checkbox */}
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                Don't show this explanation again
              </span>
            </label>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleContinue}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default KeychainExplanation;
