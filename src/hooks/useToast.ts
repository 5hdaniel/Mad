/**
 * Toast notification hook
 * Simple toast system for displaying success/error messages
 */
import { useState, useCallback, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

/**
 * Custom hook for managing toast notifications
 * @param autoDismissMs - Time in ms before toasts auto-dismiss (default: 5000)
 * @returns Toast state and handler functions
 */
export function useToast(autoDismissMs = 5000): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info"): void => {
      const id = `toast-${nextIdRef.current++}`;
      const newToast: Toast = { id, message, type };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after specified time
      if (autoDismissMs > 0) {
        setTimeout(() => {
          removeToast(id);
        }, autoDismissMs);
      }
    },
    [autoDismissMs, removeToast]
  );

  const showSuccess = useCallback(
    (message: string): void => {
      showToast(message, "success");
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string): void => {
      showToast(message, "error");
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string): void => {
      showToast(message, "warning");
    },
    [showToast]
  );

  const clearAll = useCallback((): void => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    removeToast,
    clearAll,
  };
}
