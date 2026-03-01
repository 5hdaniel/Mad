/**
 * useOnboardingQueue Hook
 *
 * React hook wrapping the pure queue builder functions.
 * This is the single source of truth for onboarding step progression.
 *
 * @module onboarding/queue/useOnboardingQueue
 */

import { useMemo, useCallback } from "react";
import { usePlatform } from "../../../contexts/PlatformContext";
import type { OnboardingContext, StepAction, OnboardingStepId, Platform } from "../types";
import type { StepQueueEntry } from "./types";
import { buildOnboardingQueue, isQueueComplete, getActiveEntry, getVisibleEntries } from "./buildQueue";
import logger from "../../../utils/logger";

// =============================================================================
// TYPES
// =============================================================================

/**
 * External app state needed to build onboarding context.
 * Same shape as the old OnboardingAppState from useOnboardingFlow.
 */
export interface OnboardingAppState {
  phoneType: "iphone" | "android" | null;
  emailConnected: boolean | undefined;
  connectedEmail: string | null;
  emailProvider: "google" | "microsoft" | null;
  hasPermissions: boolean | undefined;
  hasSecureStorage: boolean;
  driverSetupComplete: boolean;
  termsAccepted: boolean;
  authProvider: "google" | "microsoft";
  isNewUser: boolean;
  isDatabaseInitialized: boolean;
  userId: string | null;
  isUserVerifiedInLocalDb: boolean;
}

export interface UseOnboardingQueueOptions {
  appState: OnboardingAppState;
  onAction?: (action: StepAction) => void;
  onComplete?: () => void;
}

export interface UseOnboardingQueueReturn {
  /** Full queue with all entries (including skipped) */
  queue: StepQueueEntry[];
  /** Only applicable/visible entries */
  visibleEntries: StepQueueEntry[];
  /** Currently active entry, or undefined if queue complete */
  activeEntry: StepQueueEntry | undefined;
  /** Active step's Content component and meta */
  activeStep: StepQueueEntry["step"] | undefined;
  /** Current index within visible entries */
  currentIndex: number;
  /** Whether the entire queue is complete */
  isComplete: boolean;
  /** Onboarding context */
  context: OnboardingContext;
  /** Platform */
  platform: Platform;
  /** Navigate to next visible step */
  goToNext: () => void;
  /** Navigate to previous visible step */
  goToPrevious: () => void;
  /** Handle a step action (dispatches to parent + handles navigation) */
  handleAction: (action: StepAction) => void;
  /** Handle skip for current step */
  handleSkip: () => void;
  /** Whether current step can be skipped */
  canSkip: boolean;
  /** Whether next button should be disabled */
  isNextDisabled: boolean;
  /** Whether on the first visible step */
  isFirstStep: boolean;
  /** Whether on the last visible step */
  isLastStep: boolean;
  /** Total visible steps */
  totalSteps: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useOnboardingQueue(
  options: UseOnboardingQueueOptions
): UseOnboardingQueueReturn {
  const { appState, onAction, onComplete } = options;
  const { platform } = usePlatform();

  // Build context from app state
  const context: OnboardingContext = useMemo(
    () => ({
      platform,
      phoneType: appState.phoneType,
      emailConnected: appState.emailConnected,
      connectedEmail: appState.connectedEmail,
      emailSkipped: false,
      driverSkipped: false,
      driverSetupComplete: appState.driverSetupComplete,
      permissionsGranted: appState.hasPermissions,
      termsAccepted: appState.termsAccepted,
      emailProvider: appState.emailProvider,
      authProvider: appState.authProvider,
      isNewUser: appState.isNewUser,
      isDatabaseInitialized: appState.isDatabaseInitialized,
      userId: appState.userId,
      isUserVerifiedInLocalDb: appState.isUserVerifiedInLocalDb,
    }),
    [platform, appState]
  );

  // Build the queue - rebuilds when context changes
  const queue = useMemo(
    () => buildOnboardingQueue(platform, context),
    [platform, context]
  );

  // Derived values
  const visibleEntries = useMemo(() => getVisibleEntries(queue), [queue]);
  const activeEntry = useMemo(() => getActiveEntry(queue), [queue]);
  const queueComplete = useMemo(() => isQueueComplete(queue), [queue]);

  const currentIndex = useMemo(() => {
    if (!activeEntry) return visibleEntries.length - 1; // Queue complete, point to last
    return visibleEntries.findIndex(
      (e: StepQueueEntry) => e.step.meta.id === activeEntry.step.meta.id
    );
  }, [visibleEntries, activeEntry]);

  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === visibleEntries.length - 1;

  // Check if current step can proceed
  const canProceed = useMemo(() => {
    if (!activeEntry) return false;
    if (activeEntry.step.meta.canProceed) {
      return activeEntry.step.meta.canProceed(context);
    }
    return true;
  }, [activeEntry, context]);

  // Check if current step is complete
  const isStepComplete = useMemo(() => {
    if (!activeEntry) return false;
    if (activeEntry.step.meta.isStepComplete) {
      return activeEntry.step.meta.isStepComplete(context);
    }
    return false;
  }, [activeEntry, context]);

  const canSkip = activeEntry?.step.meta.skip?.enabled ?? false;
  const isNextDisabled =
    !canProceed ||
    (!isStepComplete && activeEntry?.step.meta.isStepComplete !== undefined);

  // Navigation
  const goToNext = useCallback(() => {
    // Queue-based navigation: the queue rebuilds on context change.
    // When context changes (e.g. phone type selected), the queue auto-advances.
    // goToNext is for explicit user navigation (Continue button).
    // If we're at the last visible step, signal completion.
    if (currentIndex >= visibleEntries.length - 1) {
      onComplete?.();
    }
    // Otherwise, the action handler updates context → queue rebuilds → active step changes
  }, [currentIndex, visibleEntries.length, onComplete]);

  const goToPrevious = useCallback(() => {
    // Back navigation: the queue doesn't natively support going back
    // since it's a pure function of context. We'd need to "undo" context changes.
    // For now, this is a no-op placeholder - back navigation is handled by
    // the flow hook's step tracking (which we preserve in OnboardingFlow).
    logger.debug("[Queue] goToPrevious called - handled by flow navigation");
  }, []);

  // Action handler
  const handleAction = useCallback(
    (action: StepAction) => {
      // Dispatch to parent first (updates app state → context → queue rebuilds)
      onAction?.(action);

      // Handle navigation-specific actions
      switch (action.type) {
        case "SELECT_PHONE":
        case "EMAIL_CONNECTED":
        case "EMAIL_SKIPPED":
        case "PERMISSION_GRANTED":
        case "DRIVER_SETUP_COMPLETE":
        case "DRIVER_SKIPPED":
        case "TERMS_ACCEPTED":
        case "NAVIGATE_NEXT":
        case "CONTINUE_EMAIL_ONLY":
          // These actions update context, which triggers queue rebuild.
          // The active step changes automatically when context changes.
          // For actions that don't change context (NAVIGATE_NEXT), call goToNext.
          if (action.type === "NAVIGATE_NEXT") {
            goToNext();
          }
          break;

        case "SECURE_STORAGE_SETUP":
          // DB init is async - context will update when DB is ready,
          // triggering queue rebuild automatically
          break;

        case "NAVIGATE_BACK":
          goToPrevious();
          break;

        case "ONBOARDING_COMPLETE":
          onComplete?.();
          break;

        case "GO_BACK_SELECT_IPHONE":
          // This navigates back to phone-type - handled by context reset
          break;

        case "USER_VERIFIED_IN_LOCAL_DB":
          // Context update triggers queue rebuild
          break;

        case "CONNECT_EMAIL_START":
        case "TERMS_DECLINED":
          // No navigation needed
          break;

        default:
          logger.warn(`[Queue] Unknown action type: ${(action as StepAction).type}`);
      }
    },
    [onAction, goToNext, goToPrevious, onComplete]
  );

  // Handle skip
  const handleSkip = useCallback(() => {
    const skipConfig = activeEntry?.step.meta.skip;
    if (skipConfig?.enabled) {
      switch (activeEntry?.step.meta.id) {
        case "email-connect":
          handleAction({ type: "EMAIL_SKIPPED" });
          break;
        case "apple-driver":
        case "driver-setup":
          handleAction({ type: "DRIVER_SKIPPED" });
          break;
        case "contact-source":
          handleAction({ type: "NAVIGATE_NEXT" });
          break;
        default:
          goToNext();
      }
    }
  }, [activeEntry, handleAction, goToNext]);

  return {
    queue,
    visibleEntries,
    activeEntry,
    activeStep: activeEntry?.step,
    currentIndex,
    isComplete: queueComplete,
    context,
    platform,
    goToNext,
    goToPrevious,
    handleAction,
    handleSkip,
    canSkip,
    isNextDisabled,
    isFirstStep,
    isLastStep,
    totalSteps: visibleEntries.length,
  };
}
