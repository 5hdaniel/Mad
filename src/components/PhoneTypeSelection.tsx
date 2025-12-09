import React, { useState, useEffect } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { SetupProgressIndicator } from "./SetupProgressIndicator";

// Step number for progress indicator
const CURRENT_STEP = 1;

interface PhoneTypeSelectionProps {
  onSelectIPhone: () => void;
  onSelectAndroid: () => void;
  selectedType?: "iphone" | "android" | null;
}

/**
 * PhoneTypeSelection Component
 * Asks users what type of phone they use for their real estate business.
 * This appears as step 1 in the onboarding flow, right after terms acceptance.
 */
function PhoneTypeSelection({
  onSelectIPhone,
  onSelectAndroid,
  selectedType,
}: PhoneTypeSelectionProps) {
  // Local selection state - allows changing selection before continuing
  const [localSelection, setLocalSelection] = useState<"iphone" | "android" | null>(
    selectedType || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isWindows } = usePlatform();

  // Sync with prop if it changes (e.g., navigating back)
  useEffect(() => {
    if (selectedType) {
      setLocalSelection(selectedType);
    }
  }, [selectedType]);

  const handleContinue = () => {
    if (!localSelection) return;
    setIsSubmitting(true);
    if (localSelection === "iphone") {
      onSelectIPhone();
    } else {
      onSelectAndroid();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-start justify-center pt-12 px-8 pb-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress Indicator */}
        <SetupProgressIndicator currentStep={CURRENT_STEP} isWindows={isWindows} />

        {/* Phone Type Step */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Select Your Phone Type
          </h2>
          <p className="text-gray-600">
            Choose the type of device you'll be using with this application.
          </p>
        </div>

        <div className="mb-8 bg-blue-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            Why is this important?
          </h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-blue-800">
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Optimizes the application for your device</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-blue-800">
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Ensures compatibility with your phone's features</span>
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* iPhone Option */}
          <button
            onClick={() => setLocalSelection("iphone")}
            disabled={isSubmitting}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
              localSelection === "iphone"
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {/* Checkmark for selected */}
            {localSelection === "iphone" && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
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
              </div>
            )}

            {/* Apple Logo */}
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">iPhone</h3>
            <p className="text-sm text-gray-500">
              Sync messages and contacts from your iPhone
            </p>
          </button>

          {/* Android Option */}
          <button
            onClick={() => setLocalSelection("android")}
            disabled={isSubmitting}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
              localSelection === "android"
                ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                : "border-gray-200 hover:border-green-400 hover:bg-green-50"
            }`}
          >
            {/* Checkmark for selected */}
            {localSelection === "android" && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
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
              </div>
            )}

            {/* Android Logo */}
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
              </svg>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">Android</h3>
            <p className="text-sm text-gray-500">
              Samsung, Google Pixel, and other Android phones
            </p>
          </button>
        </div>

        {/* Continue Button - green when selection made */}
        <button
          onClick={handleContinue}
          disabled={!localSelection || isSubmitting}
          className={`w-full px-4 py-3 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            localSelection
              ? "bg-green-500 hover:bg-green-600 shadow-md"
              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          }`}
        >
          <span>{isSubmitting ? "Please wait..." : "Continue"}</span>
          {localSelection && (
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default PhoneTypeSelection;
