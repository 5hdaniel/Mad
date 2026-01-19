/**
 * SyncProgress Component
 * Reusable progress indicator with three variants: compact, standard, detailed.
 *
 * Use this component for:
 * - iPhone sync progress
 * - Email sync progress
 * - Data import/export progress
 * - Any long-running operation with progress feedback
 */
import React from 'react';
import type { SyncProgressProps } from './types';
import { SyncProgressSteps } from './SyncProgressSteps';

/**
 * Progress bar component with determinate or indeterminate state
 */
function ProgressBar({
  progress,
  showLabel = false,
}: {
  progress?: number;
  showLabel?: boolean;
}) {
  const isIndeterminate = progress === undefined;
  const clampedProgress = progress !== undefined ? Math.min(Math.max(progress, 0), 100) : 0;

  return (
    <div className="w-full">
      {showLabel && !isIndeterminate && (
        <div className="flex justify-end mb-1">
          <span className="text-xs font-medium text-gray-600">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-busy={isIndeterminate}
        aria-label="Progress"
      >
        {isIndeterminate ? (
          <div
            className="h-full w-1/3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
            style={{
              animation: 'syncProgressIndeterminate 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        )}
      </div>
      <style>{`
        @keyframes syncProgressIndeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

/**
 * Status icon for different states
 */
function StatusIcon({ isError, isComplete }: { isError?: boolean; isComplete?: boolean }) {
  if (isComplete) {
    return (
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  }

  // Default: spinning loader
  return (
    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
      <div
        className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Format date for last sync display
 */
function formatLastSync(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString();
}

/**
 * Get error message from Error or string
 */
function getErrorMessage(error: Error | string): string {
  return error instanceof Error ? error.message : error;
}

/**
 * Compact variant - single line with progress bar
 * Example: [========---] 78% Syncing messages...
 */
function CompactVariant({
  progress,
  progressText,
  title,
  subtitle,
  error,
  onCancel,
}: SyncProgressProps) {
  const isError = !!error;
  const displayText = title || subtitle || (isError ? 'Error' : 'Processing...');

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm truncate ${isError ? 'text-red-600' : 'text-gray-700'}`}>
            {displayText}
          </span>
          {progress !== undefined && !isError && (
            <span className="text-xs text-gray-500 flex-shrink-0">{Math.round(progress)}%</span>
          )}
          {progressText && !isError && (
            <span className="text-xs text-gray-400 flex-shrink-0">{progressText}</span>
          )}
        </div>
        {!isError && <ProgressBar progress={progress} />}
        {isError && (
          <p className="text-xs text-red-500 truncate">{getErrorMessage(error)}</p>
        )}
      </div>
      {onCancel && !isError && (
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
          aria-label="Cancel"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * Standard variant - multi-line with icon, title, progress bar, subtitle
 */
function StandardVariant({
  progress,
  progressText,
  title,
  subtitle,
  error,
  lastSyncDate,
  lastSyncInfo,
  onCancel,
  onRetry,
  onCopyDiagnostics,
}: SyncProgressProps) {
  const isError = !!error;
  const isComplete = progress === 100;
  const displayTitle = title || (isError ? 'Error' : isComplete ? 'Complete' : 'Processing...');

  return (
    <div className="text-center">
      {/* Status Icon */}
      <div className="flex justify-center mb-4">
        <StatusIcon isError={isError} isComplete={isComplete} />
      </div>

      {/* Title */}
      <h3 className={`text-lg font-semibold mb-1 ${isError ? 'text-red-700' : 'text-gray-800'}`}>
        {displayTitle}
      </h3>

      {/* Subtitle / Progress Text */}
      {(subtitle || progressText) && !isError && (
        <p className="text-sm text-gray-500 mb-3">
          {progressText || subtitle}
        </p>
      )}

      {/* Error Message */}
      {isError && (
        <div className="mb-4">
          <p className="text-sm text-red-600 mb-2">{getErrorMessage(error)}</p>
          {onCopyDiagnostics && (
            <button
              onClick={onCopyDiagnostics}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Copy diagnostic info
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {!isError && !isComplete && (
        <div className="mb-4">
          <ProgressBar progress={progress} showLabel />
        </div>
      )}

      {/* Last Sync Info */}
      {(lastSyncDate || lastSyncInfo) && (
        <p className="text-xs text-gray-400 mb-4">
          {lastSyncDate && `Last sync: ${formatLastSync(lastSyncDate)}`}
          {lastSyncDate && lastSyncInfo && ' - '}
          {lastSyncInfo}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-3">
        {onRetry && isError && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
        {onCancel && !isComplete && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Detailed variant - full progress with step-by-step checklist
 */
function DetailedVariant({
  progress,
  progressText,
  title,
  subtitle,
  steps,
  error,
  lastSyncDate,
  lastSyncInfo,
  onCancel,
  onRetry,
  onCopyDiagnostics,
}: SyncProgressProps) {
  const isError = !!error;
  const isComplete = progress === 100;
  const displayTitle = title || (isError ? 'Error' : isComplete ? 'Complete' : 'Processing...');

  return (
    <div>
      {/* Header with Icon and Title */}
      <div className="flex items-center gap-4 mb-4">
        <StatusIcon isError={isError} isComplete={isComplete} />
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-semibold ${isError ? 'text-red-700' : 'text-gray-800'}`}>
            {displayTitle}
          </h3>
          {(subtitle || progressText) && !isError && (
            <p className="text-sm text-gray-500 truncate">
              {progressText || subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {!isError && !isComplete && (
        <div className="mb-4">
          <ProgressBar progress={progress} showLabel />
        </div>
      )}

      {/* Error Message */}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600 mb-2">{getErrorMessage(error)}</p>
          {onCopyDiagnostics && (
            <button
              onClick={onCopyDiagnostics}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Copy diagnostic info
            </button>
          )}
        </div>
      )}

      {/* Steps Checklist */}
      {steps && steps.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <SyncProgressSteps steps={steps} />
        </div>
      )}

      {/* Last Sync Info */}
      {(lastSyncDate || lastSyncInfo) && (
        <p className="text-xs text-gray-400 mb-4">
          {lastSyncDate && `Last sync: ${formatLastSync(lastSyncDate)}`}
          {lastSyncDate && lastSyncInfo && ' - '}
          {lastSyncInfo}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 pt-2">
        {onRetry && isError && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
        {onCancel && !isComplete && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SyncProgress Component
 * A reusable progress indicator with three variants for different use cases.
 *
 * @example
 * ```tsx
 * // Compact - for inline/card use
 * <SyncProgress
 *   variant="compact"
 *   progress={78}
 *   title="Syncing messages..."
 * />
 *
 * // Standard - for modals/panels
 * <SyncProgress
 *   variant="standard"
 *   progress={78}
 *   title="Syncing iPhone..."
 *   progressText="6.2 GB / 8.0 GB"
 *   subtitle="Keep connected"
 *   onCancel={() => {}}
 * />
 *
 * // Detailed - with step checklist
 * <SyncProgress
 *   variant="detailed"
 *   progress={78}
 *   title="Syncing iPhone..."
 *   steps={[
 *     { label: 'Connecting', status: 'complete', duration: '0.2s' },
 *     { label: 'Transferring', status: 'active', duration: '8m 14s' },
 *     { label: 'Saving', status: 'pending' },
 *   ]}
 *   onCancel={() => {}}
 * />
 * ```
 */
export function SyncProgress({ variant, className = '', ...props }: SyncProgressProps) {
  const baseClassName = className ? ` ${className}` : '';

  switch (variant) {
    case 'compact':
      return (
        <div className={`py-2${baseClassName}`} data-testid="sync-progress-compact">
          <CompactVariant variant={variant} {...props} />
        </div>
      );

    case 'detailed':
      return (
        <div className={`p-4${baseClassName}`} data-testid="sync-progress-detailed">
          <DetailedVariant variant={variant} {...props} />
        </div>
      );

    case 'standard':
    default:
      return (
        <div className={`p-6${baseClassName}`} data-testid="sync-progress-standard">
          <StandardVariant variant={variant} {...props} />
        </div>
      );
  }
}

export default SyncProgress;
