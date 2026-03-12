/**
 * UpgradePrompt Component
 * SPRINT-122: Plan Admin + Feature Gate Enforcement
 *
 * Displays a friendly message when a feature is gated by the user's plan.
 * Used as a fallback in feature-gated areas.
 *
 * @example
 * ```tsx
 * // Inline upgrade prompt
 * <UpgradePrompt featureName="Text Export" />
 *
 * // With custom description
 * <UpgradePrompt
 *   featureName="Email Attachments"
 *   description="Download and export email attachments with your audit package."
 * />
 *
 * // As a modal-style overlay
 * <UpgradePrompt featureName="Call Log" onDismiss={() => setShowPrompt(false)} />
 * ```
 */

import React from "react";

export interface UpgradePromptProps {
  /** Human-readable name of the gated feature */
  featureName: string;
  /** Optional detailed description of what the feature does */
  description?: string;
  /** Optional dismiss callback (shows a dismiss button when provided) */
  onDismiss?: () => void;
}

export function UpgradePrompt({
  featureName,
  description,
  onDismiss,
}: UpgradePromptProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
      {/* Lock icon */}
      <svg
        className="h-8 w-8 text-gray-400 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>

      <h3 className="text-lg font-medium text-gray-900">{featureName}</h3>

      <p className="text-sm text-gray-500 mt-1 text-center">
        {description ||
          "This feature is not available on your current plan."}
      </p>

      <p className="text-sm text-gray-500 mt-1">
        Contact your administrator to upgrade.
      </p>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export default UpgradePrompt;
