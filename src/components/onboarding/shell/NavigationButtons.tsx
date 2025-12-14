/**
 * Navigation buttons component for onboarding steps.
 *
 * Renders Back, Next, and Skip buttons based on configuration.
 * This is a pure presentation component - all navigation logic
 * is handled via callbacks.
 *
 * @module onboarding/shell/NavigationButtons
 */

import React from "react";
import type { SkipConfig } from "../types";

/**
 * Props for the NavigationButtons component.
 */
export interface NavigationButtonsProps {
  /** Show back button */
  showBack: boolean;
  /** Show next/continue button */
  showNext: boolean;
  /** Skip configuration (false = no skip button) */
  skipConfig?: SkipConfig | false;
  /** Custom label for back button */
  backLabel?: string;
  /** Custom label for next button */
  nextLabel?: string;
  /** Disable next button (explicit override) */
  nextDisabled?: boolean;
  /** Whether step is complete (enables Next when true) */
  isStepComplete?: boolean;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when next button is clicked */
  onNext?: () => void;
  /** Callback when skip button is clicked */
  onSkip?: () => void;
}

/**
 * Navigation buttons for onboarding steps.
 *
 * Renders Back, Next, and Skip buttons based on configuration.
 * All navigation logic is handled via callbacks provided by the parent.
 *
 * @example
 * ```tsx
 * <NavigationButtons
 *   showBack={true}
 *   showNext={true}
 *   isStepComplete={context.phoneType !== null}
 *   onBack={() => goBack()}
 *   onNext={() => goNext()}
 * />
 * ```
 */
export function NavigationButtons({
  showBack,
  showNext,
  skipConfig,
  backLabel = "Back",
  nextLabel = "Continue",
  nextDisabled = false,
  isStepComplete = true,
  onBack,
  onNext,
  onSkip,
}: NavigationButtonsProps) {
  // Check if skip should be shown (skipConfig is SkipConfig, not false or undefined)
  const showSkip = skipConfig !== undefined && skipConfig !== false;

  // Next is disabled if explicitly disabled OR if step is not complete
  const isNextDisabled = nextDisabled || !isStepComplete;

  return (
    <div className="mt-6">
      {/* Skip section (above main buttons) */}
      {showSkip && (
        <div className="text-center mb-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {skipConfig.label}
          </button>
          {skipConfig.description && (
            <p className="text-xs text-gray-400 mt-1">
              {skipConfig.description}
            </p>
          )}
        </div>
      )}

      {/* Main navigation buttons */}
      <div className="flex gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {backLabel}
          </button>
        )}
        {showNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
