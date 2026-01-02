/**
 * useAuthFlow Hook
 *
 * Manages authentication-related state and handlers.
 * Handles login success, pending OAuth, logout, and terms acceptance.
 */

import { useState, useCallback, useMemo } from "react";
import type { PendingOAuthData } from "../../../components/Login";
import type { Subscription } from "../../../../electron/types/models";
import type { PendingOnboardingData, AppStep } from "../types";

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
    },
    [login],
  );

  const handleLoginPending = useCallback(
    (oauthData: PendingOAuthData): void => {
      setPendingOAuthData(oauthData);
    },
    [],
  );

  const handleLogout = useCallback(async (): Promise<void> => {
    await logout();
    onCloseProfile();
    setIsNewUserFlow(false);
    onSetHasSelectedPhoneType(false);
    onSetSelectedPhoneType(null);
    onSetCurrentStep("login");
  }, [logout, onCloseProfile, onSetHasSelectedPhoneType, onSetSelectedPhoneType, onSetCurrentStep]);

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
      handleLogout,
      handleAcceptTerms,
      handleDeclineTerms,
    ],
  );
}
