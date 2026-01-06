/**
 * useSecureStorage Hook
 *
 * Manages secure storage initialization and keychain state.
 * Handles:
 * - Checking if encryption key store exists
 * - Database initialization (with platform-specific handling)
 * - Windows DPAPI auto-initialization
 * - macOS keychain prompts
 *
 * @module appCore/state/flows/useSecureStorage
 *
 * ## State Machine Integration
 *
 * This hook derives all state from the state machine.
 * The LoadingOrchestrator handles actual initialization.
 *
 * Requires the state machine feature flag to be enabled.
 * If disabled, throws an error - legacy code paths have been removed.
 */

import type { PendingOnboardingData, PendingEmailTokens } from "../types";
import type { PendingOAuthData } from "../../../components/Login";
import type { Subscription } from "../../../../electron/types/models";
import {
  useOptionalMachineState,
  selectIsDatabaseInitialized,
  selectIsCheckingSecureStorage,
  selectIsInitializingDatabase,
} from "../machine";

// Interface kept for API compatibility - callers still pass these props
// but they are not used (state machine is source of truth)
interface UseSecureStorageOptions {
  isWindows: boolean;
  isMacOS: boolean;
  pendingOAuthData: PendingOAuthData | null;
  pendingOnboardingData: PendingOnboardingData;
  pendingEmailTokens: PendingEmailTokens | null;
  isAuthenticated: boolean;
  login: (
    user: {
      id: string;
      email: string;
      display_name?: string;
      avatar_url?: string;
    },
    token: string,
    provider: string,
    subscription: Subscription | undefined,
    isNewUser: boolean
  ) => void;
  onPendingOAuthClear: () => void;
  onPendingOnboardingClear: () => void;
  onPendingEmailTokensClear: () => void;
  onPhoneTypeSet: (hasSelected: boolean) => void;
  onEmailOnboardingComplete: (completed: boolean, connected: boolean) => void;
  onNewUserFlowSet: (isNew: boolean) => void;
  onNeedsDriverSetup: (needs: boolean) => void;
}

interface UseSecureStorageReturn {
  hasSecureStorageSetup: boolean;
  isCheckingSecureStorage: boolean;
  isDatabaseInitialized: boolean;
  isInitializingDatabase: boolean;
  skipKeychainExplanation: boolean;
  initializeSecureStorage: (dontShowAgain: boolean) => Promise<boolean>;
}

export function useSecureStorage(
  // Options kept for API compatibility but not used - state machine is source of truth
  _options: UseSecureStorageOptions
): UseSecureStorageReturn {
  const machineState = useOptionalMachineState();

  // Read skipKeychainExplanation from localStorage - UI preference not in state machine
  const skipKeychainExplanation =
    typeof window !== "undefined" &&
    localStorage.getItem("skipKeychainExplanation") === "true";

  if (!machineState) {
    throw new Error(
      "useSecureStorage requires state machine to be enabled. " +
        "Legacy code paths have been removed."
    );
  }

  const { state } = machineState;

  // Derive boolean states from state machine
  const isDatabaseInitialized = selectIsDatabaseInitialized(state);
  const isCheckingSecureStorage = selectIsCheckingSecureStorage(state);
  const isInitializingDatabase = selectIsInitializingDatabase(state);

  // hasSecureStorageSetup is true once we're past the storage check phase
  const hasSecureStorageSetup =
    state.status !== "loading" || state.phase !== "checking-storage";

  // initializeSecureStorage: saves user's "don't show again" preference
  // Actual initialization is handled by LoadingOrchestrator
  const initializeSecureStorage = async (
    dontShowAgain: boolean
  ): Promise<boolean> => {
    if (dontShowAgain) {
      localStorage.setItem("skipKeychainExplanation", "true");
    }
    // In state machine mode, initialization is handled by LoadingOrchestrator.
    // This function is called from UI components (e.g., keychain explanation screen)
    // but the actual DB initialization happens via the orchestrator.
    return true;
  };

  return {
    hasSecureStorageSetup,
    isCheckingSecureStorage,
    isDatabaseInitialized,
    isInitializingDatabase,
    skipKeychainExplanation,
    initializeSecureStorage,
  };
}
