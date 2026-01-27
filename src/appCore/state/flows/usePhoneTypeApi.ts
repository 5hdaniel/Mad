/**
 * usePhoneTypeApi Hook
 *
 * Handles phone type selection and persistence.
 * Checks:
 * - User's stored phone type from database
 * - Windows + iPhone driver setup requirements
 *
 * @module appCore/state/flows/usePhoneTypeApi
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
import type { PhoneType } from "../types";
import {
  useOptionalMachineState,
  selectHasSelectedPhoneType,
  selectPhoneType,
  selectIsDatabaseInitialized,
} from "../machine";

interface UsePhoneTypeApiOptions {
  userId: string | undefined;
  isWindows: boolean;
}

interface UsePhoneTypeApiReturn {
  hasSelectedPhoneType: boolean;
  selectedPhoneType: PhoneType;
  isLoadingPhoneType: boolean;
  needsDriverSetup: boolean;
  setHasSelectedPhoneType: (selected: boolean) => void;
  setSelectedPhoneType: (type: PhoneType) => void;
  setNeedsDriverSetup: (needs: boolean) => void;
  savePhoneType: (phoneType: "iphone" | "android") => Promise<boolean>;
}

export function usePhoneTypeApi({
  userId: _userId,
  isWindows: _isWindows,
}: UsePhoneTypeApiOptions): UsePhoneTypeApiReturn {
  const machineState = useOptionalMachineState();

  if (!machineState) {
    throw new Error(
      "usePhoneTypeApi requires state machine to be enabled. " +
        "Legacy code paths have been removed."
    );
  }

  const { state, dispatch } = machineState;

  // Derive hasSelectedPhoneType from state machine
  const hasSelectedPhoneType = selectHasSelectedPhoneType(state);

  // Loading if we're in loading phase before user data
  const isLoadingPhoneType =
    state.status === "loading" &&
    [
      "checking-storage",
      "initializing-db",
      "loading-auth",
      "loading-user-data",
    ].includes(state.phase);

  // Get phone type from state machine
  const selectedPhoneType = selectPhoneType(state);

  // Derive needsDriverSetup from state machine
  // When ready, it's in userData; when onboarding, derive from platform
  const needsDriverSetup =
    state.status === "ready"
      ? state.userData.needsDriverSetup
      : state.status === "onboarding" &&
        state.platform.isWindows &&
        state.platform.hasIPhone;

  // Setters are no-ops - state machine is source of truth
  const setHasSelectedPhoneType = useCallback((_selected: boolean) => {
    // No-op: state machine is source of truth
  }, []);

  const setSelectedPhoneType = useCallback((_type: PhoneType) => {
    // No-op: state machine is source of truth
  }, []);

  const setNeedsDriverSetup = useCallback((_needs: boolean) => {
    // No-op: state machine is source of truth
  }, []);

  // savePhoneType persists to API and dispatches onboarding step complete
  // If DB is not initialized (deferred for first-time macOS users), we skip
  // the DB save and just dispatch the step completion. The phone type will
  // be synced to DB after secure-storage step initializes it.
  const savePhoneType = useCallback(
    async (phoneType: "iphone" | "android"): Promise<boolean> => {
      // userId comes from state machine
      const currentUserId =
        state.status === "ready" || state.status === "onboarding"
          ? state.user.id
          : null;

      if (!currentUserId) return false;

      // Check if DB is initialized
      const isDbReady = selectIsDatabaseInitialized(state);

      if (!isDbReady) {
        // DB not ready (first-time macOS user with deferred init)
        // Just dispatch step completion - phone type stored in state machine
        // Will be synced to DB after secure-storage step initializes it
        console.log(
          "[usePhoneTypeApi] DB not initialized, queuing phone type in state:",
          phoneType
        );
        dispatch({
          type: "ONBOARDING_STEP_COMPLETE",
          step: "phone-type",
          phoneType,
        });
        return true;
      }

      // DB is ready - persist to API then dispatch
      try {
        const userApi = window.api.user as {
          setPhoneType: (
            userId: string,
            phoneType: "iphone" | "android"
          ) => Promise<{ success: boolean; error?: string }>;
        };
        const result = await userApi.setPhoneType(currentUserId, phoneType);

        if (result.success) {
          // Dispatch onboarding step complete with the selected phone type
          // This ensures the reducer uses the user's actual selection,
          // not platform detection (fixes TASK-1180 onboarding loop bug)
          dispatch({
            type: "ONBOARDING_STEP_COMPLETE",
            step: "phone-type",
            phoneType,
          });
          return true;
        } else {
          console.error(
            "[usePhoneTypeApi] Failed to save phone type:",
            result.error
          );
          return false;
        }
      } catch (error) {
        console.error("[usePhoneTypeApi] Error saving phone type:", error);
        return false;
      }
    },
    [state, dispatch]
  );

  return {
    hasSelectedPhoneType,
    selectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,
    setHasSelectedPhoneType,
    setSelectedPhoneType,
    setNeedsDriverSetup,
    savePhoneType,
  };
}
