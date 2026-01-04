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
 * ## Migration Status
 *
 * This hook supports two execution paths:
 * 1. **State Machine Path** (new): When feature flag enabled, derives state
 *    from the state machine. The LoadingOrchestrator handles initialization.
 * 2. **Legacy Path** (existing): Original implementation with local state.
 *
 * The state machine path uses `useOptionalMachineState()` to check if
 * the feature flag is enabled and returns early with derived values.
 */

import { useState, useEffect, useCallback } from "react";
import type { PendingOnboardingData, PendingEmailTokens } from "../types";
import type { PendingOAuthData } from "../../../components/Login";
import type { Subscription } from "../../../../electron/types/models";
import {
  useOptionalMachineState,
  selectIsDatabaseInitialized,
  selectIsCheckingSecureStorage,
  selectIsInitializingDatabase,
} from "../machine";

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
    isNewUser: boolean,
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

export function useSecureStorage({
  isWindows,
  isMacOS: _isMacOS,
  pendingOAuthData,
  pendingOnboardingData,
  pendingEmailTokens,
  isAuthenticated,
  login,
  onPendingOAuthClear,
  onPendingOnboardingClear,
  onPendingEmailTokensClear,
  onPhoneTypeSet,
  onEmailOnboardingComplete,
  onNewUserFlowSet,
  onNeedsDriverSetup,
}: UseSecureStorageOptions): UseSecureStorageReturn {
  // ============================================
  // STATE MACHINE PATH
  // ============================================
  // Check if state machine is enabled and available.
  // If so, derive all values from state machine and return early.
  const machineState = useOptionalMachineState();

  // Note: We read skipKeychainExplanation from localStorage regardless of path,
  // because this is a UI preference not managed by the state machine.
  const skipKeychainExplanationFromStorage =
    typeof window !== "undefined" &&
    localStorage.getItem("skipKeychainExplanation") === "true";

  if (machineState) {
    const { state } = machineState;

    // Derive boolean states from state machine
    const isDatabaseInitialized = selectIsDatabaseInitialized(state);
    const isCheckingSecureStorage = selectIsCheckingSecureStorage(state);
    const isInitializingDatabase = selectIsInitializingDatabase(state);

    // hasSecureStorageSetup is true once we're past the storage check phase
    // In the state machine flow, if we're not in checking-storage phase, storage exists
    const hasSecureStorageSetup =
      state.status !== "loading" || state.phase !== "checking-storage";

    // initializeSecureStorage in state machine mode:
    // - The LoadingOrchestrator handles actual initialization automatically
    // - This function only saves the user's "don't show again" preference
    // - Returns true since initialization is managed by orchestrator
    const initializeSecureStorage = async (
      dontShowAgain: boolean
    ): Promise<boolean> => {
      // Save preference if user checked "don't show again"
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
      skipKeychainExplanation: skipKeychainExplanationFromStorage,
      initializeSecureStorage,
    };
  }

  // ============================================
  // LEGACY PATH
  // ============================================
  // Original implementation with local state management.
  // Used when state machine feature flag is disabled.

  const [hasSecureStorageSetup, setHasSecureStorageSetup] =
    useState<boolean>(true); // Default true for returning users
  const [isCheckingSecureStorage, setIsCheckingSecureStorage] =
    useState<boolean>(true);
  const [isDatabaseInitialized, setIsDatabaseInitialized] =
    useState<boolean>(false);
  const [isInitializingDatabase, setIsInitializingDatabase] =
    useState<boolean>(false);
  const [skipKeychainExplanation, setSkipKeychainExplanation] =
    useState<boolean>(() => {
      return localStorage.getItem("skipKeychainExplanation") === "true";
    });

  // Sync isDatabaseInitialized with isAuthenticated
  // If user is authenticated, database MUST be initialized (login requires DB)
  // This handles cases where backend initializes DB without frontend knowing
  useEffect(() => {
    if (isAuthenticated && !isDatabaseInitialized) {
      setIsDatabaseInitialized(true);
    }
  }, [isAuthenticated, isDatabaseInitialized]);

  // Check if encryption key store exists on app load
  // This is a file existence check that does NOT trigger keychain prompts
  useEffect(() => {
    const checkKeyStoreExists = async () => {
      setIsCheckingSecureStorage(true);
      try {
        const result = await window.api.system.hasEncryptionKeyStore();
        setHasSecureStorageSetup(result.hasKeyStore);

        // Windows: Initialize database immediately on startup (DPAPI doesn't require user interaction)
        if (isWindows && result.hasKeyStore) {
          try {
            await window.api.system.initializeSecureStorage();
            setIsDatabaseInitialized(true);
          } catch (dbError) {
            console.error(
              "[useSecureStorage] Failed to initialize Windows database on startup:",
              dbError,
            );
          }
        }
      } catch (error) {
        console.error(
          "[useSecureStorage] Failed to check key store existence:",
          error,
        );
        setHasSecureStorageSetup(false);
      } finally {
        setIsCheckingSecureStorage(false);
      }
    };
    checkKeyStoreExists();
  }, [isWindows]);

  // Handle Windows database initialization without keychain prompt
  // Windows uses DPAPI which doesn't require user interaction
  useEffect(() => {
    const initializeWindowsDatabase = async () => {
      const preDbOnboardingComplete =
        pendingOnboardingData.phoneType !== null &&
        pendingOnboardingData.emailConnected;

      if (
        isWindows &&
        pendingOAuthData &&
        !isAuthenticated &&
        !isInitializingDatabase &&
        preDbOnboardingComplete
      ) {
        setIsInitializingDatabase(true);
        try {
          const result = await window.api.system.initializeSecureStorage();
          if (result.success) {
            setIsDatabaseInitialized(true);
            setHasSecureStorageSetup(true);

            // Complete login with pending OAuth data
            try {
              const loginResult =
                await window.api.auth.completePendingLogin(pendingOAuthData);
              if (
                loginResult.success &&
                loginResult.user &&
                loginResult.sessionToken
              ) {
                const subscriptionData = loginResult.subscription as
                  | Subscription
                  | undefined;
                const user = loginResult.user as {
                  id: string;
                  email: string;
                  display_name?: string;
                  avatar_url?: string;
                };

                const userId = loginResult.user.id;

                // Save phone type
                if (pendingOnboardingData.phoneType) {
                  try {
                    const userApi = window.api.user as {
                      setPhoneType: (
                        userId: string,
                        phoneType: "iphone" | "android",
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await userApi.setPhoneType(
                      userId,
                      pendingOnboardingData.phoneType,
                    );
                    onPhoneTypeSet(true);

                    // Check if Windows + iPhone needs driver setup
                    if (pendingOnboardingData.phoneType === "iphone") {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const drivers = (window.api as any)?.drivers;
                      if (drivers) {
                        try {
                          const driverStatus = await drivers.checkApple();
                          if (
                            !driverStatus.installed ||
                            !driverStatus.serviceRunning
                          ) {
                            onNeedsDriverSetup(true);
                          }
                        } catch (driverError) {
                          console.error(
                            "[useSecureStorage] Failed to check driver status:",
                            driverError,
                          );
                          onNeedsDriverSetup(true);
                        }
                      }
                    }
                  } catch (phoneError) {
                    console.error(
                      "[useSecureStorage] Failed to persist phone type:",
                      phoneError,
                    );
                  }
                }

                // Mark email onboarding as complete
                if (pendingOnboardingData.emailConnected) {
                  try {
                    const authApi = window.api
                      .auth as typeof window.api.auth & {
                      completeEmailOnboarding: (
                        userId: string,
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await authApi.completeEmailOnboarding(userId);
                    onEmailOnboardingComplete(
                      true,
                      pendingOnboardingData.emailProvider !== null,
                    );
                  } catch (emailError) {
                    console.error(
                      "[useSecureStorage] Failed to persist email onboarding:",
                      emailError,
                    );
                  }
                }

                // Persist pending email tokens
                if (pendingEmailTokens) {
                  try {
                    await window.api.auth.savePendingMailboxTokens({
                      userId,
                      provider: pendingEmailTokens.provider,
                      email: pendingEmailTokens.email,
                      tokens: pendingEmailTokens.tokens,
                    });
                    onPendingEmailTokensClear();
                  } catch (tokenError) {
                    console.error(
                      "[useSecureStorage] Failed to persist pending email tokens:",
                      tokenError,
                    );
                  }
                }

                onPendingOnboardingClear();
                onNewUserFlowSet(loginResult.isNewUser || false);
                login(
                  user,
                  loginResult.sessionToken,
                  pendingOAuthData.provider,
                  subscriptionData,
                  loginResult.isNewUser || false,
                );
                onPendingOAuthClear();
              }
            } catch (loginError) {
              console.error(
                "[useSecureStorage] Failed to complete pending login:",
                loginError,
              );
            }
          }
        } catch (error) {
          console.error(
            "[useSecureStorage] Failed to initialize Windows database:",
            error,
          );
        } finally {
          setIsInitializingDatabase(false);
        }
      }
    };
    initializeWindowsDatabase();
  }, [
    isWindows,
    pendingOAuthData,
    pendingOnboardingData,
    pendingEmailTokens,
    isAuthenticated,
    isInitializingDatabase,
    login,
    onPendingOAuthClear,
    onPendingOnboardingClear,
    onPendingEmailTokensClear,
    onPhoneTypeSet,
    onEmailOnboardingComplete,
    onNewUserFlowSet,
    onNeedsDriverSetup,
  ]);

  // Initialize secure storage (macOS keychain prompt)
  const initializeSecureStorage = useCallback(
    async (dontShowAgain: boolean): Promise<boolean> => {
      // Save preference if user checked "don't show again"
      if (dontShowAgain) {
        localStorage.setItem("skipKeychainExplanation", "true");
        setSkipKeychainExplanation(true);
      }

      setIsInitializingDatabase(true);
      try {
        const result = await window.api.system.initializeSecureStorage();
        if (result.success) {
          setIsDatabaseInitialized(true);
          setHasSecureStorageSetup(true);

          // If we have pending OAuth data, complete the login now
          if (pendingOAuthData) {
            try {
              const loginResult =
                await window.api.auth.completePendingLogin(pendingOAuthData);
              if (
                loginResult.success &&
                loginResult.user &&
                loginResult.sessionToken
              ) {
                const subscriptionData = loginResult.subscription as
                  | Subscription
                  | undefined;
                const user = loginResult.user as {
                  id: string;
                  email: string;
                  display_name?: string;
                  avatar_url?: string;
                };

                const userId = loginResult.user.id;

                // Save phone type if selected during pre-DB onboarding
                if (pendingOnboardingData.phoneType) {
                  try {
                    const userApi = window.api.user as {
                      setPhoneType: (
                        userId: string,
                        phoneType: "iphone" | "android",
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await userApi.setPhoneType(
                      userId,
                      pendingOnboardingData.phoneType,
                    );
                    onPhoneTypeSet(true);
                  } catch (phoneError) {
                    console.error(
                      "[useSecureStorage] Failed to persist phone type:",
                      phoneError,
                    );
                  }
                }

                // Mark email onboarding as complete if done during pre-DB
                if (pendingOnboardingData.emailConnected) {
                  try {
                    const authApi = window.api
                      .auth as typeof window.api.auth & {
                      completeEmailOnboarding: (
                        userId: string,
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await authApi.completeEmailOnboarding(userId);
                    onEmailOnboardingComplete(
                      true,
                      pendingOnboardingData.emailProvider !== null,
                    );
                  } catch (emailError) {
                    console.error(
                      "[useSecureStorage] Failed to persist email onboarding:",
                      emailError,
                    );
                  }
                }

                // Persist pending email tokens to database
                if (pendingEmailTokens) {
                  try {
                    await window.api.auth.savePendingMailboxTokens({
                      userId,
                      provider: pendingEmailTokens.provider,
                      email: pendingEmailTokens.email,
                      tokens: pendingEmailTokens.tokens,
                    });
                    onEmailOnboardingComplete(true, true);
                    onPendingEmailTokensClear();
                  } catch (tokenError) {
                    console.error(
                      "[useSecureStorage] Failed to persist email tokens:",
                      tokenError,
                    );
                  }
                }

                onPendingOnboardingClear();
                onNewUserFlowSet(loginResult.isNewUser || false);
                onPendingOAuthClear();
                login(
                  user,
                  loginResult.sessionToken,
                  pendingOAuthData.provider,
                  subscriptionData,
                  loginResult.isNewUser || false,
                );
                return true;
              } else {
                console.error(
                  "[useSecureStorage] Failed to complete pending login:",
                  loginResult.error,
                );
                onPendingOAuthClear();
                return false;
              }
            } catch (error) {
              console.error(
                "[useSecureStorage] Error completing pending login:",
                error,
              );
              onPendingOAuthClear();
              return false;
            }
          }
          return true;
        } else {
          console.error(
            "[useSecureStorage] Database initialization failed:",
            result.error,
          );
          return false;
        }
      } catch (error) {
        console.error(
          "[useSecureStorage] Database initialization error:",
          error,
        );
        return false;
      } finally {
        setIsInitializingDatabase(false);
      }
    },
    [
      pendingOAuthData,
      pendingOnboardingData,
      pendingEmailTokens,
      login,
      onPendingOAuthClear,
      onPendingOnboardingClear,
      onPendingEmailTokensClear,
      onPhoneTypeSet,
      onEmailOnboardingComplete,
      onNewUserFlowSet,
    ],
  );

  return {
    hasSecureStorageSetup,
    isCheckingSecureStorage,
    isDatabaseInitialized,
    isInitializingDatabase,
    skipKeychainExplanation,
    initializeSecureStorage,
  };
}
