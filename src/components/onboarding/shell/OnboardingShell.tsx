import React from 'react';

interface OnboardingShellProps {
  /** Progress indicator component (rendered above card) */
  progressSlot?: React.ReactNode;
  /** Navigation buttons component (rendered below content) */
  navigationSlot?: React.ReactNode;
  /** Step content (rendered inside card) */
  children: React.ReactNode;
  /** Optional custom max-width class (default: 'max-w-xl') */
  maxWidth?: string;
}

/**
 * Unified layout wrapper for all onboarding steps.
 * Provides consistent background, centering, and card structure.
 *
 * Layout structure:
 * ```
 * ┌─────────────────────────────────────┐
 * │         [progressSlot]              │
 * │  ┌───────────────────────────────┐  │
 * │  │                               │  │
 * │  │         {children}            │  │
 * │  │                               │  │
 * │  └───────────────────────────────┘  │
 * │         [navigationSlot]            │
 * └─────────────────────────────────────┘
 * ```
 */
export function OnboardingShell({
  progressSlot,
  navigationSlot,
  children,
  maxWidth = 'max-w-xl',
}: OnboardingShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className={`${maxWidth} w-full mx-auto`}>
        {/* Progress indicator at top */}
        {progressSlot}

        {/* Card with responsive gap from progress bar */}
        <div className="mt-4 sm:mt-6">
          {/* Main card container */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            {children}
          </div>

          {/* Navigation buttons slot */}
          {navigationSlot}
        </div>
      </div>
    </div>
  );
}
