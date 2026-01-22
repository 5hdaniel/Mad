/**
 * Optional Machine State Hook
 *
 * Provides access to the state machine context when available and enabled.
 * Returns null when the feature flag is disabled or when not within a provider.
 *
 * This hook enables gradual migration - existing hooks can optionally derive
 * state from the state machine without breaking when the feature is disabled.
 *
 * @module appCore/state/machine/hooks/useOptionalMachineState
 */

import { useContext } from "react";
import { AppStateContext } from "../AppStateContext";
import { isNewStateMachineEnabled } from "../utils/featureFlags";
import type { AppStateContextValue } from "../types";

/**
 * Returns state machine context if available and feature flag enabled.
 * Returns null if feature flag disabled or not within provider.
 *
 * This enables gradual migration - hooks can use this to optionally
 * derive state from the state machine.
 *
 * @returns AppStateContextValue when enabled and available, null otherwise
 *
 * @example
 * ```tsx
 * function useDatabaseStatus() {
 *   const machineState = useOptionalMachineState();
 *
 *   // Fall back to legacy behavior if state machine is not available
 *   if (!machineState) {
 *     return useLegacyDatabaseStatus();
 *   }
 *
 *   // Use state machine state
 *   return selectIsDatabaseInitialized(machineState.state);
 * }
 * ```
 */
export function useOptionalMachineState(): AppStateContextValue | null {
  const context = useContext(AppStateContext);

  // Check feature flag using the centralized utility
  if (!isNewStateMachineEnabled()) {
    return null;
  }

  // Return context (may be null if not within provider)
  return context;
}
