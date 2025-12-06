import React, { useState } from "react";
import { usePlatform } from "../contexts/PlatformContext";

// Setup steps for progress indicator - platform specific
// macOS: 4-step flow (Sign In happens before onboarding)
const MACOS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Secure Storage" },
  { id: 3, label: "Connect Email" },
  { id: 4, label: "Permissions" },
];

// Windows: Simplified 2-step flow (no Secure Storage or Permissions needed)
const WINDOWS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Connect Email" },
];

/**
 * Progress indicator component showing setup steps
 */
function SetupProgressIndicator({
  currentStep,
  isWindows,
}: {
  currentStep: number;
  isWindows: boolean;
}) {
  const steps = isWindows ? WINDOWS_SETUP_STEPS : MACOS_SETUP_STEPS;
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, index) => (
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
          {index < steps.length - 1 && (
            <div
              className={`w-6 h-0.5 mb-5 transition-all ${
                step.id < currentStep ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

type PhoneType = "iphone" | "android" | null;

interface PhoneTypeSelectionProps {
  onSelectIPhone: () => void;
  onSelectAndroid: () => void;
  selectedType?: "iphone" | "android" | null;
  onBack?: () => void;
}

/**
 * PhoneTypeSelection Component
 * Asks users what type of phone they use for their real estate business.
 * This appears right after terms acceptance in the onboarding flow.
 */
function PhoneTypeSelection({
  onSelectIPhone,
  onSelectAndroid,
  selectedType,
  onBack,
}: PhoneTypeSelectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isWindows } = usePlatform();

  const handleSelectIPhone = async () => {
    setIsSubmitting(true);
    onSelectIPhone();
  };

  const handleSelectAndroid = async () => {
    setIsSubmitting(true);
    onSelectAndroid();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Progress Indicator */}
        <SetupProgressIndicator currentStep={1} isWindows={isWindows} />

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              What phone do you use?
            </h1>
            <p className="text-gray-600">
              Magic Audit can sync your text messages and contacts to help track
              real estate communications.
            </p>
          </div>

          {/* Phone Selection Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* iPhone Option */}
            <button
              onClick={handleSelectIPhone}
              disabled={isSubmitting}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedType === "iphone"
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {/* Checkmark for selected */}
              {selectedType === "iphone" && (
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
              onClick={handleSelectAndroid}
              disabled={isSubmitting}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedType === "android"
                  ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                  : "border-gray-200 hover:border-green-400 hover:bg-green-50"
              }`}
            >
              {/* Checkmark for selected */}
              {selectedType === "android" && (
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

          {/* Info Box */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"
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
              <p className="text-sm text-gray-600">
                Your phone data stays private and secure. We only sync the data
                you explicitly choose to share.
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          {onBack && (
            <div className="flex items-center justify-start gap-3 pt-2 border-t border-gray-200">
              <button
                onClick={onBack}
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isSubmitting
                    ? "text-gray-400 cursor-not-allowed bg-gray-100"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Back</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhoneTypeSelection;
