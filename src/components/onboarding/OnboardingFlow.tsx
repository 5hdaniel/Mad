/**
 * OnboardingFlow Component
 *
 * Main orchestrator component for the new onboarding architecture.
 * Uses useOnboardingFlow hook and integrates with existing app state machine.
 *
 * @module onboarding/OnboardingFlow
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnboardingFlow, type OnboardingAppState } from "./hooks";
import { OnboardingShell } from "./shell/OnboardingShell";
import { ProgressIndicator } from "./shell/ProgressIndicator";
import { NavigationButtons } from "./shell/NavigationButtons";
import { useOptionalMachineState } from "../../appCore/state/machine";
import {
  selectPhoneType,
  selectHasEmailConnectedNullable,
  selectHasPermissionsNullable,
  selectIsDatabaseInitialized,
} from "../../appCore/state/machine/selectors";
import { logAllFlags, logNavigation, logStateChange } from "../../appCore/state/machine/debug";
import type { AppStateMachine } from "../../appCore/state/types";
import type { StepAction } from "./types";
import logger from '../../utils/logger';

/**
 * Props for the OnboardingFlow component.
 */
export interface OnboardingFlowProps {
  /** App state machine for handler access and state reading */
  app: AppStateMachine;
}

/**
 * Main onboarding orchestrator component.
 *
 * Uses the new step architecture while integrating with existing app state.
 * Maps StepActions to existing app handlers and manages navigation.
 *
 * @example
 * ```tsx
 * <OnboardingFlow app={app} />
 * ```
 */
export function OnboardingFlow({ app }: OnboardingFlowProps) {
  // Access state machine state when feature flag is enabled
  const machineState = useOptionalMachineState();

  // LOADING GATE: Don't render until state machine has finished loading
  // This prevents race conditions where async checks haven't completed yet,
  // causing selectors to return defensive defaults that hide steps incorrectly.
  // By waiting for "loading" to complete, all state is settled before we render.
  if (!machineState || machineState.state.status === "loading") {
    return null;
  }

  // Early exit if state machine is already in "ready" state
  // This handles the race condition where the async dispatch in completeEmailOnboarding()
  // completes and sets status to "ready", but we're still mounted because goToNext()
  // called the no-op goToStep("dashboard") before the dispatch finished.
  // By returning null here, we let AppRouter render the Dashboard instead of showing
  // a white screen while waiting for navigation that never comes.
  if (machineState.state.status === "ready") {
    return null;
  }

  // Track if we're waiting for DB init to complete after clicking Continue on secure-storage
  // This handles the async nature of macOS keychain initialization for first-time users
  const [waitingForDbInit, setWaitingForDbInit] = useState(false);

  // Track if user has been verified in local DB (set by account-verification step)
  const [isUserVerifiedInLocalDb, setIsUserVerifiedInLocalDb] = useState(false);

  // Build app state, deriving from state machine when available
  // This fixes the flicker issue where legacy app properties have stale data during initial load
  const appState: OnboardingAppState = useMemo(() => {
    if (machineState) {
      // State machine enabled - derive from state machine for consistent state
      const { state } = machineState;
      const isDatabaseInitialized = selectIsDatabaseInitialized(state);
      // Use nullable selectors - returns undefined during loading instead of defensive true/false
      // This ensures steps show correctly when state is unknown
      const emailConnected = selectHasEmailConnectedNullable(state);
      const hasPermissions = selectHasPermissionsNullable(state);

      // DEBUG: Comprehensive flag logging
      logAllFlags('OnboardingFlow.appState', {
        status: state.status,
        step: (state as any).step,
        hasEmailConnected: (state as any).hasEmailConnected,
        hasPermissions: (state as any).hasPermissions,
        hasCompletedEmailOnboarding: (state as any).hasCompletedEmailOnboarding,
        isDatabaseInitialized,
        phoneType: selectPhoneType(state),
        emailConnected,
        permissionsGranted: hasPermissions,
        isNewUser: app.isNewUserFlow,
      });

      logStateChange('OnboardingFlow', 'BUILDING_APP_STATE', {
        'state.status': state.status,
        'state.hasEmailConnected (raw)': (state as any).hasEmailConnected,
        'emailConnected (selector)': emailConnected,
        'hasPermissions': hasPermissions,
        'isDatabaseInitialized': isDatabaseInitialized,
        'emailStep shouldShow': emailConnected !== true,
        'permissionsStep shouldShow': hasPermissions !== true,
      });

      return {
        phoneType: selectPhoneType(state),
        emailConnected,
        connectedEmail: app.currentUser?.email ?? null,
        emailProvider: app.pendingOnboardingData?.emailProvider ?? null,
        hasPermissions,
        hasSecureStorage: app.hasSecureStorageSetup,
        driverSetupComplete: !app.needsDriverSetup,
        termsAccepted: !app.needsTermsAcceptance,
        authProvider: (app.pendingOAuthData?.provider ?? app.authProvider) as "google" | "microsoft" ?? "google",
        isNewUser: app.isNewUserFlow,
        isDatabaseInitialized,
        userId: app.currentUser?.id ?? null,
        isUserVerifiedInLocalDb,
      };
    }

    // Legacy fallback - use app properties directly
    logger.debug('[OnboardingFlow] Using LEGACY path - machineState is null');
    return {
      phoneType: app.selectedPhoneType,
      emailConnected: app.hasEmailConnected,
      connectedEmail: app.currentUser?.email ?? null,
      emailProvider: app.pendingOnboardingData?.emailProvider ?? null,
      hasPermissions: app.hasPermissions,
      hasSecureStorage: app.hasSecureStorageSetup,
      driverSetupComplete: !app.needsDriverSetup,
      termsAccepted: !app.needsTermsAcceptance,
      authProvider: (app.pendingOAuthData?.provider ?? app.authProvider) as "google" | "microsoft" ?? "google",
      isNewUser: app.isNewUserFlow,
      isDatabaseInitialized: app.isDatabaseInitialized,
      userId: app.currentUser?.id ?? null,
      isUserVerifiedInLocalDb,
    };
  }, [machineState, app, isUserVerifiedInLocalDb]);

  // Action handler that maps to existing app handlers
  const handleAction = useCallback(
    (action: StepAction) => {
      switch (action.type) {
        case "SELECT_PHONE":
          if (action.payload.phoneType === "iphone") {
            app.handleSelectIPhone();
          } else {
            app.handleSelectAndroid();
          }
          break;

        case "EMAIL_CONNECTED":
          app.handleEmailOnboardingComplete();
          break;

        case "EMAIL_SKIPPED":
          app.handleEmailOnboardingSkip();
          break;

        case "PERMISSION_GRANTED":
          app.handlePermissionsGranted();
          break;

        case "SECURE_STORAGE_SETUP":
          // For first-time macOS users, DB init is async and happens during keychain setup
          // Set waitingForDbInit to true so we can show loading state and wait for completion
          if (!appState.isDatabaseInitialized) {
            setWaitingForDbInit(true);
          }
          app.handleKeychainExplanationContinue(action.dontShowAgain);
          break;

        case "DRIVER_SETUP_COMPLETE":
          app.handleAppleDriverSetupComplete();
          break;

        case "DRIVER_SKIPPED":
          app.handleAppleDriverSetupSkip();
          break;

        case "TERMS_ACCEPTED":
          app.handleAcceptTerms();
          break;

        case "TERMS_DECLINED":
          app.handleDeclineTerms();
          break;

        case "GO_BACK_SELECT_IPHONE":
          app.handleAndroidGoBack();
          break;

        case "CONTINUE_EMAIL_ONLY":
          app.handleAndroidContinueWithEmail();
          break;

        case "CONNECT_EMAIL_START":
          if (action.payload.provider === "google") {
            app.handleStartGoogleEmailConnect();
          } else {
            app.handleStartMicrosoftEmailConnect();
          }
          break;

        case "USER_VERIFIED_IN_LOCAL_DB":
          // Update local state - this triggers step filtering to hide account-verification
          setIsUserVerifiedInLocalDb(true);
          break;

        case "NAVIGATE_NEXT":
        case "NAVIGATE_BACK":
        case "ONBOARDING_COMPLETE":
          // These are handled by the hook's internal navigation
          break;
      }
    },
    [app]
  );

  // Handle onboarding completion - called when last visible step completes.
  // Dispatches state machine actions for any steps that were hidden (already
  // satisfied) but never formally completed. This bridges the UI flow (which
  // hides satisfied steps) and the state machine (which requires explicit
  // ONBOARDING_STEP_COMPLETE dispatches to transition to "ready").
  //
  // BUG FIX: Previously called app.goToStep("dashboard") which is a no-op
  // since navigation is derived from the state machine (commit 2485bc5d).
  // This caused returning users with email already connected to get stuck
  // on the data-sync step permanently (SPRINT-070 regression).
  const handleComplete = useCallback(() => {
    if (!machineState || machineState.state.status !== "onboarding") return;

    const { state, dispatch } = machineState;
    const completed = state.completedSteps;

    // phone-type: if already selected but not in completedSteps
    if (!completed.includes("phone-type") && appState.phoneType) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: appState.phoneType,
      });
    }

    // apple-driver (Windows + iPhone): if driver set up but not completed
    if (
      state.platform.isWindows &&
      appState.phoneType === "iphone" &&
      !completed.includes("apple-driver") &&
      appState.driverSetupComplete
    ) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "apple-driver",
      });
    }

    // permissions (macOS): if granted but not completed
    if (
      state.platform.isMacOS &&
      appState.hasPermissions === true &&
      !completed.includes("permissions")
    ) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "permissions",
      });
    }

    // email-connect: the critical blocking step. Dispatch synchronously to
    // unblock the state machine, then persist to API fire-and-forget so
    // it doesn't recur on next login.
    if (!completed.includes("email-connect")) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "email-connect",
      });
      // Persist to API (async, fire-and-forget)
      app.handleEmailOnboardingComplete().catch((err: unknown) => {
        logger.error("[OnboardingFlow] Failed to persist email onboarding:", err);
      });
    }
  }, [machineState, appState, app]);

  // Map app's currentStep to onboarding step ID
  // This ensures the OnboardingFlow starts at the correct step based on routing
  // Memoized with empty deps to only compute once at mount
  const initialStepId = useMemo(() => {
    const stepMap: Record<string, string> = {
      "phone-type-selection": "phone-type",
      "keychain-explanation": "secure-storage",
      "email-onboarding": "email-connect",
      "permissions": "permissions",
      "apple-driver-setup": "apple-driver",
      "android-coming-soon": "android-coming-soon",
    };
    return stepMap[app.currentStep];
  }, []); // Empty deps = mount only

  // Initialize the hook
  const flow = useOnboardingFlow({
    appState,
    onAction: handleAction,
    onComplete: handleComplete,
    initialStepId,
  });

  const {
    currentStep,
    steps,
    currentIndex,
    context,
    goToNext,
    goToPrevious,
    handleAction: flowHandleAction,
    handleSkip,
    isFirstStep,
    canSkip,
    isNextDisabled,
  } = flow;

  // Action handler - flowHandleAction already calls onAction (which is handleAction)
  // so we just need to call flowHandleAction, not both
  // NOTE: This hook MUST be before any early return to follow React's rules of hooks
  const handleStepAction = useCallback(
    (action: StepAction) => {
      // flowHandleAction calls onAction internally, then handles navigation
      flowHandleAction(action);
    },
    [flowHandleAction]
  );

  // When DB becomes initialized while we're waiting (after SECURE_STORAGE_SETUP),
  // clear the waiting flag. Navigation is handled automatically by useOnboardingFlow's
  // step-filtering effect - when secure-storage gets filtered out (isDatabaseInitialized=true),
  // it auto-advances to the next visible step.
  //
  // BUG FIX: Previously this effect called goToNext(), but that caused double-advancement:
  // 1. Step-filtering effect: secure-storage filtered out → advances to email-connect
  // 2. This effect: goToNext() → advances from email-connect to permissions
  // Result: email-connect step was skipped entirely.
  useEffect(() => {
    if (waitingForDbInit && appState.isDatabaseInitialized) {
      logStateChange('OnboardingFlow', 'DB_INIT_COMPLETE - clearing waitingForDbInit', {
        waitingForDbInit,
        isDatabaseInitialized: appState.isDatabaseInitialized,
        emailConnected: appState.emailConnected,
        hasPermissions: appState.hasPermissions,
        currentStepId: currentStep?.meta?.id,
        visibleSteps: steps.map(s => s.meta.id),
      });
      setWaitingForDbInit(false);
      // Note: Do NOT call goToNext() here - step filtering in useOnboardingFlow
      // already handles navigation when secure-storage is filtered out
    }
  }, [waitingForDbInit, appState.isDatabaseInitialized, appState.emailConnected, appState.hasPermissions, currentStep, steps]);

  // When all steps are filtered out (returning user with everything complete),
  // navigate to dashboard. This handles the case where a returning user's data
  // loads and all onboarding steps are already complete.
  // Track if we've already navigated to prevent infinite loops
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (steps.length === 0 && !hasNavigatedRef.current && machineState) {
      hasNavigatedRef.current = true;
      const { state, dispatch } = machineState;
      if (state.status === "onboarding") {
        // All steps filtered out means all conditions are met.
        // Dispatch email-connect completion if needed (the blocking step).
        // BUG FIX: app.goToStep("dashboard") is a no-op.
        if (!state.completedSteps.includes("email-connect")) {
          dispatch({
            type: "ONBOARDING_STEP_COMPLETE",
            step: "email-connect",
          });
          app.handleEmailOnboardingComplete().catch((err: unknown) => {
            logger.error("[OnboardingFlow] Failed to persist email onboarding:", err);
          });
        }
      }
    }
  }, [steps.length, machineState, app]);

  // CRITICAL: Return null immediately when no steps are visible
  // This prevents the flicker where onboarding screens briefly appear
  // for returning users who have completed all onboarding steps.
  // The useEffect above handles navigation to dashboard.
  if (steps.length === 0 || !currentStep) {
    return null;
  }

  // Get navigation config with defaults
  const navigation = currentStep.meta.navigation ?? {};
  const showBack = navigation.showBack !== false && !isFirstStep;
  const showNext = navigation.hideContinue !== true;

  return (
    <OnboardingShell
      progressSlot={
        <ProgressIndicator steps={steps} currentIndex={currentIndex} />
      }
      navigationSlot={
        <NavigationButtons
          showBack={showBack}
          showNext={showNext}
          skipConfig={canSkip ? currentStep.meta.skip : undefined}
          nextLabel={navigation.continueLabel}
          backLabel={navigation.backLabel}
          nextDisabled={isNextDisabled}
          onBack={goToPrevious}
          onNext={goToNext}
          onSkip={handleSkip}
        />
      }
    >
      <currentStep.Content
        key={currentStep.meta.id}
        context={context}
        onAction={handleStepAction}
        isLoading={currentStep.meta.id === 'secure-storage' && waitingForDbInit}
      />
    </OnboardingShell>
  );
}

export default OnboardingFlow;
