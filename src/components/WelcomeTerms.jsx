import React, { useState } from 'react';

/**
 * WelcomeTerms Component
 * Shows welcome message and terms acceptance for new users
 * Appears once after first OAuth login
 */
function WelcomeTerms({ user, onAccept, onDecline }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showDeclineConfirmation, setShowDeclineConfirmation] = useState(false);

  const handleAccept = async () => {
    if (!termsAccepted || !privacyAccepted) {
      return;
    }

    setAccepting(true);
    try {
      await onAccept();
    } catch (error) {
      console.error('Failed to accept terms:', error);
      setAccepting(false);
    }
  };

  const handleDeclineClick = () => {
    setShowDeclineConfirmation(true);
  };

  const handleConfirmDecline = () => {
    onDecline();
  };

  const handleCancelDecline = () => {
    setShowDeclineConfirmation(false);
  };

  const canProceed = termsAccepted && privacyAccepted;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-6 rounded-t-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Magic Audit!</h2>
            <p className="text-blue-100">
              We're excited to have you on board, {user?.display_name || user?.email?.split('@')[0]}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Welcome Message */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Let's get started!</h3>
            <p className="text-sm text-gray-600 mb-3">
              Magic Audit helps real estate professionals extract and organize transaction data from emails automatically.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">14-Day Free Trial</p>
                  <p className="text-xs text-blue-700">
                    Your trial starts now. No credit card required.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Privacy */}
          <div className="space-y-3 mb-6">
            <label className="flex items-start cursor-pointer group">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                I agree to the{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">
                  Terms of Service
                </a>
              </span>
            </label>
            <label className="flex items-start cursor-pointer group">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                I agree to the{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDeclineClick}
              disabled={accepting}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={!canProceed || accepting}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                canProceed && !accepting
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Accepting...
                </span>
              ) : (
                'Accept & Continue'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Decline Confirmation Modal */}
      {showDeclineConfirmation && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-3">
              Cannot Create Account
            </h3>

            {/* Message */}
            <p className="text-sm text-gray-700 text-center mb-6 leading-relaxed">
              We can't create an account without accepting the Privacy Policy and Terms and Conditions.
              These agreements are required to use Magic Audit.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelDecline}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmDecline}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Exit App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WelcomeTerms;
