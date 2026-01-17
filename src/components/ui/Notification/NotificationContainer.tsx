/**
 * NotificationContainer Component
 * Container for stacking multiple notifications at bottom-right of screen
 */
import React from "react";
import { NotificationToast } from "./NotificationToast";
import type { Notification } from "./types";

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

/**
 * NotificationContainer - Renders stacked notifications
 * Positioned fixed at bottom-right with proper z-index layering
 */
export function NotificationContainer({
  notifications,
  onDismiss,
}: NotificationContainerProps): React.ReactElement | null {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      data-testid="notification-container"
    >
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

export default NotificationContainer;
