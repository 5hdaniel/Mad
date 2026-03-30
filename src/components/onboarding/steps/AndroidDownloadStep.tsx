/**
 * AndroidDownloadStep
 *
 * Step displayed when users select Android during phone type selection,
 * BEFORE the QR pairing step. Shows the download URL as text with
 * installation instructions so users don't confuse it with the pairing
 * QR code in the next step.
 *
 * BACKLOG-1479: New step to guide users through companion app installation.
 * BACKLOG-1490: Removed QR code to avoid confusion with the pairing QR.
 *
 * @module onboarding/steps/AndroidDownloadStep
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * URL for the broker portal download page.
 * Displayed as clickable text so users can type it into their phone browser.
 */
const DOWNLOAD_URL = "https://app.keeprcompliance.com/download/android";

/** Auto-advance timer duration in seconds */
const AUTO_ADVANCE_SECONDS = 60;

// =============================================================================
// STEP METADATA
// =============================================================================

/**
 * Step metadata configuration.
 * This step appears only for Android users and requires manual advancement.
 */
export const meta: OnboardingStepMeta = {
  id: "android-download",
  progressLabel: "Install App",
  platforms: ["macos", "windows"],
  navigation: {
    showBack: true,
    hideContinue: true, // Manual "I've installed it" button
  },
  isApplicable: (context) => context.phoneType === "android",
  isComplete: () => false, // Manual advance only
};

// =============================================================================
// STEP CONTENT
// =============================================================================

/**
 * Android Download step content.
 * Shows the download URL as text with installation instructions.
 * No QR code — the next step (pairing) has the QR code, and showing
 * two QR codes in sequence confuses users (BACKLOG-1490).
 */
function Content({ onAction }: OnboardingStepContentProps) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS);
  const [copied, setCopied] = useState(false);

  const handleAdvance = useCallback(() => {
    onAction({ type: "NAVIGATE_NEXT" });
  }, [onAction]);

  // Auto-advance timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAdvance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [handleAdvance]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(DOWNLOAD_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all Electron contexts
    }
  };

  return (
    <div className="text-center">
      {/* Download Icon */}
      <div className="relative inline-block mb-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>
      </div>

      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        Install Keepr Companion
      </h1>

      <p className="text-sm text-gray-600 mb-4">
        On your Android phone, open a browser and go to:
      </p>

      {/* Download URL display */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-base font-mono text-blue-700 break-all select-all mb-2">
          {DOWNLOAD_URL}
        </p>
        <button
          onClick={handleCopyUrl}
          className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
      </div>

      {/* Installation Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 text-left">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-500"
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
          Installation Steps
        </h3>
        <ol className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            Type the URL above into your phone&apos;s browser
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            Download and install the APK
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </span>
            Open the app and sign in
          </li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleAdvance}
          className="w-full py-2.5 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all shadow-md hover:shadow-lg"
        >
          I&apos;ve Installed It — Continue
        </button>

        <button
          onClick={handleAdvance}
          className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          Skip — I already have it
        </button>
      </div>

      {/* Timer + Footer Note */}
      <p className="text-xs text-gray-400 mt-4">
        Auto-continuing in {secondsLeft}s &middot; You can also download the
        companion app later from your broker portal.
      </p>
    </div>
  );
}

/**
 * Complete Android Download step definition.
 */
const AndroidDownloadStep: OnboardingStep = {
  meta,
  Content,
};

export default AndroidDownloadStep;
