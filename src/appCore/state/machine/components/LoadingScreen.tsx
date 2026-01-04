/**
 * Loading Screen Component
 *
 * Displays a loading indicator with phase-specific messages during
 * the application initialization sequence.
 *
 * @module appCore/state/machine/components/LoadingScreen
 */

import React from "react";
import type { LoadingPhase } from "../types";

interface LoadingScreenProps {
  /** Current loading phase */
  phase: LoadingPhase;
  /** Optional progress percentage (0-100) */
  progress?: number;
}

/**
 * Human-readable messages for each loading phase.
 */
const PHASE_MESSAGES: Record<LoadingPhase, string> = {
  "checking-storage": "Checking secure storage...",
  "initializing-db": "Initializing secure database...",
  "loading-auth": "Loading authentication...",
  "loading-user-data": "Loading your data...",
};

/**
 * Loading screen shown during app initialization.
 * Displays a spinner, phase message, and optional progress bar.
 */
export function LoadingScreen({
  phase,
  progress,
}: LoadingScreenProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        {/* Spinner */}
        <div
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          role="status"
          aria-label="Loading"
        />

        {/* Phase message */}
        <p className="text-gray-600 text-lg mb-2">{PHASE_MESSAGES[phase]}</p>

        {/* Progress bar (optional) */}
        {progress !== undefined && (
          <div
            className="w-48 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
