/**
 * useReconnectionSummary
 * TASK-2058: Shows a summary notification when the app transitions
 * from offline to online and there are unacknowledged failures.
 */

import { useEffect, useRef } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useNotification } from "./useNotification";

/**
 * Hook that monitors online/offline transitions and shows a
 * reconnection summary when failures occurred while offline.
 */
export function useReconnectionSummary(): void {
  const { isOnline } = useNetwork();
  const { notify } = useNotification();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      // Check for unacknowledged failures
      window.api.failureLog
        ?.getCount()
        .then((result: { success: boolean; count: number }) => {
          if (result.success && result.count > 0) {
            notify.warning(
              `While offline, ${result.count} operation(s) failed. View details in Settings > Data & Privacy.`
            );
            // Mark as acknowledged after showing summary
            window.api.failureLog?.acknowledgeAll();
          }
        })
        .catch(() => {
          // Non-critical -- silently ignore
        });
    }
  }, [isOnline, notify]);
}
