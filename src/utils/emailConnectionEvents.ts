/**
 * Email Connection Events Utility
 *
 * Provides a centralized event-based mechanism for propagating email connection
 * state changes across components. This solves the issue where Settings, Dashboard,
 * and other components need to react immediately when email connection state changes.
 *
 * TASK-1730: Fix email connection state propagation
 *
 * Usage:
 * - Call emitEmailConnectionChanged() after OAuth success or disconnect
 * - Use useEmailConnectionListener() hook to subscribe to changes
 *
 * @module utils/emailConnectionEvents
 */

import { useEffect, useCallback } from "react";

// Event name constant for type safety and consistency
export const EMAIL_CONNECTION_CHANGED = "email-connection-changed";

/**
 * Email connection event detail interface.
 * Describes the payload of an email connection change event.
 */
export interface EmailConnectionEventDetail {
  /** Whether email is now connected */
  connected: boolean;
  /** The email address (only present when connected) */
  email?: string;
  /** The email provider */
  provider?: "google" | "microsoft";
}

/**
 * Emit an email connection change event.
 * Call this after successful OAuth completion or after disconnection.
 *
 * @param detail - The event details
 *
 * @example
 * // After successful OAuth
 * emitEmailConnectionChanged({ connected: true, email: "user@gmail.com", provider: "google" });
 *
 * @example
 * // After disconnection
 * emitEmailConnectionChanged({ connected: false, provider: "google" });
 */
export function emitEmailConnectionChanged(
  detail: EmailConnectionEventDetail
): void {
  window.dispatchEvent(
    new CustomEvent<EmailConnectionEventDetail>(EMAIL_CONNECTION_CHANGED, {
      detail,
    })
  );
}

/**
 * React hook to listen for email connection changes.
 * Automatically handles cleanup on unmount.
 *
 * @param callback - Function to call when email connection state changes
 *
 * @example
 * useEmailConnectionListener(useCallback((event) => {
 *   if (event.connected) {
 *     // Email was connected - refresh state
 *     refetchConnectionStatus();
 *   } else {
 *     // Email was disconnected - update UI
 *     setEmailStatus(null);
 *   }
 * }, []));
 */
export function useEmailConnectionListener(
  callback: (detail: EmailConnectionEventDetail) => void
): void {
  // Memoize the actual event handler
  const handleEvent = useCallback(
    (event: Event) => {
      const customEvent = event as CustomEvent<EmailConnectionEventDetail>;
      callback(customEvent.detail);
    },
    [callback]
  );

  useEffect(() => {
    window.addEventListener(EMAIL_CONNECTION_CHANGED, handleEvent);
    return () => {
      window.removeEventListener(EMAIL_CONNECTION_CHANGED, handleEvent);
    };
  }, [handleEvent]);
}
