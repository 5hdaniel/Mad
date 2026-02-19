/**
 * AccountVerificationStep - User Verification Checkpoint
 *
 * This step runs AFTER secure-storage and BEFORE email-connect.
 * It verifies that the user exists in the local SQLite database,
 * creating them if necessary via the existing initializeSecureStorage handler.
 *
 * Features:
 * - Auto-retry on failure (max 3 attempts, 1.5s delay between)
 * - Shows error with "Contact Support" option after max retries
 * - Auto-advances on success
 *
 * Platform: macOS, Windows, Linux (all platforms)
 *
 * @module onboarding/steps/AccountVerificationStep
 */

import React, { useState, useEffect, useRef } from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";
import type { UserVerifiedInLocalDbAction } from "../types/actions";
import logger from '../../../utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

// =============================================================================
// STEP METADATA
// =============================================================================

/**
 * Step metadata for the account verification step.
 * Shows after secure-storage (DB init done), before email-connect.
 */
export const meta: OnboardingStepMeta = {
  id: "account-verification",
  progressLabel: "Account Setup",
  platforms: ["macos", "windows", "linux"],
  navigation: {
    showBack: false,
    hideContinue: true, // Auto-advances, no button needed
  },
  // This step cannot be skipped
  skip: undefined,
  // Show only if DB is initialized but user not yet verified in local DB
  shouldShow: (context) => {
    const shouldShow = context.isDatabaseInitialized && !context.isUserVerifiedInLocalDb;
    logger.debug(
      `%c[STEP] account-verification: ${shouldShow ? 'SHOW' : 'HIDE'}`,
      `background: ${shouldShow ? '#DAA520' : '#228B22'}; color: white; font-weight: bold; padding: 2px 8px;`,
      { isDatabaseInitialized: context.isDatabaseInitialized, isUserVerifiedInLocalDb: context.isUserVerifiedInLocalDb }
    );
    return shouldShow;
  },
};

// =============================================================================
// ICONS
// =============================================================================

/**
 * Spinner icon for loading state
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
 * Checkmark icon for success state
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

/**
 * Error icon for failure state
 */
function ErrorIcon(): React.ReactElement {
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
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

type VerificationStatus = 'verifying' | 'success' | 'error';

/**
 * Content component for the account verification step.
 * Automatically verifies the user exists in local DB and advances.
 */
export function AccountVerificationContent({
  onAction,
}: OnboardingStepContentProps): React.ReactElement {
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effect safety pattern: ref guard prevents double-execution
  const hasStartedRef = useRef(false);

  const verify = async (attempt: number) => {
    setStatus('verifying');
    setErrorMessage(null);

    try {
      // Use dedicated handler that ensures user exists in local DB
      const result = await window.api.system.verifyUserInLocalDb();

      if (result.success) {
        setStatus('success');
        // Dispatch action to update context
        const action: UserVerifiedInLocalDbAction = {
          type: 'USER_VERIFIED_IN_LOCAL_DB',
        };
        onAction(action);
        // Note: The step will be filtered out after context updates,
        // causing automatic advancement to the next step
      } else {
        // Auto-retry if under limit
        if (attempt < MAX_RETRIES) {
          setRetryCount(attempt + 1);
          // Automatic retry after delay
          setTimeout(() => verify(attempt + 1), RETRY_DELAY_MS);
        } else {
          // Max retries reached - show error
          setStatus('error');
          setErrorMessage('Unable to set up your account. Please contact support.');
        }
      }
    } catch (error) {
      logger.error('[AccountVerificationStep] Verification failed:', error);
      // Auto-retry on exception
      if (attempt < MAX_RETRIES) {
        setRetryCount(attempt + 1);
        setTimeout(() => verify(attempt + 1), RETRY_DELAY_MS);
      } else {
        setStatus('error');
        setErrorMessage(
          error instanceof Error
            ? `Setup failed: ${error.message}`
            : 'Unable to set up your account. Please contact support.'
        );
      }
    }
  };

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      verify(0);
    }
  }, []);

  const handleRetry = () => {
    // Reset retry count and start fresh verification
    // Note: hasStartedRef is only for preventing double-execution in useEffect,
    // manual retries should always execute regardless
    setRetryCount(0);
    verify(0);
  };

  const handleContactSupport = () => {
    // Open support email
    window.open('mailto:support@magicaudit.com?subject=Account%20Setup%20Issue', '_blank');
  };

  // Determine icon and colors based on status
  const getIconAndColors = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckmarkIcon />,
          gradient: 'from-green-500 to-emerald-600',
        };
      case 'error':
        return {
          icon: <ErrorIcon />,
          gradient: 'from-red-500 to-rose-600',
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
        {status === 'verifying' && 'Setting up your account...'}
        {status === 'success' && 'Account ready!'}
        {status === 'error' && 'Setup failed'}
      </h2>

      {/* Status message */}
      <p className="text-gray-600 text-sm mb-5">
        {status === 'verifying' && (
          retryCount > 0
            ? `Retrying... (attempt ${retryCount + 1} of ${MAX_RETRIES + 1})`
            : 'Preparing your local database'
        )}
        {status === 'success' && 'Continuing to email setup...'}
        {status === 'error' && errorMessage}
      </p>

      {/* Error actions */}
      {status === 'error' && (
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleContactSupport}
            className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Contact Support
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STEP DEFINITION & REGISTRATION
// =============================================================================

/**
 * Complete step definition for the account verification step.
 */
const AccountVerificationStep: OnboardingStep = {
  meta,
  Content: AccountVerificationContent,
};

export default AccountVerificationStep;
