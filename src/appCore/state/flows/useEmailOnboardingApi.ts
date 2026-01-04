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
 * ## Migration Status
 *
 * This hook supports two execution paths:
 * 1. **State Machine Path** (new): When feature flag enabled, derives state
 *    from the state machine. Values are read-only; setters are no-ops.
 * 2. **Legacy Path** (existing): Original implementation with local state.
 *
 * The state machine path uses `useOptionalMachineState()` to check if
 * the feature flag is enabled and returns early with derived values.
 */

import { useState, useEffect, useCallback } from "react";
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
  userId,
}: UseEmailOnboardingApiOptions): UseEmailOnboardingApiReturn {
  // ============================================
  // STATE MACHINE PATH
  // ============================================
  // Check if state machine is enabled and available.
  // If so, derive all values from state machine and return early.
  const machineState = useOptionalMachineState();

  if (machineState) {
    const { state, dispatch } = machineState;

    // Derive hasCompletedEmailOnboarding from state machine
    const hasCompletedEmailOnboarding = selectHasCompletedEmailOnboarding(state);

    // Derive hasEmailConnected from state machine
    const hasEmailConnected = selectHasEmailConnected(state);

    // Loading if we're in loading phase before user data
    const isCheckingEmailOnboarding =
      state.status === "loading" &&
      ["checking-storage", "initializing-db", "loading-auth", "loading-user-data"].includes(
        state.phase
      );

    // Setters are no-ops in state machine mode - state machine is source of truth
    const setHasCompletedEmailOnboarding = useCallback((_completed: boolean) => {
      // No-op in state machine mode
    }, []);

    const setHasEmailConnected = useCallback((_connected: boolean) => {
      // No-op in state machine mode
    }, []);

    // completeEmailOnboarding persists to API and dispatches onboarding step complete
    const completeEmailOnboarding = useCallback(async (): Promise<void> => {
      // userId comes from state machine in this path
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

  // ============================================
  // LEGACY PATH
  // ============================================
  // Original implementation with local state management.
  // Used when state machine feature flag is disabled.

  const [hasCompletedEmailOnboarding, setHasCompletedEmailOnboarding] =
    useState<boolean>(true); // Default true to avoid flicker
  const [hasEmailConnected, setHasEmailConnected] = useState<boolean>(true); // Default true to avoid flicker
  const [isCheckingEmailOnboarding, setIsCheckingEmailOnboarding] =
    useState<boolean>(true);

  // Check if user has completed email onboarding and has email connected
  useEffect(() => {
    const checkEmailStatus = async () => {
      if (userId) {
        setIsCheckingEmailOnboarding(true);
        try {
          // Check onboarding status
          const authApi = window.api.auth as typeof window.api.auth & {
            checkEmailOnboarding: (userId: string) => Promise<{
              success: boolean;
              completed: boolean;
              error?: string;
            }>;
          };
          const onboardingResult = await authApi.checkEmailOnboarding(userId);
          if (onboardingResult.success) {
            setHasCompletedEmailOnboarding(onboardingResult.completed);
          }

          // Check if any email is connected
          const connectionResult =
            await window.api.system.checkAllConnections(userId);
          if (connectionResult.success) {
            const hasConnection =
              connectionResult.google?.connected === true ||
              connectionResult.microsoft?.connected === true;
            setHasEmailConnected(hasConnection);
          }
        } catch (error) {
          console.error(
            "[useEmailOnboardingApi] Failed to check email status:",
            error,
          );
        } finally {
          setIsCheckingEmailOnboarding(false);
        }
      } else {
        // No user logged in - keep checking true to prevent premature routing
        // Routing should only happen after we've loaded user data
      }
    };
    checkEmailStatus();
  }, [userId]);

  // Mark email onboarding as completed in database
  const completeEmailOnboarding = async () => {
    if (userId) {
      try {
        const authApi = window.api.auth as typeof window.api.auth & {
          completeEmailOnboarding: (
            userId: string,
          ) => Promise<{ success: boolean; error?: string }>;
        };
        await authApi.completeEmailOnboarding(userId);
        setHasCompletedEmailOnboarding(true);
      } catch (error) {
        console.error(
          "[useEmailOnboardingApi] Failed to complete email onboarding:",
          error,
        );
      }
    }
  };

  return {
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,
    setHasCompletedEmailOnboarding,
    setHasEmailConnected,
    completeEmailOnboarding,
  };
}
