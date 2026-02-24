/**
 * AndroidComingSoonStep
 *
 * Edge case step displayed when users select Android during phone type selection.
 * Shows a "Coming Soon" message and provides two navigation options:
 * - Go back and select iPhone (to use phone sync features)
 * - Continue with email only (proceed without phone sync)
 *
 * This step has custom navigation buttons inside the content, not using
 * the standard NavigationButtons shell component.
 *
 * @module onboarding/steps/AndroidComingSoonStep
 */

import React from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";

/**
 * Step metadata configuration.
 * Custom navigation is handled inside the Content component.
 */
export const meta: OnboardingStepMeta = {
  id: "android-coming-soon",
  progressLabel: "Android",
  platforms: ["macos", "windows"],
  navigation: {
    showBack: false,
    hideContinue: true,
  },
};

/**
 * Android Coming Soon step content.
 * Displays the coming soon message with feature preview and custom navigation buttons.
 */
function Content({ onAction }: OnboardingStepContentProps) {
  const handleGoBack = () => {
    onAction({ type: "GO_BACK_SELECT_IPHONE" });
  };

  const handleContinueWithEmail = () => {
    onAction({ type: "CONTINUE_EMAIL_ONLY" });
  };

  return (
    <div className="text-center">
      {/* Android Icon with Coming Soon Badge */}
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-10 h-10 text-green-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
            </svg>
          </div>
          {/* Coming Soon Badge */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
              Coming Soon
            </span>
          </div>
        </div>

        {/* Header */}
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Android Support Coming Soon!
        </h1>

        <p className="text-sm text-gray-600 mb-4">
          We're working hard to bring Android phone sync to Keepr. You'll
          be able to sync your text messages and contacts from your Android
          device.
        </p>

        {/* Feature Preview */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 text-left">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            What's Coming
          </h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
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
              Sync text messages from your Android phone
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
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
              Import contacts directly from your device
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
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
              Support for Samsung, Google Pixel, and more
            </li>
          </ul>
        </div>

        {/* Notification Sign Up */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-3">
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <div className="text-left">
              <p className="text-sm font-medium text-blue-900">
                Want to be notified?
              </p>
              <p className="text-xs text-blue-700">
                We'll email you when Android support is ready!
              </p>
            </div>
          </div>
        </div>

        {/* In the Meantime */}
        <div className="border-t border-gray-100 pt-4 mb-4">
          <p className="text-sm text-gray-500 mb-3">
            In the meantime, you can still use Keepr to audit your email
            communications. Email auditing works great on both Mac and PC!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleContinueWithEmail}
            className="w-full py-2.5 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
          >
            Continue with Email Only
          </button>

          <button
            onClick={handleGoBack}
            className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Go Back & Select iPhone
          </button>
        </div>

      {/* Footer Note */}
      <p className="text-xs text-gray-400 mt-4">
        Have an iPhone as well? Go back and select iPhone to sync your
        messages today.
      </p>
    </div>
  );
}

/**
 * Complete Android Coming Soon step definition.
 */
const AndroidComingSoonStep: OnboardingStep = {
  meta,
  Content,
};

export default AndroidComingSoonStep;
