/**
 * DataSyncStep - Sync Checkpoint Before FDA/Permissions
 *
 * This step runs AFTER email-connect and BEFORE permissions/FDA.
 * It ensures local DB and Supabase are in sync before risky steps
 * that may cause app force-quit (like FDA on macOS).
 *
 * Features:
 * - Pulls phone_type from Supabase cloud and saves to local DB
 * - Auto-retry on failure (1 retry with 500ms delay)
 * - Graceful degradation (continues even if sync fails)
 * - Auto-advances when complete (~100ms visible)
 *
 * Platform: macOS, Windows (both for consistency)
 *
 * @module onboarding/steps/DataSyncStep
 */

import React, { useState, useEffect, useRef } from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";
import logger from '../../../utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const RETRY_DELAY_MS = 500;
const AUTO_ADVANCE_DELAY_MS = 100;

// =============================================================================
// STEP METADATA
// =============================================================================

/**
 * Step metadata for the data sync step.
 * Shows after email-connect, before permissions/FDA.
 */
export const meta: OnboardingStepMeta = {
  id: "data-sync",
  progressLabel: "Syncing",
  platforms: ["macos", "windows"],
  navigation: {
    showBack: false,
    hideContinue: true, // Auto-advances, no button needed
  },
  // This step cannot be skipped
  skip: undefined,
  // Show only if DB is initialized and we have a userId
  shouldShow: (context) => {
    const shouldShow = context.isDatabaseInitialized && context.userId !== null;
    logger.debug(
      `%c[STEP] data-sync: ${shouldShow ? 'SHOW' : 'HIDE'}`,
      `background: ${shouldShow ? '#DAA520' : '#228B22'}; color: white; font-weight: bold; padding: 2px 8px;`,
      { isDatabaseInitialized: context.isDatabaseInitialized, hasUserId: context.userId !== null }
    );
    return shouldShow;
  },
  // Queue predicates
  isApplicable: (context) => context.isDatabaseInitialized && context.userId !== null,
  isComplete: () => false, // Auto-completes on render
};

// =============================================================================
// ICONS
// =============================================================================

/**
 * Spinner icon for syncing state
 */
function SpinnerIcon(): React.ReactElement {
  return (
    <svg
      className="w-7 h-7 text-white animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Checkmark icon for success/ready state
 */
function CheckmarkIcon(): React.ReactElement {
  return (
    <svg
      className="w-7 h-7 text-white"
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
  );
}

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

type SyncStatus = 'syncing' | 'success' | 'skipped';

/**
 * Content component for the data sync step.
 * Automatically syncs data from cloud and advances.
 */
export function DataSyncContent({
  context,
  onAction,
}: OnboardingStepContentProps): React.ReactElement {
  const [status, setStatus] = useState<SyncStatus>('syncing');

  // Effect safety pattern: ref guard prevents double-execution
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current || !context.userId) return;
    hasStartedRef.current = true;

    // Capture userId to avoid non-null assertions in closures
    const userId = context.userId;

    async function syncDataWithRetry(retries = 1): Promise<boolean> {
      try {
        // Type assertion needed due to declaration file not being fully recognized
        const userApi = window.api.user as typeof window.api.user & {
          syncPhoneTypeFromCloud: (userId: string) => Promise<{ success: boolean; error?: string }>;
        };
        const result = await userApi.syncPhoneTypeFromCloud(userId);
        return result.success;
      } catch (error) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          return syncDataWithRetry(retries - 1);
        }
        logger.error("[DataSyncStep] Sync error after retries:", error);
        return false;
      }
    }

    async function syncData() {
      const success = await syncDataWithRetry(1);

      if (success) {
        setStatus('success');
      } else {
        logger.warn("[DataSyncStep] Sync failed, continuing anyway");
        setStatus('skipped');
      }

      // Auto-advance quickly (100ms for visual feedback)
      setTimeout(() => {
        onAction({ type: "NAVIGATE_NEXT" });
      }, AUTO_ADVANCE_DELAY_MS);
    }

    syncData();
  }, [context.userId, onAction]);

  // Determine icon and colors based on status
  const getIconAndColors = () => {
    switch (status) {
      case 'success':
      case 'skipped':
        return {
          icon: <CheckmarkIcon />,
          gradient: 'from-green-500 to-emerald-600',
        };
      default:
        return {
          icon: <SpinnerIcon />,
          gradient: 'from-blue-500 to-purple-600',
        };
    }
  };

  const { icon, gradient } = getIconAndColors();

  return (
    <div className="text-center">
      {/* Icon with gradient background */}
      <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${gradient} rounded-full mb-4 shadow-lg`}>
        {icon}
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {status === 'syncing' ? 'Syncing Your Data' : 'Ready'}
      </h2>

      {/* Status message */}
      <p className="text-gray-600 text-sm">
        Preparing for the next step...
      </p>
    </div>
  );
}

// =============================================================================
// STEP DEFINITION & REGISTRATION
// =============================================================================

/**
 * Complete step definition for the data sync step.
 */
const DataSyncStep: OnboardingStep = {
  meta,
  Content: DataSyncContent,
};

export default DataSyncStep;
