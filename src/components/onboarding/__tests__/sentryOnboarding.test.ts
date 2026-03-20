/**
 * Tests for sentryOnboarding utility (TASK-2281)
 *
 * Covers:
 * - classifyFailureReason returns correct reason for each error type
 * - reportOnboardingFailure calls Sentry.captureMessage with correct tags
 * - No PII in Sentry event payload
 *
 * @module onboarding/__tests__/sentryOnboarding.test
 */

import {
  classifyFailureReason,
  reportOnboardingFailure,
} from '../sentryOnboarding';

// Mock Sentry
const mockCaptureMessage = jest.fn();
jest.mock('@sentry/electron/renderer', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

describe('sentryOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // classifyFailureReason
  // =========================================================================

  describe('classifyFailureReason', () => {
    it('returns db_failed when database is not initialized', () => {
      const result = classifyFailureReason({
        dbInitialized: false,
        networkOnline: true,
      });
      expect(result).toBe('db_failed');
    });

    it('returns db_failed when both db and network are down (db takes priority)', () => {
      const result = classifyFailureReason({
        dbInitialized: false,
        networkOnline: false,
      });
      expect(result).toBe('db_failed');
    });

    it('returns network_error when network is offline', () => {
      const result = classifyFailureReason({
        dbInitialized: true,
        networkOnline: false,
      });
      expect(result).toBe('network_error');
    });

    it('returns auth_failed for auth-related errors', () => {
      const authErrors = [
        new Error('Authentication failed'),
        new Error('Unauthorized access'),
        new Error('Forbidden resource'),
        new Error('Login required'),
      ];

      for (const error of authErrors) {
        const result = classifyFailureReason({
          dbInitialized: true,
          networkOnline: true,
          error,
        });
        expect(result).toBe('auth_failed');
      }
    });

    it('returns session_invalid for session-related errors', () => {
      const sessionErrors = [
        new Error('Session expired'),
        new Error('Invalid token'),
        new Error('Token has expired'),
      ];

      for (const error of sessionErrors) {
        const result = classifyFailureReason({
          dbInitialized: true,
          networkOnline: true,
          error,
        });
        expect(result).toBe('session_invalid');
      }
    });

    it('returns unknown for unrecognized errors', () => {
      const result = classifyFailureReason({
        dbInitialized: true,
        networkOnline: true,
        error: new Error('Something went wrong'),
      });
      expect(result).toBe('unknown');
    });

    it('returns unknown when no error and both db and network are fine', () => {
      const result = classifyFailureReason({
        dbInitialized: true,
        networkOnline: true,
      });
      expect(result).toBe('unknown');
    });

    it('handles non-Error objects as errors', () => {
      const result = classifyFailureReason({
        dbInitialized: true,
        networkOnline: true,
        error: 'auth failure string',
      });
      expect(result).toBe('auth_failed');
    });
  });

  // =========================================================================
  // reportOnboardingFailure
  // =========================================================================

  describe('reportOnboardingFailure', () => {
    it('calls Sentry.captureMessage with correct message and level', () => {
      reportOnboardingFailure({
        step: 'account_verification',
        reason: 'db_failed',
        dbInitialized: false,
        networkOnline: true,
        hasSession: true,
      });

      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Onboarding failure: account setup failed',
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    it('includes correct tags', () => {
      reportOnboardingFailure({
        step: 'account_verification',
        reason: 'network_error',
        dbInitialized: true,
        networkOnline: false,
        hasSession: true,
      });

      const call = mockCaptureMessage.mock.calls[0];
      expect(call[1].tags).toEqual({
        component: 'onboarding',
        step: 'account_verification',
        failure_reason: 'network_error',
      });
    });

    it('includes correct extra context', () => {
      reportOnboardingFailure({
        step: 'apple_driver',
        reason: 'driver_install_failed',
        dbInitialized: true,
        networkOnline: true,
        hasSession: true,
        errorMessage: 'MSI installation failed',
      });

      const call = mockCaptureMessage.mock.calls[0];
      expect(call[1].extra).toEqual({
        db_initialized: true,
        network_online: true,
        has_session: true,
        error_message: 'MSI installation failed',
      });
    });

    it('omits error_message from extra when not provided', () => {
      reportOnboardingFailure({
        step: 'account_verification',
        reason: 'unknown',
        dbInitialized: true,
        networkOnline: true,
        hasSession: false,
      });

      const call = mockCaptureMessage.mock.calls[0];
      expect(call[1].extra).toEqual({
        db_initialized: true,
        network_online: true,
        has_session: false,
      });
      expect(call[1].extra).not.toHaveProperty('error_message');
    });

    it('does not include PII in any field', () => {
      reportOnboardingFailure({
        step: 'account_verification',
        reason: 'auth_failed',
        dbInitialized: true,
        networkOnline: true,
        hasSession: true,
        errorMessage: 'Auth check failed',
      });

      const call = mockCaptureMessage.mock.calls[0];
      const serialized = JSON.stringify(call);

      // Ensure no email-like patterns
      expect(serialized).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      // Ensure no JWT-like patterns
      expect(serialized).not.toMatch(/eyJ[a-zA-Z0-9_-]+\./);
    });

    it('uses different step names for different steps', () => {
      reportOnboardingFailure({
        step: 'apple_driver',
        reason: 'driver_cancelled',
        dbInitialized: true,
        networkOnline: true,
        hasSession: true,
      });

      const call = mockCaptureMessage.mock.calls[0];
      expect(call[1].tags.step).toBe('apple_driver');
      expect(call[1].tags.component).toBe('onboarding');
    });
  });
});
