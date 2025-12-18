import React from 'react';

/**
 * LLM Loading States Components
 *
 * Reusable UI components for displaying LLM operation states:
 * - Loading/processing indicators
 * - Progress bars
 * - Status messages
 * - Skeleton placeholders
 *
 * All components are self-contained with no external dependencies.
 */

// ============================================================================
// Types
// ============================================================================

export type LLMStatus = 'analyzing' | 'complete' | 'fallback';

export interface LLMProgressIndicatorProps {
  /** Current item being processed (1-indexed) */
  current: number;
  /** Total items to process */
  total: number;
  /** Optional estimated seconds remaining */
  estimatedTimeRemaining?: number;
  /** Optional step description */
  stepDescription?: string;
}

export interface LLMProcessingIndicatorProps {
  /** Custom message to display (default: "Analyzing...") */
  message?: string;
  /** Optional step description for context */
  stepDescription?: string;
}

export interface LLMStatusMessageProps {
  /** Current status of the LLM operation */
  status: LLMStatus;
  /** Optional custom message to override default */
  customMessage?: string;
}

export interface LLMProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  stepDescription?: string;
  /** Optional array of all step labels */
  steps?: string[];
  /** Current step index (0-indexed) */
  currentStep?: number;
}

export interface LLMErrorStateProps {
  /** Error message to display */
  message: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Whether to show the retry button */
  showRetry?: boolean;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Skeleton placeholder for transaction cards during loading.
 * Shows animated pulse effect to indicate loading state.
 */
export const TransactionSkeleton: React.FC = () => {
  return (
    <div
      className="transaction-skeleton animate-pulse bg-white border-2 border-gray-200 rounded-xl p-6"
      role="status"
      aria-label="Loading transaction"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Property address skeleton */}
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
          {/* Transaction details skeleton */}
          <div className="flex items-center gap-4 mb-2">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          {/* Email count skeleton */}
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
        {/* Action buttons skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-10 bg-gray-200 rounded w-20" />
          <div className="h-5 bg-gray-200 rounded w-5" />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

/**
 * Processing indicator with spinner animation.
 * Shows "Analyzing..." message with optional step description.
 */
export const LLMProcessingIndicator: React.FC<LLMProcessingIndicatorProps> = ({
  message = 'Analyzing...',
  stepDescription,
}) => {
  return (
    <div
      className="llm-processing-indicator flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg"
      role="status"
      aria-live="polite"
    >
      {/* Spinner */}
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <div className="flex-1">
        <span className="text-sm font-medium text-blue-900">{message}</span>
        {stepDescription && (
          <p className="text-xs text-blue-700 mt-0.5">{stepDescription}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Progress indicator with bar showing current/total progress.
 * Displays estimated time remaining when available.
 */
export const LLMProgressIndicator: React.FC<LLMProgressIndicatorProps> = ({
  current,
  total,
  estimatedTimeRemaining,
  stepDescription,
}) => {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div
      className="llm-progress p-4 bg-blue-50 border border-blue-200 rounded-lg"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Processing ${current} of ${total}`}
    >
      {/* Progress bar */}
      <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-blue-900">
            Analyzing with AI... {current}/{total}
          </span>
        </div>
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <span className="text-blue-700">
            ~{estimatedTimeRemaining}s remaining
          </span>
        )}
      </div>

      {/* Step description */}
      {stepDescription && (
        <p className="text-xs text-blue-700 mt-2">{stepDescription}</p>
      )}
    </div>
  );
};

/**
 * Progress bar with step descriptions.
 * Can show individual step labels or just percentage progress.
 */
export const LLMProgressBar: React.FC<LLMProgressBarProps> = ({
  progress,
  stepDescription,
  steps,
  currentStep,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="llm-progress-bar"
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Step indicators */}
      {steps && steps.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center gap-1 text-xs ${
                currentStep !== undefined && index <= currentStep
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  currentStep !== undefined && index < currentStep
                    ? 'bg-green-500'
                    : currentStep !== undefined && index === currentStep
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                }`}
              />
              <span className="hidden sm:inline">{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* Step description */}
      {stepDescription && (
        <p className="text-sm text-gray-600 mt-2">{stepDescription}</p>
      )}

      {/* Percentage */}
      <div className="flex justify-end mt-1">
        <span className="text-xs text-gray-500">{Math.round(clampedProgress)}%</span>
      </div>
    </div>
  );
};

/**
 * Status message component for LLM operations.
 * Shows contextual messages based on operation status.
 */
export const LLMStatusMessage: React.FC<LLMStatusMessageProps> = ({
  status,
  customMessage,
}) => {
  const messages: Record<LLMStatus, string> = {
    analyzing: 'Analyzing emails with AI...',
    complete: 'Analysis complete',
    fallback: 'Using pattern matching (LLM unavailable)',
  };

  const statusConfig: Record<LLMStatus, { bg: string; text: string; icon: string }> = {
    analyzing: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-900',
      icon: 'spinner',
    },
    complete: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-900',
      icon: 'check',
    },
    fallback: {
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-900',
      icon: 'info',
    },
  };

  const config = statusConfig[status];
  const message = customMessage ?? messages[status];

  return (
    <div
      className={`llm-status flex items-center gap-2 p-3 border rounded-lg ${config.bg}`}
      role="status"
      aria-live="polite"
    >
      {config.icon === 'spinner' && (
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      {config.icon === 'check' && (
        <svg
          className="w-5 h-5 text-green-600 flex-shrink-0"
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
      )}
      {config.icon === 'info' && (
        <svg
          className="w-5 h-5 text-yellow-600 flex-shrink-0"
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
      )}
      <span className={`text-sm font-medium ${config.text}`}>{message}</span>
    </div>
  );
};

/**
 * Error state component with optional retry button.
 * Provides user-friendly error display for LLM failures.
 */
export const LLMErrorState: React.FC<LLMErrorStateProps> = ({
  message,
  onRetry,
  showRetry = true,
}) => {
  return (
    <div
      className="llm-error-state p-4 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Error icon */}
        <svg
          className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">{message}</p>
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  TransactionSkeleton,
  LLMProcessingIndicator,
  LLMProgressIndicator,
  LLMProgressBar,
  LLMStatusMessage,
  LLMErrorState,
};
