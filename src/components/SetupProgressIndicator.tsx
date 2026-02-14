/**
 * @deprecated Use `onboarding/shell/ProgressIndicator.tsx` instead.
 *
 * Migration guide:
 * 1. New component receives steps array from flow
 * 2. Progress labels come from step.meta.progressLabel
 * 3. Used via OnboardingShell progressSlot
 *
 * This file will be removed after migration is complete.
 */
import React from "react";

interface SetupProgressIndicatorProps {
  currentStep: number;
  isWindows?: boolean;
}

// macOS: 4-step flow
const MACOS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Connect Email" },
  { id: 3, label: "Secure Storage" },
  { id: 4, label: "Permissions" },
];

// Windows: Simplified 2-step flow (no Secure Storage or Permissions needed)
const WINDOWS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Connect Email" },
];

/**
 * Shared progress indicator component for onboarding screens.
 * Shows the current step in the setup flow with visual feedback.
 */
export function SetupProgressIndicator({
  currentStep,
  isWindows = false,
}: SetupProgressIndicatorProps) {
  const steps = isWindows ? WINDOWS_SETUP_STEPS : MACOS_SETUP_STEPS;

  return (
    <div className="mb-8">
      {/* Circles and connecting lines */}
      <div className="flex items-center justify-center px-2 mb-3">
        {/* Invisible spacer before first circle */}
        <div className="w-1 h-0.5 flex-shrink-0" />

        {steps.map((step, index) => (
          <React.Fragment key={`circle-${step.id}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all flex-shrink-0 ${
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
              ) : null}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-all max-w-[48px] ${
                  step.id < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}

        {/* Invisible spacer after last circle */}
        <div className="w-1 h-0.5 flex-shrink-0" />
      </div>

      {/* Labels - aligned with circles above */}
      <div className="flex items-start justify-center px-2">
        {/* Invisible spacer to match circle row */}
        <div className="w-1 flex-shrink-0" />

        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.id}`}>
            <div className="flex-shrink-0 w-8 flex items-center justify-center">
              <span
                className={`text-xs text-center max-w-[56px] ${
                  step.id === currentStep
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-1 max-w-[48px]" />
            )}
          </React.Fragment>
        ))}

        {/* Invisible spacer to match circle row */}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

export default SetupProgressIndicator;
