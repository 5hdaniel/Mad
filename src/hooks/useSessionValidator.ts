/**
 * useSessionValidator Hook
 * TASK-2062: Polls remote session validity every 60 seconds.
 * If the session has been invalidated remotely (e.g., by "Sign Out All Devices"
 * from another device or the broker portal), triggers logout with an explanation.
 *
 * Safety:
 * - Only polls when online and app is in the foreground (visible)
 * - Network errors do NOT trigger logout (the IPC handler returns valid: true)
 * - Uses 60-second interval to avoid excessive Supabase API calls
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import logger from "../utils/logger";
import { syncStateRef, setDeferredLogoutCallback } from "./useIPhoneSync";

/** Polling interval: 60 seconds */
const POLL_INTERVAL_MS = 60_000;

/** TASK-2114: Retry constants for network resilience */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

/** Simple delay helper */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface UseSessionValidatorOptions {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Callback to trigger logout when session is invalidated */
  onSessionInvalidated: () => Promise<void>;
}

/**
 * Hook that monitors remote session validity via periodic polling.
 * When the session is found to be invalid, calls onSessionInvalidated.
 */
export function useSessionValidator({
  isAuthenticated,
  onSessionInvalidated,
}: UseSessionValidatorOptions): void {
  const { isOnline } = useNetwork();
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const isLoggingOut = useRef(false);

  // Track document visibility
  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const checkSession = useCallback(async () => {
    if (isLoggingOut.current) return;

    // TASK-2114: Retry loop for network resilience.
    // When the network source changes (e.g., iPhone tethering), the Supabase
    // getUser() call may transiently fail, returning { valid: false }.
    // We retry up to MAX_RETRIES times with a delay before treating it as
    // a genuine session invalidation.
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (isLoggingOut.current) return;

      try {
        const result = await window.api.auth.validateRemoteSession();

        if (result.valid) {
          // Session is valid -- nothing to do
          return;
        }

        // Session reported as invalid. If we have retries left, wait and retry
        // (the invalidation could be caused by a transient network change).
        if (attempt < MAX_RETRIES) {
          logger.info(
            `[SessionValidator] Validation failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s...`
          );
          await delay(RETRY_DELAY_MS);
          continue;
        }

        // All retries exhausted -- session is genuinely invalid
        if (isLoggingOut.current) return;

        // TASK-2109: Defer logout if iPhone sync is active
        if (syncStateRef.isActive) {
          syncStateRef.deferredLogout = true;
          logger.info(
            "[SessionValidator] Remote session invalidated, but iPhone sync is active. Deferring logout until sync completes."
          );
          return;
        }

        isLoggingOut.current = true;
        logger.info(
          "[SessionValidator] Remote session invalidated, triggering logout"
        );

        // Show notification before logout
        window.alert(
          "Your session was ended from another device. Please sign in again."
        );

        await onSessionInvalidated();
        return;
      } catch {
        // Network or IPC error -- skip this check entirely, don't logout
        logger.debug(
          "[SessionValidator] Validation check failed (network/IPC error), skipping"
        );
        return;
      }
    }
  }, [onSessionInvalidated]);

  // TASK-2109: Register the deferred logout callback so useIPhoneSync can trigger it
  useEffect(() => {
    setDeferredLogoutCallback(async () => {
      if (isLoggingOut.current) return;
      isLoggingOut.current = true;
      logger.info(
        "[SessionValidator] Executing deferred logout after sync completed"
      );
      window.alert(
        "Your session was ended from another device. Please sign in again."
      );
      await onSessionInvalidated();
    });
    return () => setDeferredLogoutCallback(null);
  }, [onSessionInvalidated]);

  useEffect(() => {
    // Only poll when authenticated, online, and app is visible
    if (!isAuthenticated || !isOnline || !isVisible) return;

    // Run an initial check after a short delay (give the app time to settle)
    const initialTimeout = setTimeout(checkSession, 5000);

    // Then poll at the regular interval
    const interval = setInterval(checkSession, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isAuthenticated, isOnline, isVisible, checkSession]);
}
