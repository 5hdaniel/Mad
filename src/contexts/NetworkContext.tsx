/**
 * Network Context
 * Monitors network connectivity and provides offline detection for the app.
 *
 * Features:
 * - Detects online/offline browser events
 * - Provides network status to all components
 * - Tracks when the app went offline
 * - Allows manual retry of network operations
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import logger from '../utils/logger';

interface NetworkState {
  isOnline: boolean;
  isChecking: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  connectionError: string | null;
}

interface NetworkContextValue extends NetworkState {
  checkConnection: () => Promise<boolean>;
  clearError: () => void;
  setConnectionError: (error: string | null) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [state, setState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    isChecking: false,
    lastOnlineAt: navigator.onLine ? new Date() : null,
    lastOfflineAt: navigator.onLine ? null : new Date(),
    connectionError: null,
  });

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
        lastOnlineAt: new Date(),
        connectionError: null,
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
        lastOfflineAt: new Date(),
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check connection by attempting a lightweight network request
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isChecking: true }));

    try {
      // Try to check if we can reach the internet
      // This is a simple check - in a real scenario you might ping your own server
      const online = navigator.onLine;

      setState((prev) => ({
        ...prev,
        isOnline: online,
        isChecking: false,
        lastOnlineAt: online ? new Date() : prev.lastOnlineAt,
        connectionError: online ? null : "No internet connection",
      }));

      return online;
    } catch (error) {
      logger.error("[NetworkContext] Connection check failed:", error);
      setState((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        connectionError: "Failed to check network connection",
      }));
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, connectionError: null }));
  }, []);

  const setConnectionError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, connectionError: error }));
  }, []);

  // DEV ONLY: Force offline state for testing
  const forceOffline = useCallback((offline: boolean) => {
    setState((prev) => ({
      ...prev,
      isOnline: !offline,
      lastOfflineAt: offline ? new Date() : prev.lastOfflineAt,
      lastOnlineAt: !offline ? new Date() : prev.lastOnlineAt,
    }));
  }, []);

  // State for triggering test crash (dev only)
  const [shouldCrash, setShouldCrash] = useState(false);

  // Expose forceOffline in dev mode for console testing
  useEffect(() => {
    const win = window as Window & {
      isPackaged?: boolean;
      __testOffline?: (offline: boolean) => void;
      __testCrash?: () => void;
    };
    if (process.env.NODE_ENV === "development") {
      win.__testOffline = forceOffline;
      win.__testCrash = () => setShouldCrash(true);
      // Dev helpers available: window.__testOffline(true/false), window.__testCrash()
    }
    return () => {
      delete win.__testOffline;
      delete win.__testCrash;
    };
  }, [forceOffline]);

  // Throw error during render to trigger ErrorBoundary
  if (shouldCrash) {
    throw new Error(
      "Test crash triggered via window.__testCrash() - This is a simulated error for testing the error boundary UI",
    );
  }

  const value: NetworkContextValue = {
    ...state,
    checkConnection,
    clearError,
    setConnectionError,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

export default NetworkContext;
