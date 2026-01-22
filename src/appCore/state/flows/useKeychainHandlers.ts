/**
 * useKeychainHandlers Hook
 *
 * Manages macOS keychain explanation screen handlers.
 * Handles the keychain setup flow and back navigation.
 */

import { useCallback, useMemo } from "react";
import type { AppStep } from "../types";

export interface UseKeychainHandlersOptions {
  initializeSecureStorage: (dontShowAgain: boolean) => Promise<boolean>;
  setCurrentStep: (step: AppStep) => void;
}

export interface UseKeychainHandlersReturn {
  handleKeychainExplanationContinue: (dontShowAgain: boolean) => Promise<void>;
  handleKeychainBack: () => void;
}

export function useKeychainHandlers({
  initializeSecureStorage,
  setCurrentStep,
}: UseKeychainHandlersOptions): UseKeychainHandlersReturn {
  const handleKeychainExplanationContinue = useCallback(
    async (dontShowAgain: boolean): Promise<void> => {
      await initializeSecureStorage(dontShowAgain);
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
