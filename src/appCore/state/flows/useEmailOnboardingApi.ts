/**
 * useEmailOnboardingApi Hook
 *
 * Handles email onboarding status checks and completion.
 * Checks:
 * - Whether user has completed email onboarding
 * - Whether user has any email connected
 *
 * @module appCore/state/flows/useEmailOnboardingApi
 *
 * ## State Machine Integration
 *
 * This hook derives all state from the state machine.
 * Values are read-only; setters are no-ops (state machine is source of truth).
 *
 * Requires the state machine feature flag to be enabled.
 * If disabled, throws an error - legacy code paths have been removed.
 */

import { useCallback } from "react";
import {
  useOptionalMachineState,
  selectHasCompletedEmailOnboarding,
  selectHasEmailConnected,
} from "../machine";

interface UseEmailOnboardingApiOptions {
  userId: string | undefined;
}

interface UseEmailOnboardingApiReturn {
  hasCompletedEmailOnboarding: boolean;
  hasEmailConnected: boolean;
  isCheckingEmailOnboarding: boolean;
  setHasCompletedEmailOnboarding: (completed: boolean) => void;
  setHasEmailConnected: (connected: boolean) => void;
  completeEmailOnboarding: () => Promise<void>;
}

export function useEmailOnboardingApi({
  userId: _userId,
}: UseEmailOnboardingApiOptions): UseEmailOnboardingApiReturn {
  const machineState = useOptionalMachineState();

  if (!machineState) {
    throw new Error(
      "useEmailOnboardingApi requires state machine to be enabled. " +
        "Legacy code paths have been removed."
    );
  }

  const { state, dispatch } = machineState;

  // Derive hasCompletedEmailOnboarding from state machine
  const hasCompletedEmailOnboarding = selectHasCompletedEmailOnboarding(state);

  // Derive hasEmailConnected from state machine
  const hasEmailConnected = selectHasEmailConnected(state);

  // Loading if we're in loading phase before user data
  const isCheckingEmailOnboarding =
    state.status === "loading" &&
    [
      "checking-storage",
      "initializing-db",
      "loading-auth",
      "loading-user-data",
    ].includes(state.phase);

  // Setters are no-ops - state machine is source of truth
  const setHasCompletedEmailOnboarding = useCallback(
    (_completed: boolean) => {
      // No-op: state machine is source of truth
    },
    []
  );

  const setHasEmailConnected = useCallback((_connected: boolean) => {
    // No-op: state machine is source of truth
  }, []);

  // completeEmailOnboarding persists to API and dispatches onboarding step complete
  const completeEmailOnboarding = useCallback(async (): Promise<void> => {
    // userId comes from state machine
    const currentUserId =
      state.status === "ready" || state.status === "onboarding"
        ? state.user.id
        : null;

    if (!currentUserId) return;

    try {
      const authApi = window.api.auth as typeof window.api.auth & {
        completeEmailOnboarding: (
          userId: string
        ) => Promise<{ success: boolean; error?: string }>;
      };
      await authApi.completeEmailOnboarding(currentUserId);

      // Dispatch onboarding step complete
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "email-connect",
      });
    } catch (error) {
      console.error(
        "[useEmailOnboardingApi] Failed to complete email onboarding:",
        error
      );
    }
  }, [state, dispatch]);

  return {
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,
    setHasCompletedEmailOnboarding,
    setHasEmailConnected,
    completeEmailOnboarding,
  };
}
