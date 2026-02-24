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

/** Polling interval: 60 seconds */
const POLL_INTERVAL_MS = 60_000;

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

    try {
      const result = await window.api.auth.validateRemoteSession();
      if (!result.valid && !isLoggingOut.current) {
        isLoggingOut.current = true;
        logger.info(
          "[SessionValidator] Remote session invalidated, triggering logout"
        );

        // Show notification before logout
        window.alert(
          "Your session was ended from another device. Please sign in again."
        );

        await onSessionInvalidated();
      }
    } catch {
      // Network or IPC error -- skip this check, don't logout
      logger.debug(
        "[SessionValidator] Validation check failed (network/IPC error), skipping"
      );
    }
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
