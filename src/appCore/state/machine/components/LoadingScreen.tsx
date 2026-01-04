/**
 * Loading Screen Component
 *
 * Displays a loading indicator with phase-specific messages during
 * the application initialization sequence. Supports platform-specific
 * messages for phases that differ between macOS and Windows.
 *
 * @module appCore/state/machine/components/LoadingScreen
 */

import React from "react";
import type { LoadingPhase } from "../types";
import { getDbInitMessage } from "../utils/platformInit";

/**
 * Platform info for determining platform-specific messages.
 * Subset of PlatformInfo - only what's needed for loading messages.
 */
interface PlatformBasic {
  isMacOS: boolean;
  isWindows: boolean;
}

interface LoadingScreenProps {
  /** Current loading phase */
  phase: LoadingPhase;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Platform information for platform-specific messages */
  platform?: PlatformBasic;
}

/**
 * Human-readable messages for each loading phase.
 * Some phases have platform-specific messages (handled separately).
 */
const PHASE_MESSAGES: Record<LoadingPhase, string> = {
  "checking-storage": "Checking secure storage...",
  "initializing-db": "Initializing secure database...", // Default, overridden by platform-specific
  "loading-auth": "Loading authentication...",
  "loading-user-data": "Loading your data...",
};

/**
 * Get the appropriate message for a loading phase, considering platform.
 */
function getPhaseMessage(phase: LoadingPhase, platform?: PlatformBasic): string {
  // Platform-specific messages for initializing-db phase
  if (phase === "initializing-db" && platform) {
    return getDbInitMessage(platform);
  }

  return PHASE_MESSAGES[phase];
}

/**
 * Loading screen shown during app initialization.
 * Displays a spinner, phase message, and optional progress bar.
 */
export function LoadingScreen({
  phase,
  progress,
  platform,
}: LoadingScreenProps): React.ReactElement {
  const message = getPhaseMessage(phase, platform);

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
        <p className="text-gray-600 text-lg mb-2">{message}</p>

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
