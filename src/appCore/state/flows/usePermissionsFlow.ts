/**
 * usePermissionsFlow Hook
 *
 * Manages macOS permissions checking and granting.
 * Also handles app location checking for move-to-Applications prompts.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AppStep } from "../types";
import type { AppAction } from "../machine/types";

export interface UsePermissionsFlowOptions {
  isWindows: boolean;
  onSetShowMoveAppPrompt: (show: boolean) => void;
  onSetCurrentStep: (step: AppStep) => void;
  stateMachineDispatch?: React.Dispatch<AppAction>;
}

export interface UsePermissionsFlowReturn {
  // State
  hasPermissions: boolean;
  appPath: string;

  // Setters
  setHasPermissions: (value: boolean) => void;

  // Handlers
  handlePermissionsGranted: () => void;
  checkPermissions: () => Promise<void>;
}

export function usePermissionsFlow({
  isWindows,
  onSetShowMoveAppPrompt,
  onSetCurrentStep,
  stateMachineDispatch,
}: UsePermissionsFlowOptions): UsePermissionsFlowReturn {
  // Default to true to avoid flicker for returning users
  // The actual status will be verified by the effect below
  const [hasPermissions, setHasPermissions] = useState<boolean>(true);
  const [appPath, setAppPath] = useState<string>("");

  const checkPermissions = useCallback(async (): Promise<void> => {
    if (isWindows) {
      setHasPermissions(true);
      return;
    }
    const result = await window.api.system.checkAllPermissions();
    // Set based on actual permission status
    // The result has permissions.fullDiskAccess.hasPermission and permissions.contacts.hasPermission
    const fullDiskOk = result.permissions?.fullDiskAccess?.hasPermission ?? false;
    const contactsOk = result.permissions?.contacts?.hasPermission ?? false;
    setHasPermissions(fullDiskOk && contactsOk);
  }, [isWindows]);

  const checkAppLocation = useCallback(async (): Promise<void> => {
    try {
      // checkAppLocation is macOS-specific - for now skip on Windows
      // TODO: Implement checkAppLocation in systemBridge for macOS
      const result = { shouldPrompt: false, appPath: "" };
      setAppPath(result.appPath || "");
      const hasIgnored = localStorage.getItem("ignoreMoveAppPrompt");
      if (result.shouldPrompt && !hasIgnored) {
        onSetShowMoveAppPrompt(true);
      }
    } catch (error) {
      console.error("[usePermissionsFlow] Error checking app location:", error);
    }
  }, [onSetShowMoveAppPrompt]);

  // Initial permission and app location check
  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, [checkPermissions, checkAppLocation]);

  const handlePermissionsGranted = useCallback((): void => {
    console.log("[usePermissionsFlow] handlePermissionsGranted called, stateMachineDispatch:", !!stateMachineDispatch);
    setHasPermissions(true);
    // Dispatch to state machine to complete the permissions step
    if (stateMachineDispatch) {
      console.log("[usePermissionsFlow] Dispatching ONBOARDING_STEP_COMPLETE for permissions");
      stateMachineDispatch({ type: "ONBOARDING_STEP_COMPLETE", step: "permissions" });
    } else {
      console.warn("[usePermissionsFlow] No stateMachineDispatch available!");
    }
    // Legacy fallback (no-op if state machine is enabled)
    onSetCurrentStep("dashboard");
  }, [onSetCurrentStep, stateMachineDispatch]);

  return useMemo(
    () => ({
      hasPermissions,
      appPath,
      setHasPermissions,
      handlePermissionsGranted,
      checkPermissions,
    }),
    [hasPermissions, appPath, handlePermissionsGranted, checkPermissions],
  );
}
