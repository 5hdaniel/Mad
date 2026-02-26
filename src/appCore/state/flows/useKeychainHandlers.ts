/**
 * useKeychainHandlers Hook
 *
 * Manages macOS keychain explanation screen handlers.
 * Handles the keychain setup flow and back navigation.
 */

import { useCallback, useMemo } from "react";
import type { AppStep } from "../types";

export interface UseKeychainHandlersOptions {
  initializeSecureStorage: () => Promise<boolean>;
  setCurrentStep: (step: AppStep) => void;
}

export interface UseKeychainHandlersReturn {
  handleKeychainExplanationContinue: () => Promise<void>;
  handleKeychainBack: () => void;
}

export function useKeychainHandlers({
  initializeSecureStorage,
  setCurrentStep,
}: UseKeychainHandlersOptions): UseKeychainHandlersReturn {
  const handleKeychainExplanationContinue = useCallback(
    async (): Promise<void> => {
      await initializeSecureStorage();
    },
    [initializeSecureStorage],
  );

  const handleKeychainBack = useCallback((): void => {
    setCurrentStep("email-onboarding");
  }, [setCurrentStep]);

  return useMemo(
    () => ({
      handleKeychainExplanationContinue,
      handleKeychainBack,
    }),
    [handleKeychainExplanationContinue, handleKeychainBack],
  );
}
