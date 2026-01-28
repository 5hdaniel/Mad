/**
 * useEmailHandlers Hook
 *
 * Manages email onboarding handlers for connecting email accounts.
 * Handles Google and Microsoft OAuth flows for email connection.
 */

import { useCallback, useMemo } from "react";
import type { AppStep, PendingOnboardingData, PendingEmailTokens } from "../types";
import type { PendingOAuthData } from "../../../components/Login";
import { USE_NEW_ONBOARDING } from "../../routing/routeConfig";

export interface UseEmailHandlersOptions {
  // Auth state
  pendingOAuthData: PendingOAuthData | null;
  isAuthenticated: boolean;
  currentUserId: string | undefined;
  currentUserEmail: string | undefined;

  // Platform
  isMacOS: boolean;
  isWindows: boolean;

  // Onboarding state
  selectedPhoneType: "iphone" | "android" | null;
  needsDriverSetup: boolean;
  hasPermissions: boolean;

  // Setters
  setPendingEmailTokens: (tokens: PendingEmailTokens | null) => void;
  setPendingOnboardingData: React.Dispatch<
    React.SetStateAction<PendingOnboardingData>
  >;
  setHasEmailConnected: (
    connected: boolean,
    email?: string,
    provider?: "google" | "microsoft"
  ) => void;
  setCurrentStep: (step: AppStep) => void;

  // Email onboarding API
  completeEmailOnboarding: () => Promise<void>;
}

export interface UseEmailHandlersReturn {
  handleEmailOnboardingComplete: (
    emailTokens?: PendingEmailTokens,
  ) => Promise<void>;
  handleEmailOnboardingSkip: () => Promise<void>;
  handleEmailOnboardingBack: () => void;
  handleStartGoogleEmailConnect: () => Promise<void>;
  handleStartMicrosoftEmailConnect: () => Promise<void>;
}

export function useEmailHandlers({
  pendingOAuthData,
  isAuthenticated,
  currentUserId,
  currentUserEmail,
  isMacOS,
  isWindows,
  selectedPhoneType,
  needsDriverSetup,
  hasPermissions,
  setPendingEmailTokens,
  setPendingOnboardingData,
  setHasEmailConnected,
  setCurrentStep,
  completeEmailOnboarding,
}: UseEmailHandlersOptions): UseEmailHandlersReturn {
  const handleEmailOnboardingComplete = useCallback(
    async (emailTokens?: PendingEmailTokens): Promise<void> => {
      if (pendingOAuthData && !isAuthenticated) {
        if (emailTokens) {
          setPendingEmailTokens(emailTokens);
        }
        setPendingOnboardingData((prev) => ({
          ...prev,
          emailConnected: !!emailTokens,
          emailProvider: emailTokens?.provider || null,
        }));
        // When new onboarding is enabled, don't call setCurrentStep - let OnboardingFlow handle navigation
        if (!USE_NEW_ONBOARDING) {
          if (isMacOS) {
            setCurrentStep("keychain-explanation");
          } else if (isWindows) {
            // On Windows, go to Apple driver setup for iPhone users
            setCurrentStep("apple-driver-setup");
          }
        }
        return;
      }

      await completeEmailOnboarding();
      // Pass email and provider to properly dispatch EMAIL_CONNECTED action
      const provider = emailTokens?.provider || (pendingOAuthData?.provider as "google" | "microsoft");
      if (currentUserEmail && provider) {
        setHasEmailConnected(true, currentUserEmail, provider);
      }

      // When new onboarding is enabled, don't call setCurrentStep - let OnboardingFlow handle navigation
      if (!USE_NEW_ONBOARDING) {
        // Windows iPhone users need driver setup after email onboarding
        if (isWindows && selectedPhoneType === "iphone" && needsDriverSetup) {
          setCurrentStep("apple-driver-setup");
          return;
        }

        if (hasPermissions) {
          setCurrentStep("dashboard");
        } else {
          setCurrentStep("permissions");
        }
      }
    },
    [
      pendingOAuthData,
      isAuthenticated,
      isMacOS,
      isWindows,
      selectedPhoneType,
      needsDriverSetup,
      hasPermissions,
      setPendingEmailTokens,
      setPendingOnboardingData,
      setHasEmailConnected,
      setCurrentStep,
      completeEmailOnboarding,
    ],
  );

  const handleEmailOnboardingSkip = useCallback(async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev) => ({
        ...prev,
        emailConnected: false, // Skipped, not connected
      }));
      // When new onboarding is enabled, don't call setCurrentStep - let OnboardingFlow handle navigation
      if (!USE_NEW_ONBOARDING) {
        if (isMacOS) {
          setCurrentStep("keychain-explanation");
        } else if (isWindows) {
          // On Windows, go to Apple driver setup for iPhone users
          setCurrentStep("apple-driver-setup");
        }
      }
      return;
    }

    await completeEmailOnboarding();

    // When new onboarding is enabled, don't call setCurrentStep - let OnboardingFlow handle navigation
    if (!USE_NEW_ONBOARDING) {
      // Windows iPhone users need driver setup after email onboarding
      if (isWindows && selectedPhoneType === "iphone" && needsDriverSetup) {
        setCurrentStep("apple-driver-setup");
        return;
      }

      if (hasPermissions) {
        setCurrentStep("dashboard");
      } else {
        setCurrentStep("permissions");
      }
    }
  }, [
    pendingOAuthData,
    isAuthenticated,
    isMacOS,
    isWindows,
    selectedPhoneType,
    needsDriverSetup,
    hasPermissions,
    setPendingOnboardingData,
    setCurrentStep,
    completeEmailOnboarding,
  ]);

  const handleEmailOnboardingBack = useCallback((): void => {
    // When new onboarding is enabled, don't call setCurrentStep - let OnboardingFlow handle navigation
    if (!USE_NEW_ONBOARDING) {
      setCurrentStep("phone-type-selection");
    }
  }, [setCurrentStep]);

  /**
   * Start Google OAuth flow for email connection.
   * Handles both pre-DB (pending) and post-DB flows.
   * Sets up IPC listeners to update state when OAuth completes.
   */
  const handleStartGoogleEmailConnect = useCallback(async (): Promise<void> => {
    const usePendingApi = pendingOAuthData && !isAuthenticated;
    const emailHint = pendingOAuthData?.userInfo?.email || currentUserEmail;

    try {
      let result;
      let actuallyUsedPendingApi = usePendingApi;

      if (usePendingApi) {
        result = await window.api.auth.googleConnectMailboxPending(emailHint);
      } else if (currentUserId) {
        result = await window.api.auth.googleConnectMailbox(currentUserId);
        // If regular API fails due to DB not initialized, fall back to pending API
        if (
          !result.success &&
          result.error?.includes("Database is not initialized")
        ) {
          actuallyUsedPendingApi = true;
          result = await window.api.auth.googleConnectMailboxPending(emailHint);
        }
      }

      if (!result?.success) {
        console.error(
          "[useEmailHandlers] Failed to start Google OAuth:",
          result?.error,
        );
        return;
      }

      // Set up IPC listeners for OAuth completion
      if (actuallyUsedPendingApi) {
        const cleanup = window.api.onGoogleMailboxPendingConnected(
          (connectionResult: {
            success: boolean;
            email?: string;
            tokens?: PendingEmailTokens["tokens"];
            error?: string;
          }) => {
            if (
              connectionResult.success &&
              connectionResult.email &&
              connectionResult.tokens
            ) {
              setPendingEmailTokens({
                provider: "google",
                email: connectionResult.email,
                tokens: connectionResult.tokens,
              });
              setHasEmailConnected(true, connectionResult.email, "google");
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "google",
              }));
            }
            cleanup();
          },
        );
      } else {
        const cleanup = window.api.onGoogleMailboxConnected(
          (connectionResult: {
            success: boolean;
            email?: string;
            error?: string;
          }) => {
            if (connectionResult.success && connectionResult.email) {
              setHasEmailConnected(true, connectionResult.email, "google");
              // Also set email provider so EmailConnectStep shows as connected
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "google",
              }));
            }
            cleanup();
          },
        );
      }
    } catch (error) {
      console.error("[useEmailHandlers] Error starting Google OAuth:", error);
    }
  }, [
    pendingOAuthData,
    isAuthenticated,
    currentUserId,
    currentUserEmail,
    setPendingEmailTokens,
    setHasEmailConnected,
    setPendingOnboardingData,
  ]);

  /**
   * Start Microsoft OAuth flow for email connection.
   * Handles both pre-DB (pending) and post-DB flows.
   * Sets up IPC listeners to update state when OAuth completes.
   */
  const handleStartMicrosoftEmailConnect =
    useCallback(async (): Promise<void> => {
      const usePendingApi = pendingOAuthData && !isAuthenticated;
      const emailHint = pendingOAuthData?.userInfo?.email || currentUserEmail;

      try {
        let result;
        let actuallyUsedPendingApi = usePendingApi;

        if (usePendingApi) {
          result =
            await window.api.auth.microsoftConnectMailboxPending(emailHint);
        } else if (currentUserId) {
          result = await window.api.auth.microsoftConnectMailbox(currentUserId);
          // If regular API fails due to DB not initialized, fall back to pending API
          if (
            !result.success &&
            result.error?.includes("Database is not initialized")
          ) {
            actuallyUsedPendingApi = true;
            result =
              await window.api.auth.microsoftConnectMailboxPending(emailHint);
          }
        }

        if (!result?.success) {
          console.error(
            "[useEmailHandlers] Failed to start Microsoft OAuth:",
            result?.error,
          );
          return;
        }

        // Set up IPC listeners for OAuth completion
        if (actuallyUsedPendingApi) {
          const cleanup = window.api.onMicrosoftMailboxPendingConnected(
            (connectionResult: {
              success: boolean;
              email?: string;
              tokens?: PendingEmailTokens["tokens"];
              error?: string;
            }) => {
              if (
                connectionResult.success &&
                connectionResult.email &&
                connectionResult.tokens
              ) {
                setPendingEmailTokens({
                  provider: "microsoft",
                  email: connectionResult.email,
                  tokens: connectionResult.tokens,
                });
                setHasEmailConnected(true, connectionResult.email, "microsoft");
                setPendingOnboardingData((prev) => ({
                  ...prev,
                  emailProvider: "microsoft",
                }));
              }
              cleanup();
            },
          );
        } else {
          const cleanup = window.api.onMicrosoftMailboxConnected(
            (connectionResult: {
              success: boolean;
              email?: string;
              error?: string;
            }) => {
              if (connectionResult.success && connectionResult.email) {
                setHasEmailConnected(true, connectionResult.email, "microsoft");
                // Also set email provider so EmailConnectStep shows as connected
                setPendingOnboardingData((prev) => ({
                  ...prev,
                  emailProvider: "microsoft",
                }));
              }
              cleanup();
            },
          );
        }
      } catch (error) {
        console.error(
          "[useEmailHandlers] Error starting Microsoft OAuth:",
          error,
        );
      }
    }, [
      pendingOAuthData,
      isAuthenticated,
      currentUserId,
      currentUserEmail,
      setPendingEmailTokens,
      setHasEmailConnected,
      setPendingOnboardingData,
    ]);

  return useMemo(
    () => ({
      handleEmailOnboardingComplete,
      handleEmailOnboardingSkip,
      handleEmailOnboardingBack,
      handleStartGoogleEmailConnect,
      handleStartMicrosoftEmailConnect,
    }),
    [
      handleEmailOnboardingComplete,
      handleEmailOnboardingSkip,
      handleEmailOnboardingBack,
      handleStartGoogleEmailConnect,
      handleStartMicrosoftEmailConnect,
    ],
  );
}
