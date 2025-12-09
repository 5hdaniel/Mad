/**
 * useEmailOnboardingApi Hook
 *
 * Handles email onboarding status checks and completion.
 * Checks:
 * - Whether user has completed email onboarding
 * - Whether user has any email connected
 */

import { useState, useEffect } from "react";

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
        // No user logged in, nothing to check
        setIsCheckingEmailOnboarding(false);
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
