/**
 * SyncProgressSteps Component
 * Renders a checklist of progress steps with status indicators.
 */
import React from 'react';
import type { SyncProgressStepsProps, SyncProgressStep } from './types';

/**
 * Renders the appropriate icon for a step's status
 */
function StepIcon({ status }: { status: SyncProgressStep['status'] }) {
  switch (status) {
    case 'complete':
      return (
        <svg
          className="w-5 h-5 text-green-500"
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
      );

    case 'error':
      return (
        <svg
          className="w-5 h-5 text-red-500"
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
      );

    case 'active':
      return (
        <div
          className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      );

    case 'pending':
    default:
      return (
        <div
          className="w-5 h-5 border-2 border-gray-300 rounded-full"
          aria-hidden="true"
        />
      );
  }
}

/**
 * Gets the text color class for a step based on its status
 */
function getStepTextClass(status: SyncProgressStep['status']): string {
  switch (status) {
    case 'complete':
      return 'text-gray-600';
    case 'error':
      return 'text-red-600';
    case 'active':
      return 'text-gray-800 font-medium';
    case 'pending':
    default:
      return 'text-gray-400';
  }
}

/**
 * Renders a single step row
 */
function StepRow({ step }: { step: SyncProgressStep }) {
  const textClass = getStepTextClass(step.status);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <StepIcon status={step.status} />
      <span className={`flex-1 text-sm ${textClass}`}>{step.label}</span>
      {step.duration && (
        <span className="text-xs text-gray-400">{step.duration}</span>
      )}
    </div>
  );
}

/**
 * SyncProgressSteps Component
 * Renders a list of progress steps with status icons.
 *
 * @example
 * ```tsx
 * <SyncProgressSteps
 *   steps={[
 *     { label: 'Connecting', status: 'complete', duration: '0.2s' },
 *     { label: 'Transferring', status: 'active', duration: '8m 14s' },
 *     { label: 'Saving', status: 'pending' },
 *   ]}
 * />
 * ```
 */
export function SyncProgressSteps({ steps, className = '' }: SyncProgressStepsProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-0.5 ${className}`} role="list" aria-label="Progress steps">
      {steps.map((step, index) => (
        <div key={`${step.label}-${index}`} role="listitem">
          <StepRow step={step} />
          {step.error && (
            <p className="ml-8 text-xs text-red-500 mt-0.5">{step.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default SyncProgressSteps;
