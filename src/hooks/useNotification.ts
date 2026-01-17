/**
 * useNotification Hook
 * Provides access to the unified notification system
 *
 * Usage:
 *   const { notify, dismiss, dismissAll } = useNotification();
 *   notify.success("Transaction saved successfully");
 *   notify.error("Failed to connect to email provider");
 *   notify.warning("Sync may take longer than usual");
 *   notify.info("New messages detected");
 *
 *   // With options
 *   notify.success("Saved", { duration: 5000 });
 *   notify.error("Connection lost", { persistent: true });
 *   notify.info("Update available", {
 *     action: {
 *       label: "Refresh",
 *       onClick: () => window.location.reload()
 *     }
 *   });
 */
import { useContext } from "react";
import { NotificationContext } from "../contexts/NotificationContext";
import type { NotificationContextValue } from "../components/ui/Notification/types";

/**
 * Custom hook to use notification context
 * Throws if used outside of NotificationProvider
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (context === null) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
}

export default useNotification;
