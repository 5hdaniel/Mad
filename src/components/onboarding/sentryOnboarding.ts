/**
 * Sentry instrumentation utilities for onboarding failure paths.
 *
 * Provides classified failure reporting to Sentry when users encounter
 * errors during the onboarding flow. No PII is included in any events.
 *
 * @module onboarding/sentryOnboarding
 */

import * as Sentry from '@sentry/electron/renderer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Classified reasons for onboarding failures.
 */
export type OnboardingFailureReason =
  | 'db_failed'
  | 'network_error'
  | 'auth_failed'
  | 'session_invalid'
  | 'driver_install_failed'
  | 'driver_cancelled'
  | 'unknown';

/**
 * Context available at the point of failure for classification.
 */
export interface FailureClassificationContext {
  dbInitialized: boolean;
  networkOnline: boolean;
  error?: unknown;
}

/**
 * Parameters for reporting an onboarding failure to Sentry.
 */
export interface OnboardingFailureReport {
  step: string;
  reason: OnboardingFailureReason;
  dbInitialized: boolean;
  networkOnline: boolean;
  hasSession: boolean;
  errorMessage?: string;
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * Classifies the root cause of an onboarding failure based on available context.
 *
 * Priority order:
 * 1. Database not initialized -> db_failed
 * 2. Network offline -> network_error
 * 3. Error message contains auth-related keywords -> auth_failed
 * 4. Error message contains session-related keywords -> session_invalid
 * 5. Everything else -> unknown
 */
export function classifyFailureReason(
  context: FailureClassificationContext
): OnboardingFailureReason {
  if (!context.dbInitialized) {
    return 'db_failed';
  }

  if (!context.networkOnline) {
    return 'network_error';
  }

  if (context.error) {
    const message =
      context.error instanceof Error
        ? context.error.message.toLowerCase()
        : String(context.error).toLowerCase();

    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('login')
    ) {
      return 'auth_failed';
    }

    if (
      message.includes('session') ||
      message.includes('token') ||
      message.includes('expired')
    ) {
      return 'session_invalid';
    }
  }

  return 'unknown';
}

// =============================================================================
// SENTRY REPORTING
// =============================================================================

/**
 * Reports an onboarding failure to Sentry with classified reason and context.
 *
 * This function should be called exactly once per failure occurrence
 * (not on every render). Use a ref or state guard to prevent duplicate reports.
 *
 * No PII is included: no emails, names, or token values.
 */
export function reportOnboardingFailure(report: OnboardingFailureReport): void {
  Sentry.captureMessage('Onboarding failure: account setup failed', {
    level: 'error',
    tags: {
      component: 'onboarding',
      step: report.step,
      failure_reason: report.reason,
    },
    extra: {
      db_initialized: report.dbInitialized,
      network_online: report.networkOnline,
      has_session: report.hasSession,
      ...(report.errorMessage ? { error_message: report.errorMessage } : {}),
    },
  });
}
