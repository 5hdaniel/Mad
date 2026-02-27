/**
 * useDeepLinkAuth Hook
 *
 * Handles deep link authentication callbacks from browser-based OAuth flow.
 * Listens for keepr://callback URLs and forwards tokens to the app.
 *
 * TASK-1500: Desktop deep link handler for browser auth flow.
 *
 * @module hooks/useDeepLinkAuth
 */

import { useEffect, useCallback, useRef } from "react";

/**
 * Auth callback data received from deep link
 */
interface DeepLinkAuthData {
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth error data received from deep link
 * TASK-1507: Added INVALID_TOKENS and UNKNOWN_ERROR codes
 */
interface DeepLinkAuthError {
  error: string;
  code: "MISSING_TOKENS" | "INVALID_URL" | "INVALID_TOKENS" | "UNKNOWN_ERROR";
}

interface UseDeepLinkAuthOptions {
  /**
   * Called when valid tokens are received via deep link
   */
  onSuccess: (data: DeepLinkAuthData) => void;

  /**
   * Called when deep link callback fails (invalid URL, missing tokens)
   */
  onError?: (error: DeepLinkAuthError) => void;

  /**
   * Whether to enable the listener (default: true)
   * Useful for disabling during certain app states
   */
  enabled?: boolean;
}

/**
 * Hook for handling deep link authentication callbacks.
 *
 * Automatically subscribes to deep link events when mounted and
 * cleans up when unmounted.
 *
 * @example
 * ```tsx
 * useDeepLinkAuth({
 *   onSuccess: async ({ accessToken, refreshToken }) => {
 *     // Handle successful auth - validate and store tokens
 *     await handleAuthTokens(accessToken, refreshToken);
 *   },
 *   onError: (error) => {
 *     // Handle error - show message to user
 *     console.error('Auth failed:', error.code, error.error);
 *   }
 * });
 * ```
 */
export function useDeepLinkAuth({
  onSuccess,
  onError,
  enabled = true,
}: UseDeepLinkAuthOptions): void {
  // Use refs to avoid re-subscribing on callback changes
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Stable callback handlers
  const handleSuccess = useCallback((data: DeepLinkAuthData) => {
    onSuccessRef.current(data);
  }, []);

  const handleError = useCallback((error: DeepLinkAuthError) => {
    onErrorRef.current?.(error);
  }, []);

  // Subscribe to deep link events
  useEffect(() => {
    if (!enabled) return;

    // Check if API is available (running in Electron)
    if (!window.api?.onDeepLinkAuthCallback || !window.api?.onDeepLinkAuthError) {
      // Not running in Electron or API not available - silently skip
      return;
    }

    // Subscribe to success events
    const unsubscribeSuccess = window.api.onDeepLinkAuthCallback(handleSuccess);

    // Subscribe to error events
    const unsubscribeError = window.api.onDeepLinkAuthError(handleError);

    // Cleanup on unmount
    return () => {
      unsubscribeSuccess?.();
      unsubscribeError?.();
    };
  }, [enabled, handleSuccess, handleError]);
}

export default useDeepLinkAuth;
