/**
 * useTermsHandlers Hook
 *
 * Manages terms acceptance and decline logic.
 * Extracted from useAuthFlow for single-responsibility decomposition.
 */

import { useCallback } from "react";
import { authService } from "@/services";
import type { PendingOAuthData } from "../../../../components/Login";
import type { PendingOnboardingData, AppStep } from "../../types";
import { DEFAULT_PENDING_ONBOARDING } from "./types";
import logger from '../../../../utils/logger';

export interface UseTermsHandlersOptions {
  pendingOAuthData: PendingOAuthData | null;
  isAuthenticated: boolean;
  currentUserId: string | null;
  clearTermsRequirement: () => void;
  declineTerms: () => Promise<void>;
  onSetCurrentStep: (step: AppStep) => void;
  setPendingOAuthData: (data: PendingOAuthData | null) => void;
  setPendingOnboardingData: React.Dispatch<
    React.SetStateAction<PendingOnboardingData>
  >;
}

export function useTermsHandlers({
  pendingOAuthData,
  isAuthenticated,
  currentUserId,
  clearTermsRequirement,
  declineTerms,
  onSetCurrentStep,
  setPendingOAuthData,
  setPendingOnboardingData,
}: UseTermsHandlersOptions) {
  const handleAcceptTerms = useCallback(async (): Promise<void> => {
    try {
      // Always write to Supabase - it's the source of truth
      // Local DB will sync from Supabase when it initializes
      const userId = pendingOAuthData?.cloudUser.id || currentUserId;

      if (!userId) {
        throw new Error("No user ID available for terms acceptance");
      }

      const result = await authService.acceptTermsToSupabase(userId);

      if (result.success) {
        // Clear needsTermsAcceptance in AuthContext so WelcomeTerms modal closes
        clearTermsRequirement();

        // Update local state for pre-login flow
        if (pendingOAuthData && !isAuthenticated) {
          setPendingOnboardingData((prev) => ({
            ...prev,
            termsAccepted: true,
          }));
        }
      } else {
        throw new Error(result.error || "Failed to accept terms");
      }
    } catch (error) {
      logger.error("[useAuthFlow] Failed to accept terms:", error);
      throw error;
    }
  }, [pendingOAuthData, isAuthenticated, currentUserId, clearTermsRequirement, setPendingOnboardingData]);

  const handleDeclineTerms = useCallback(async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOAuthData(null);
      setPendingOnboardingData(DEFAULT_PENDING_ONBOARDING);
      onSetCurrentStep("login");
      return;
    }
    await declineTerms();
  }, [pendingOAuthData, isAuthenticated, declineTerms, onSetCurrentStep, setPendingOAuthData, setPendingOnboardingData]);

  return { handleAcceptTerms, handleDeclineTerms };
}
