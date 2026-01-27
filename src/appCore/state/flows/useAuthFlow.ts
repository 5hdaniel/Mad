/**
 * useAuthFlow Hook
 *
 * Manages authentication-related state and handlers.
 * Handles login success, pending OAuth, logout, and terms acceptance.
 */

import { useState, useCallback, useMemo } from "react";
import type { PendingOAuthData, DeepLinkAuthData } from "../../../components/Login";
import type { Subscription } from "../../../../electron/types/models";
import type { PendingOnboardingData, AppStep } from "../types";
import type { User, PlatformInfo, AppAction } from "../machine/types";

// Default pending onboarding state
const DEFAULT_PENDING_ONBOARDING: PendingOnboardingData = {
  termsAccepted: false,
  phoneType: null,
  emailConnected: false,
  emailProvider: null,
};

export interface UseAuthFlowOptions {
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
  logout: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  declineTerms: () => Promise<void>;
  isAuthenticated: boolean;
  onCloseProfile: () => void;
  onSetHasSelectedPhoneType: (value: boolean) => void;
  onSetSelectedPhoneType: (value: "iphone" | "android" | null) => void;
  onSetCurrentStep: (step: AppStep) => void;
  /**
   * Optional dispatch function to dispatch LOGIN_SUCCESS to state machine.
   * When provided, handleLoginSuccess will dispatch LOGIN_SUCCESS after login.
   */
  stateMachineDispatch?: React.Dispatch<AppAction>;
  /**
   * Platform info for LOGIN_SUCCESS action.
   * Required when stateMachineDispatch is provided.
   */
  platform?: { isMacOS: boolean; isWindows: boolean };
}

export interface UseAuthFlowReturn {
  // State
  isNewUserFlow: boolean;
  pendingOAuthData: PendingOAuthData | null;
  pendingOnboardingData: PendingOnboardingData;

  // Setters for orchestrator
  setIsNewUserFlow: (value: boolean) => void;
  setPendingOAuthData: (data: PendingOAuthData | null) => void;
  setPendingOnboardingData: React.Dispatch<
    React.SetStateAction<PendingOnboardingData>
  >;

  // Handlers
  handleLoginSuccess: (
    user: {
      id: string;
      email: string;
      display_name?: string;
      avatar_url?: string;
    },
    token: string,
    provider: string,
    subscriptionData: Subscription | undefined,
    isNewUser: boolean,
  ) => void;
  handleLoginPending: (oauthData: PendingOAuthData) => void;
  /** TASK-1507B: Handle deep link auth success from browser OAuth flow */
  handleDeepLinkAuthSuccess: (data: DeepLinkAuthData) => void;
  handleLogout: () => Promise<void>;
  handleAcceptTerms: () => Promise<void>;
  handleDeclineTerms: () => Promise<void>;
}

export function useAuthFlow({
  login,
  logout,
  acceptTerms,
  declineTerms,
  isAuthenticated,
  onCloseProfile,
  onSetHasSelectedPhoneType,
  onSetSelectedPhoneType,
  onSetCurrentStep,
  stateMachineDispatch,
  platform,
}: UseAuthFlowOptions): UseAuthFlowReturn {
  const [isNewUserFlow, setIsNewUserFlow] = useState<boolean>(false);
  const [pendingOAuthData, setPendingOAuthData] =
    useState<PendingOAuthData | null>(null);
  const [pendingOnboardingData, setPendingOnboardingData] =
    useState<PendingOnboardingData>(DEFAULT_PENDING_ONBOARDING);

  const handleLoginSuccess = useCallback(
    (
      user: {
        id: string;
        email: string;
        display_name?: string;
        avatar_url?: string;
      },
      token: string,
      provider: string,
      subscriptionData: Subscription | undefined,
      isNewUser: boolean,
    ): void => {
      setIsNewUserFlow(isNewUser);
      setPendingOAuthData(null);
      login(user, token, provider, subscriptionData, isNewUser);

      // Dispatch LOGIN_SUCCESS to state machine if dispatch is available
      // This transitions the state machine from unauthenticated to loading-user-data
      // (or onboarding for new users)
      if (stateMachineDispatch && platform) {
        const stateMachineUser: User = {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        };

        const platformInfo: PlatformInfo = {
          isMacOS: platform.isMacOS,
          isWindows: platform.isWindows,
          hasIPhone: false, // Determined during onboarding
        };

        stateMachineDispatch({
          type: "LOGIN_SUCCESS",
          user: stateMachineUser,
          platform: platformInfo,
          isNewUser,
        });
      }
    },
    [login, stateMachineDispatch, platform],
  );

  const handleLoginPending = useCallback(
    (oauthData: PendingOAuthData): void => {
      setPendingOAuthData(oauthData);
    },
    [],
  );

  /**
   * TASK-1507B: Handle successful deep link authentication
   * Called when browser OAuth completes and returns via deep link with license validation.
   * NOTE: Token storage is already handled by the backend (setSession) - we just update UI state.
   */
  const handleDeepLinkAuthSuccess = useCallback(
    (data: DeepLinkAuthData): void => {
      console.log("[useAuthFlow] Deep link auth success", { userId: data.userId || data.user?.id });

      // Clear any pending OAuth data
      setPendingOAuthData(null);

      // BACKLOG-546: Use isNewUser from backend (based on terms acceptance)
      // Fallback to transaction count only if not provided (backwards compatibility)
      const isNewUser = data.isNewUser ?? (!data.licenseStatus || data.licenseStatus.transactionCount === 0);
      setIsNewUserFlow(isNewUser);

      // TASK-1507C: Call login() to set currentUser in AuthContext
      // This is required for downstream handlers (email connection) to work
      if (data.user) {
        const user = {
          id: data.user.id,
          email: data.user.email || "",
          display_name: data.user.name,
        };
        // Provider from Supabase app_metadata (google, azure, etc), fallback to google
        // Subscription: Not available in deep link data, will be fetched separately
        login(
          user,
          data.accessToken,
          data.provider || "google",
          undefined,
          isNewUser
        );
      }

      // Dispatch LOGIN_SUCCESS to state machine if dispatch is available
      // This transitions the state machine from unauthenticated to loading-user-data
      if (stateMachineDispatch && platform && data.user) {
        const stateMachineUser: User = {
          id: data.user.id,
          email: data.user.email || "",
          displayName: data.user.name,
        };

        const platformInfo: PlatformInfo = {
          isMacOS: platform.isMacOS,
          isWindows: platform.isWindows,
          hasIPhone: false, // Determined during onboarding
        };

        stateMachineDispatch({
          type: "LOGIN_SUCCESS",
          user: stateMachineUser,
          platform: platformInfo,
          isNewUser,
        });
      }

      // Navigate to the appropriate step
      // New users go to onboarding (phone type selection), returning users go to dashboard
      if (isNewUser) {
        onSetCurrentStep("phone-type-selection");
      } else {
        onSetCurrentStep("dashboard");
      }
    },
    [login, stateMachineDispatch, platform, onSetCurrentStep],
  );

  const handleLogout = useCallback(async (): Promise<void> => {
    await logout();
    // Dispatch LOGOUT to state machine to transition to "unauthenticated"
    // This ensures the UI reflects the logged-out state (redirects to login screen)
    if (stateMachineDispatch) {
      stateMachineDispatch({ type: "LOGOUT" });
    }
    onCloseProfile();
    setIsNewUserFlow(false);
    onSetHasSelectedPhoneType(false);
    onSetSelectedPhoneType(null);
    onSetCurrentStep("login");
  }, [logout, stateMachineDispatch, onCloseProfile, onSetHasSelectedPhoneType, onSetSelectedPhoneType, onSetCurrentStep]);

  const handleAcceptTerms = useCallback(async (): Promise<void> => {
    try {
      if (pendingOAuthData && !isAuthenticated) {
        const authApi = window.api.auth as typeof window.api.auth & {
          acceptTermsToSupabase: (userId: string) => Promise<{
            success: boolean;
            error?: string;
          }>;
        };
        const result = await authApi.acceptTermsToSupabase(
          pendingOAuthData.cloudUser.id,
        );
        if (result.success) {
          setPendingOnboardingData((prev) => ({
            ...prev,
            termsAccepted: true,
          }));
        } else {
          console.error(
            "[useAuthFlow] Failed to save terms to Supabase:",
            result.error,
          );
        }
        return;
      }
      await acceptTerms();
    } catch (error) {
      console.error("[useAuthFlow] Failed to accept terms:", error);
    }
  }, [pendingOAuthData, isAuthenticated, acceptTerms]);

  const handleDeclineTerms = useCallback(async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOAuthData(null);
      setPendingOnboardingData(DEFAULT_PENDING_ONBOARDING);
      onSetCurrentStep("login");
      return;
    }
    await declineTerms();
  }, [pendingOAuthData, isAuthenticated, declineTerms, onSetCurrentStep]);

  return useMemo(
    () => ({
      isNewUserFlow,
      pendingOAuthData,
      pendingOnboardingData,
      setIsNewUserFlow,
      setPendingOAuthData,
      setPendingOnboardingData,
      handleLoginSuccess,
      handleLoginPending,
      handleDeepLinkAuthSuccess,
      handleLogout,
      handleAcceptTerms,
      handleDeclineTerms,
    }),
    [
      isNewUserFlow,
      pendingOAuthData,
      pendingOnboardingData,
      handleLoginSuccess,
      handleLoginPending,
      handleDeepLinkAuthSuccess,
      handleLogout,
      handleAcceptTerms,
      handleDeclineTerms,
    ],
  );
}
