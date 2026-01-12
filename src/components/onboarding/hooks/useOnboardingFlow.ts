/**
 * useOnboardingFlow Hook
 *
 * Orchestration hook that manages onboarding flow state, step navigation,
 * and action handling. Connects the step registry, flow definitions, and
 * shell components.
 *
 * @module onboarding/hooks/useOnboardingFlow
 */

import { useState, useCallback, useMemo } from "react";
import { usePlatform } from "../../../contexts/PlatformContext";
import { getFlowSteps } from "../flows";
import type {
  OnboardingStep,
  OnboardingContext,
  OnboardingStepId,
  StepAction,
  Platform,
} from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * External app state needed to build onboarding context.
 */
export interface OnboardingAppState {
  /** User's selected phone type */
  phoneType: "iphone" | "android" | null;
  /** Whether email is connected */
  emailConnected: boolean;
  /** Connected email address */
  connectedEmail: string | null;
  /** Email provider */
  emailProvider: "google" | "microsoft" | null;
  /** Whether permissions are granted */
  hasPermissions: boolean;
  /** Whether secure storage is set up (macOS) */
  hasSecureStorage: boolean;
  /** Whether driver is set up */
  driverSetupComplete: boolean;
  /** Whether terms are accepted */
  termsAccepted: boolean;
  /** Authentication provider */
  authProvider: "google" | "microsoft";
  /** Whether user is new */
  isNewUser: boolean;
  /** Whether database is initialized */
  isDatabaseInitialized: boolean;
  /** Current user ID */
  userId: string | null;
}

/**
 * Options for the useOnboardingFlow hook.
 */
export interface UseOnboardingFlowOptions {
  /** Initial step index (default: 0) */
  initialStepIndex?: number;
  /** Initial step ID - takes precedence over initialStepIndex */
  initialStepId?: string;
  /** Callback when flow completes */
  onComplete?: () => void;
  /** Callback for action handling - parent processes and updates app state */
  onAction?: (action: StepAction) => void;
  /** External app state for context building */
  appState: OnboardingAppState;
}

/**
 * Return type for the useOnboardingFlow hook.
 */
export interface UseOnboardingFlowReturn {
  /** All steps in the flow (filtered by shouldShow) */
  steps: OnboardingStep[];
  /** All steps in the flow (unfiltered) */
  allSteps: OnboardingStep[];
  /** Current step index */
  currentIndex: number;
  /** Current step */
  currentStep: OnboardingStep;
  /** Current step metadata */
  currentStepMeta: OnboardingStep["meta"];
  /** Onboarding context */
  context: OnboardingContext;
  /** Navigate to next step */
  goToNext: () => void;
  /** Navigate to previous step */
  goToPrevious: () => void;
  /** Navigate to specific step by ID */
  goToStep: (stepId: OnboardingStepId) => void;
  /** Handle step action */
  handleAction: (action: StepAction) => void;
  /** Handle skip for current step */
  handleSkip: () => void;
  /** Whether flow is complete */
  isComplete: boolean;
  /** Whether on first step */
  isFirstStep: boolean;
  /** Whether on last step */
  isLastStep: boolean;
  /** Whether current step can be skipped */
  canSkip: boolean;
  /** Whether next button should be disabled */
  isNextDisabled: boolean;
  /** Current platform */
  platform: Platform;
  /** Total visible steps count */
  totalSteps: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook that orchestrates the onboarding flow.
 *
 * @param options - Hook configuration options
 * @returns Flow state and navigation functions
 *
 * @example
 * ```tsx
 * const {
 *   currentStep,
 *   goToNext,
 *   goToPrevious,
 *   handleAction,
 *   context,
 * } = useOnboardingFlow({
 *   appState: { phoneType: null, emailConnected: false, ... },
 *   onComplete: () => navigate('/dashboard'),
 *   onAction: (action) => dispatch(action),
 * });
 * ```
 */
export function useOnboardingFlow(
  options: UseOnboardingFlowOptions
): UseOnboardingFlowReturn {
  const { initialStepIndex = 0, initialStepId, onComplete, onAction, appState } = options;
  const { platform } = usePlatform();

  // Get all steps for this platform
  const allSteps = useMemo(() => {
    try {
      return getFlowSteps(platform);
    } catch {
      // Return empty array if flow not found (shouldn't happen in production)
      console.error(`[Onboarding] Failed to get flow for platform: ${platform}`);
      return [];
    }
  }, [platform]);

  // Build context from app state
  const context: OnboardingContext = useMemo(
    () => ({
      platform,
      phoneType: appState.phoneType,
      emailConnected: appState.emailConnected,
      connectedEmail: appState.connectedEmail,
      emailSkipped: false, // Will be tracked via actions
      driverSkipped: false, // Will be tracked via actions
      driverSetupComplete: appState.driverSetupComplete,
      permissionsGranted: appState.hasPermissions,
      termsAccepted: appState.termsAccepted,
      emailProvider: appState.emailProvider,
      authProvider: appState.authProvider,
      isNewUser: appState.isNewUser,
      isDatabaseInitialized: appState.isDatabaseInitialized,
      userId: appState.userId,
    }),
    [platform, appState]
  );

  // Filter steps based on shouldShow
  const steps = useMemo(() => {
    return allSteps.filter((step) => {
      if (step.meta.shouldShow) {
        return step.meta.shouldShow(context);
      }
      return true;
    });
  }, [allSteps, context]);

  // Current step state
  const [currentIndex, setCurrentIndex] = useState(() => {
    // If initialStepId is provided, find its index in the steps array
    if (initialStepId) {
      const idIndex = steps.findIndex((s) => s.meta.id === initialStepId);
      if (idIndex >= 0) {
        return idIndex;
      }
    }
    // Clamp initial index to valid range
    return Math.min(Math.max(0, initialStepIndex), Math.max(0, steps.length - 1));
  });

  // Current step (with safety check)
  const currentStep = steps[currentIndex] ?? steps[0];
  const currentStepMeta = currentStep?.meta;

  // Check if step can proceed (for disabling next button)
  const canProceed = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.meta.canProceed) {
      return currentStep.meta.canProceed(context);
    }
    // Default: can always proceed
    return true;
  }, [currentStep, context]);

  // Check if step is complete (for progress tracking)
  const isStepComplete = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.meta.isStepComplete) {
      return currentStep.meta.isStepComplete(context);
    }
    // Default: not complete until action is taken
    return false;
  }, [currentStep, context]);

  // Navigation: Go to next step
  const goToNext = useCallback(() => {
    console.log("[useOnboardingFlow] goToNext called, currentIndex:", currentIndex, "steps.length:", steps.length);
    if (currentIndex < steps.length - 1) {
      console.log("[useOnboardingFlow] Advancing to step", currentIndex + 1);
      setCurrentIndex(currentIndex + 1);
    } else {
      // Flow complete
      console.log("[useOnboardingFlow] Flow complete, calling onComplete");
      onComplete?.();
    }
  }, [currentIndex, steps.length, onComplete]);

  // Navigation: Go to previous step
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Navigation: Go to specific step
  const goToStep = useCallback(
    (stepId: OnboardingStepId) => {
      const index = steps.findIndex((s) => s.meta.id === stepId);
      if (index >= 0) {
        setCurrentIndex(index);
      } else {
        console.warn(`[Onboarding] Step "${stepId}" not found in current flow`);
      }
    },
    [steps]
  );

  // Action handler - processes actions and may advance flow
  const handleAction = useCallback(
    (action: StepAction) => {
      // First, pass action to parent for state updates
      onAction?.(action);

      // Then handle navigation based on action type
      switch (action.type) {
        case "SELECT_PHONE":
          // After phone selection, advance to next step
          // Note: If Android is selected, shouldShow on next steps may filter them
          goToNext();
          break;

        case "EMAIL_CONNECTED":
        case "EMAIL_SKIPPED":
          goToNext();
          break;

        case "PERMISSION_GRANTED":
          console.log("[useOnboardingFlow] PERMISSION_GRANTED received, calling goToNext");
          goToNext();
          break;

        case "SECURE_STORAGE_SETUP":
          goToNext();
          break;

        case "DRIVER_SETUP_COMPLETE":
        case "DRIVER_SKIPPED":
          goToNext();
          break;

        case "TERMS_ACCEPTED":
          goToNext();
          break;

        case "TERMS_DECLINED":
          // Don't advance - user must accept terms
          break;

        case "NAVIGATE_NEXT":
          goToNext();
          break;

        case "NAVIGATE_BACK":
          goToPrevious();
          break;

        case "ONBOARDING_COMPLETE":
          onComplete?.();
          break;

        case "GO_BACK_SELECT_IPHONE":
          // Navigate back to phone-type step
          goToStep("phone-type");
          break;

        case "CONTINUE_EMAIL_ONLY":
          // Continue with email-only flow (Android users)
          goToNext();
          break;

        case "CONNECT_EMAIL_START":
          // Don't navigate - OAuth flow will handle this
          break;

        default:
          // Unknown action - log warning
          console.warn(`[Onboarding] Unknown action type: ${(action as StepAction).type}`);
      }
    },
    [onAction, goToNext, goToPrevious, goToStep, onComplete]
  );

  // Handle skip for current step
  const handleSkip = useCallback(() => {
    const skipConfig = currentStep?.meta.skip;
    if (skipConfig?.enabled) {
      // Dispatch appropriate skip action based on current step
      switch (currentStep.meta.id) {
        case "email-connect":
          handleAction({ type: "EMAIL_SKIPPED" });
          break;
        case "apple-driver":
        case "driver-setup":
          handleAction({ type: "DRIVER_SKIPPED" });
          break;
        default:
          // Generic skip - just advance
          goToNext();
      }
    }
  }, [currentStep, handleAction, goToNext]);

  // Derived state
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;
  const isComplete = currentIndex >= steps.length;
  const canSkip = currentStep?.meta.skip?.enabled ?? false;
  const isNextDisabled = !canProceed || (!isStepComplete && currentStep?.meta.isStepComplete !== undefined);

  return {
    steps,
    allSteps,
    currentIndex,
    currentStep,
    currentStepMeta,
    context,
    goToNext,
    goToPrevious,
    goToStep,
    handleAction,
    handleSkip,
    isComplete,
    isFirstStep,
    isLastStep,
    canSkip,
    isNextDisabled,
    platform,
    totalSteps: steps.length,
  };
}
