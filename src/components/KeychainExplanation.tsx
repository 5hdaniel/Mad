import React, { useState } from "react";

interface KeychainExplanationProps {
  onContinue: (dontShowAgain: boolean) => void;
  isLoading?: boolean;
  hasPendingLogin?: boolean; // True when shown after OAuth (new user flow)
  skipExplanation?: boolean; // True when user previously checked "Don't show again"
}

// Setup steps for progress indicator
const SETUP_STEPS = [
  { id: 1, label: "Sign In" },
  { id: 2, label: "Secure Storage" },
  { id: 3, label: "Connect Email" },
  { id: 4, label: "Permissions" },
];

/**
 * Progress indicator component showing setup steps
 */
function SetupProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      {SETUP_STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step.id < currentStep
                  ? "bg-green-500 text-white"
                  : step.id === currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {step.id < currentStep ? (
                <svg
                  className="w-4 h-4"
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
              ) : (
                step.id
              )}
            </div>
            <span
              className={`text-xs mt-1 ${step.id === currentStep ? "text-blue-600 font-medium" : "text-gray-500"}`}
            >
              {step.label}
            </span>
          </div>
          {index < SETUP_STEPS.length - 1 && (
            <div
              className={`w-8 h-0.5 mb-5 transition-all ${
                step.id < currentStep ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
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
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {isLoading ? (
                <svg
                  className="w-8 h-8 text-blue-600 animate-spin"
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
                  className="w-8 h-8 text-blue-600"
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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {isLoading ? "Waiting for Authorization" : "Keychain Access"}
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              {isLoading
                ? "Please enter your password in the system dialog."
                : "Click continue to enter your Mac password."}
            </p>
            {!isLoading && (
              <button
                onClick={handleContinue}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:from-blue-600 hover:to-indigo-700"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full explanation mode
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress Indicator */}
        <div className="bg-gray-50 px-6 pt-5 pb-3 border-b border-gray-100">
          <SetupProgressIndicator currentStep={2} />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
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
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              Secure Storage Setup
            </h2>
            <p className="text-blue-100 text-sm">
              Protect your data with Keychain
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-blue-600 animate-spin"
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
              </div>
              <p className="text-gray-600 text-sm">
                Please enter your password in the system dialog...
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 text-sm mb-4">{bodyText}</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
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

              {/* Don't show again checkbox - show for all users */}
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
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

              <button
                onClick={handleContinue}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:from-blue-600 hover:to-indigo-700"
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeychainExplanation;
