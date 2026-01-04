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
import type { PhoneType } from "../types";
import {
  useOptionalMachineState,
  selectHasSelectedPhoneType,
  selectPhoneType,
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
  userId,
  isWindows,
}: UsePhoneTypeApiOptions): UsePhoneTypeApiReturn {
  // ============================================
  // STATE MACHINE PATH
  // ============================================
  // Check if state machine is enabled and available.
  // If so, derive all values from state machine and return early.
  const machineState = useOptionalMachineState();

  if (machineState) {
    const { state, dispatch } = machineState;

    // Derive hasSelectedPhoneType from state machine
    const hasSelectedPhoneType = selectHasSelectedPhoneType(state);

    // Loading if we're in loading phase before user data
    const isLoadingPhoneType =
      state.status === "loading" &&
      ["checking-storage", "initializing-db", "loading-auth", "loading-user-data"].includes(
        state.phase
      );

    // Get phone type from state machine
    const selectedPhoneType = selectPhoneType(state);

    // Derive needsDriverSetup from state machine
    // When ready, it's in userData; when onboarding, derive from platform
    const needsDriverSetup =
      state.status === "ready"
        ? state.userData.needsDriverSetup
        : state.status === "onboarding" && state.platform.isWindows && state.platform.hasIPhone;

    // Setters are no-ops in state machine mode - state machine is source of truth
    const setHasSelectedPhoneType = useCallback((_selected: boolean) => {
      // No-op in state machine mode
    }, []);

    const setSelectedPhoneType = useCallback((_type: PhoneType) => {
      // No-op in state machine mode
    }, []);

    const setNeedsDriverSetup = useCallback((_needs: boolean) => {
      // No-op in state machine mode
    }, []);

    // savePhoneType persists to API and dispatches onboarding step complete
    const savePhoneType = useCallback(
      async (phoneType: "iphone" | "android"): Promise<boolean> => {
        // userId comes from state machine in this path
        const currentUserId =
          state.status === "ready" || state.status === "onboarding"
            ? state.user.id
            : null;

        if (!currentUserId) return false;

        try {
          const userApi = window.api.user as {
            setPhoneType: (
              userId: string,
              phoneType: "iphone" | "android"
            ) => Promise<{ success: boolean; error?: string }>;
          };
          const result = await userApi.setPhoneType(currentUserId, phoneType);

          if (result.success) {
            // Dispatch onboarding step complete
            dispatch({
              type: "ONBOARDING_STEP_COMPLETE",
              step: "phone-type",
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

  // ============================================
  // LEGACY PATH
  // ============================================
  // Original implementation with local state management.
  // Used when state machine feature flag is disabled.

  const [hasSelectedPhoneType, setHasSelectedPhoneType] =
    useState<boolean>(false);
  const [selectedPhoneType, setSelectedPhoneType] = useState<PhoneType>(null);
  const [isLoadingPhoneType, setIsLoadingPhoneType] = useState<boolean>(true);
  const [needsDriverSetup, setNeedsDriverSetup] = useState<boolean>(false);

  // Load user's phone type from database when user logs in
  useEffect(() => {
    const loadPhoneType = async () => {
      if (userId) {
        setIsLoadingPhoneType(true);
        try {
          const userApi = window.api.user as {
            getPhoneType: (userId: string) => Promise<{
              success: boolean;
              phoneType: "iphone" | "android" | null;
              error?: string;
            }>;
          };
          const result = await userApi.getPhoneType(userId);
          if (result.success && result.phoneType) {
            setSelectedPhoneType(result.phoneType);

            // Phone type is selected (loaded from DB) - this is separate from driver status
            setHasSelectedPhoneType(true);

            // On Windows + iPhone, check if drivers need to be installed/updated
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const drivers = (window.api as any)?.drivers;
            if (isWindows && result.phoneType === "iphone" && drivers) {
              try {
                const driverStatus = await drivers.checkApple();
                // Only check isInstalled - service might not be running after fresh install
                if (!driverStatus.isInstalled) {
                  setNeedsDriverSetup(true);
                } else {
                  setNeedsDriverSetup(false);
                }
              } catch (driverError) {
                console.error(
                  "[usePhoneTypeApi] Failed to check driver status:",
                  driverError,
                );
                // Assume drivers need setup if check fails
                setNeedsDriverSetup(true);
              }
            } else {
              setNeedsDriverSetup(false);
            }
          } else {
            // No phone type stored - user needs to select
            setHasSelectedPhoneType(false);
            setSelectedPhoneType(null);
            setNeedsDriverSetup(false);
          }
        } catch (error) {
          console.error("[usePhoneTypeApi] Failed to load phone type:", error);
          setHasSelectedPhoneType(false);
          setSelectedPhoneType(null);
          setNeedsDriverSetup(false);
        } finally {
          setIsLoadingPhoneType(false);
        }
      } else {
        // No user logged in - keep loading true to prevent premature routing
        // Routing should only happen after we've loaded user data
        // Don't reset hasSelectedPhoneType/selectedPhoneType here - they'll be set when user logs in
      }
    };
    loadPhoneType();
  }, [userId, isWindows]);

  // Save phone type to database
  const savePhoneType = async (
    phoneType: "iphone" | "android",
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const userApi = window.api.user as {
        setPhoneType: (
          userId: string,
          phoneType: "iphone" | "android",
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneType(userId, phoneType);
      if (result.success) {
        setSelectedPhoneType(phoneType);
        return true;
      } else {
        console.error(
          "[usePhoneTypeApi] Failed to save phone type:",
          result.error,
        );
        return false;
      }
    } catch (error) {
      console.error("[usePhoneTypeApi] Error saving phone type:", error);
      return false;
    }
  };

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
