/**
 * Loading Screen Component
 *
 * Displays a loading indicator with phase-specific messages during
 * the application initialization sequence. Supports platform-specific
 * messages for phases that differ between macOS and Windows.
 *
 * When init stage events are available from the main process broadcaster
 * (BACKLOG-1379), shows more granular stage-specific messages.
 *
 * @module appCore/state/machine/components/LoadingScreen
 */

import React from "react";
import type { LoadingPhase } from "../types";
import { getDbInitMessage } from "../utils/platformInit";
import { OfflineNotice } from "../../../../components/common/OfflineNotice";

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
  /** Current init stage from main process broadcaster (BACKLOG-1379) */
  initStage?: string;
  /** Migration progress 0-100 from main process */
  migrationProgress?: number;
  /** Human-readable init status message from main process */
  initMessage?: string;
}

/**
 * Human-readable messages for each loading phase.
 * Some phases have platform-specific messages (handled separately).
 * Note: awaiting-keychain is handled by LoadingOrchestrator with a dedicated UI,
 * but included here for type completeness.
 */
const PHASE_MESSAGES: Record<LoadingPhase, string> = {
  "checking-storage": "Checking secure storage...",
  "validating-auth": "Verifying your account...", // TASK-2086: Pre-DB auth validation
  "awaiting-keychain": "Waiting for keychain access...", // macOS - shown by KeychainExplanation component
  "initializing-db": "Initializing secure database...", // Default, overridden by platform-specific
  "loading-auth": "Loading authentication...",
  "loading-user-data": "Loading your data...",
};

/**
 * Stage-specific messages for init stage events from the main process.
 * These provide more granular feedback than the loading phase messages
 * during the initializing-db phase.
 */
const INIT_STAGE_MESSAGES: Record<string, string> = {
  "db-opening": "Checking security...",
  "migrating": "Updating database...",
  "db-ready": "Database ready...",
  "creating-user": "Finalizing setup...",
  "complete": "Ready",
};

/**
 * Get the appropriate message for a loading phase, considering platform
 * and optional init stage override.
 */
function getPhaseMessage(
  phase: LoadingPhase,
  platform?: PlatformBasic,
  initStage?: string,
  migrationProgress?: number,
): string {
  // When init stage events are available during initializing-db,
  // show more granular stage-specific messages
  if (phase === "initializing-db" && initStage) {
    if (initStage === "migrating" && migrationProgress !== undefined) {
      return `Updating database... ${migrationProgress}%`;
    }
    const stageMessage = INIT_STAGE_MESSAGES[initStage];
    if (stageMessage) {
      return stageMessage;
    }
  }

  // Platform-specific messages for initializing-db phase
  if (phase === "initializing-db" && platform) {
    return getDbInitMessage(platform);
  }

  return PHASE_MESSAGES[phase];
}

/**
 * Loading screen shown during app initialization.
 * Displays a spinner, phase message, and optional progress bar.
 *
 * When init stage events are available (BACKLOG-1379), shows
 * stage-specific messages for more granular initialization feedback.
 */
export function LoadingScreen({
  phase,
  progress,
  platform,
  initStage,
  migrationProgress,
}: LoadingScreenProps): React.ReactElement {
  const message = getPhaseMessage(phase, platform, initStage, migrationProgress);

  // Use migration progress for the progress bar when available during migrating stage
  const displayProgress = initStage === "migrating" && migrationProgress !== undefined
    ? migrationProgress
    : progress;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      <OfflineNotice />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {/* Spinner */}
          <div
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            role="status"
            aria-label="Loading"
          />

          {/* Phase message */}
          <p className="text-gray-600 text-lg mb-2">{message}</p>

          {/* Progress bar (optional, hidden during keychain phase) */}
          {displayProgress !== undefined && phase !== "awaiting-keychain" && (
            <div
              className="w-48 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden"
              role="progressbar"
              aria-valuenow={displayProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
