/**
 * Feature Flag Components
 *
 * Provides conditional rendering based on the new state machine feature flag.
 * Used to wrap the new state machine provider for gradual rollout.
 *
 * @module appCore/state/machine/FeatureFlag
 */

import React, { useState } from "react";
import {
  isNewStateMachineEnabled,
  getFeatureFlagStatus,
  enableNewStateMachine,
  disableNewStateMachine,
} from "./utils/featureFlags";
import { AppStateProvider } from "./AppStateContext";

interface FeatureFlaggedProviderProps {
  children: React.ReactNode;
  /** Fallback when new state machine is disabled */
  fallback?: React.ReactNode;
}

/**
 * Wraps children with new state machine if enabled.
 * Falls back to children without wrapper if disabled.
 *
 * The flag is checked once on mount (not reactive) to avoid
 * confusion from mid-session changes.
 *
 * @example
 * ```tsx
 * <FeatureFlaggedProvider fallback={<LegacyApp />}>
 *   <NewApp />
 * </FeatureFlaggedProvider>
 * ```
 */
export function FeatureFlaggedProvider({
  children,
  fallback,
}: FeatureFlaggedProviderProps) {
  // Check flag once on mount (don't re-check on every render)
  const [isEnabled] = useState(() => isNewStateMachineEnabled());

  if (!isEnabled) {
    // Return fallback or just children (existing hooks will work)
    return <>{fallback ?? children}</>;
  }

  // New state machine enabled
  return <AppStateProvider>{children}</AppStateProvider>;
}

/**
 * Development helper component that shows current feature flag state.
 * Only renders in development mode.
 *
 * Provides visual indicator and toggle button for quick testing.
 */
export function StateMachineDebugPanel() {
  const [status, setStatus] = useState(() => getFeatureFlagStatus());

  // Only render in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleToggle = () => {
    if (status.value) {
      disableNewStateMachine(true);
    } else {
      enableNewStateMachine(true);
    }
    // Update local state (though page will reload)
    setStatus(getFeatureFlagStatus());
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        padding: "8px 12px",
        background: status.value ? "#10b981" : "#ef4444",
        color: "white",
        borderRadius: 4,
        fontSize: 12,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "monospace",
      }}
    >
      <span>
        State Machine: {status.value ? "ON" : "OFF"} ({status.source})
      </span>
      <button
        onClick={handleToggle}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.5)",
          color: "white",
          borderRadius: 3,
          padding: "2px 6px",
          cursor: "pointer",
          fontSize: 11,
        }}
      >
        Toggle
      </button>
    </div>
  );
}

/**
 * Hook to check if new state machine is enabled.
 * Captures the value once on first call (not reactive).
 *
 * @returns true if new state machine is enabled
 */
export function useNewStateMachine(): boolean {
  const [isEnabled] = useState(() => isNewStateMachineEnabled());
  return isEnabled;
}
