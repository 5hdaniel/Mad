import React from "react";

interface AlertBannerProps {
  /** Icon to display (SVG path element) */
  icon: React.ReactNode;
  /** Banner title */
  title: string;
  /** Banner description */
  description: string;
  /** Primary action button text */
  actionText?: string;
  /** Primary action callback */
  onAction?: () => void;
  /** Whether to show dismiss button */
  dismissible?: boolean;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Test ID for testing */
  testId?: string;
}

/**
 * AlertBanner Component
 *
 * Reusable amber/warning banner for displaying important messages
 * with optional action and dismiss buttons.
 *
 * Used for:
 * - Complete account setup prompts
 * - Transaction limit warnings
 * - Other user notifications
 */
export function AlertBanner({
  icon,
  title,
  description,
  actionText,
  onAction,
  dismissible = false,
  onDismiss,
  testId,
}: AlertBannerProps): React.ReactElement {
  return (
    <div
      className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-md"
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
            <p className="text-xs text-amber-700">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actionText && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {actionText}
            </button>
          )}
          {dismissible && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
              title="Dismiss"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Common icons for AlertBanner
export const AlertIcons = {
  email: (
    <svg
      className="w-5 h-5 text-amber-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-5 h-5 text-amber-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};
