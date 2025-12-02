import React, { useState } from 'react';

interface KeychainExplanationProps {
  onContinue: (dontShowAgain: boolean) => void;
  isLoading?: boolean;
}

/**
 * KeychainExplanation Component
 *
 * Shows returning users an explanation before the keychain prompt appears.
 * Includes a "Don't show this again" checkbox to skip this screen in the future.
 */
function KeychainExplanation({ onContinue, isLoading = false }: KeychainExplanationProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    onContinue(dontShowAgain);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Keychain Access Required</h2>
            <p className="text-blue-100 text-sm">To decrypt your local data</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Please complete the system dialog...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 text-sm mb-4">
                Magic Audit needs to access your Mac's Keychain to decrypt your local database.
                This keeps your contacts and messages secure.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    Click <strong>"Always Allow"</strong> on the system dialog to avoid this prompt in the future.
                  </p>
                </div>
              </div>

              {/* Don't show again checkbox */}
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Don't show this explanation again</span>
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
