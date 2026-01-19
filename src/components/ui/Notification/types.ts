/**
 * Notification Types
 * TypeScript interfaces for the unified notification system
 */

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationOptions {
  /** Auto-dismiss duration in milliseconds (default: 3000, 0 = persistent) */
  duration?: number;
  /** Equivalent to duration: 0 - notification won't auto-dismiss */
  persistent?: boolean;
  /** Optional action button */
  action?: NotificationAction;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
  action?: NotificationAction;
}

export interface NotifyMethods {
  success: (message: string, options?: NotificationOptions) => void;
  error: (message: string, options?: NotificationOptions) => void;
  warning: (message: string, options?: NotificationOptions) => void;
  info: (message: string, options?: NotificationOptions) => void;
}

export interface NotificationContextValue {
  notify: NotifyMethods;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}
