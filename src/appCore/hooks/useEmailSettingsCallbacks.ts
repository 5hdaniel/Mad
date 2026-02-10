/**
 * useEmailSettingsCallbacks Hook
 *
 * Encapsulates email connect/disconnect callbacks used by Settings modal.
 * Extracted from AppModals.tsx to keep the orchestrator under 150 lines.
 */

import { useCallback } from "react";
import { useEmailOnboardingApi } from "../state/flows";

interface UseEmailSettingsCallbacksOptions {
  userId: string | undefined;
}

interface UseEmailSettingsCallbacksResult {
  handleEmailConnectedFromSettings: (email: string, provider: "google" | "microsoft") => void;
  handleEmailDisconnectedFromSettings: (provider: "google" | "microsoft") => void;
}

export function useEmailSettingsCallbacks({
  userId,
}: UseEmailSettingsCallbacksOptions): UseEmailSettingsCallbacksResult {
  const { setHasEmailConnected } = useEmailOnboardingApi({ userId });

  const handleEmailConnectedFromSettings = useCallback(
    (email: string, provider: "google" | "microsoft") => {
      setHasEmailConnected(true, email, provider);
    },
    [setHasEmailConnected]
  );

  // TASK-1730: Callback for when email is disconnected from Settings
  const handleEmailDisconnectedFromSettings = useCallback(
    (provider: "google" | "microsoft") => {
      setHasEmailConnected(false, undefined, provider);
    },
    [setHasEmailConnected]
  );

  return {
    handleEmailConnectedFromSettings,
    handleEmailDisconnectedFromSettings,
  };
}
