/**
 * OnboardingFlow Component
 *
 * Main orchestrator component for onboarding.
 * Uses the queue-based architecture (useOnboardingQueue) as the single source
 * of truth for step ordering and progression.
 *
 * @module onboarding/OnboardingFlow
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnboardingQueue, type OnboardingAppState } from "./queue/useOnboardingQueue";
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
import { logAllFlags, logStateChange } from "../../appCore/state/machine/debug";
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
 * Uses the queue-based step architecture for single-source-of-truth ordering.
 * Maps StepActions to existing app handlers and manages navigation.
 */
export function OnboardingFlow({ app }: OnboardingFlowProps) {
  // Access state machine state when feature flag is enabled
  const machineState = useOptionalMachineState();

  // LOADING GATE: Don't render until state machine has finished loading
  if (!machineState || machineState.state.status === "loading") {
    return null;
  }

  // Early exit if state machine is already in "ready" state
  if (machineState.state.status === "ready") {
    return null;
  }

  // Track if we're waiting for DB init to complete after clicking Continue on secure-storage
  const [waitingForDbInit, setWaitingForDbInit] = useState(false);

  // Track if user has been verified in local DB (set by account-verification step)
  const [isUserVerifiedInLocalDb, setIsUserVerifiedInLocalDb] = useState(false);

  // Build app state, deriving from state machine when available
  const appState: OnboardingAppState = useMemo(() => {
    if (machineState) {
      const { state } = machineState;
      const isDatabaseInitialized = selectIsDatabaseInitialized(state);
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

  // Action handler that maps StepActions to existing app handlers
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
          if (!appState.isDatabaseInitialized) {
            setWaitingForDbInit(true);
          }
          app.handleKeychainExplanationContinue();
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
          setIsUserVerifiedInLocalDb(true);
          break;

        case "NAVIGATE_NEXT":
        case "NAVIGATE_BACK":
        case "ONBOARDING_COMPLETE":
          // These are handled by the queue hook's internal navigation
          break;
      }
    },
    [app, appState.isDatabaseInitialized]
  );

  // Handle onboarding completion - dispatches ONBOARDING_QUEUE_DONE
  const handleComplete = useCallback(() => {
    if (!machineState || machineState.state.status !== "onboarding") return;

    const { state, dispatch } = machineState;

    // Dispatch any remaining step completions for the state machine
    const completed = state.completedSteps;

    if (!completed.includes("phone-type") && appState.phoneType) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: appState.phoneType,
      });
    }

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

    // email-connect: the critical blocking step
    if (!completed.includes("email-connect")) {
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "email-connect",
      });
      app.handleEmailOnboardingComplete().catch((err: unknown) => {
        logger.error("[OnboardingFlow] Failed to persist email onboarding:", err);
      });
    }

    // Finally dispatch queue done to transition to ready
    dispatch({ type: "ONBOARDING_QUEUE_DONE" });
  }, [machineState, appState, app]);

  // Initialize the queue hook
  const queue = useOnboardingQueue({
    appState,
    onAction: handleAction,
    onComplete: handleComplete,
  });

  const {
    visibleEntries,
    activeEntry,
    activeStep,
    currentIndex,
    isComplete,
    context,
    goToNext,
    goToPrevious,
    handleAction: queueHandleAction,
    handleSkip,
    isFirstStep,
    canSkip,
    isNextDisabled,
  } = queue;

  // Action handler - queueHandleAction already calls onAction (which is handleAction)
  const handleStepAction = useCallback(
    (action: StepAction) => {
      queueHandleAction(action);
    },
    [queueHandleAction]
  );

  // When DB becomes initialized while we're waiting (after SECURE_STORAGE_SETUP),
  // clear the waiting flag. The queue auto-rebuilds when context changes.
  useEffect(() => {
    if (waitingForDbInit && appState.isDatabaseInitialized) {
      logStateChange('OnboardingFlow', 'DB_INIT_COMPLETE - clearing waitingForDbInit', {
        waitingForDbInit,
        isDatabaseInitialized: appState.isDatabaseInitialized,
        emailConnected: appState.emailConnected,
        hasPermissions: appState.hasPermissions,
        activeStepId: activeStep?.meta?.id,
        visibleSteps: visibleEntries.map(e => e.step.meta.id),
      });
      setWaitingForDbInit(false);
    }
  }, [waitingForDbInit, appState.isDatabaseInitialized, appState.emailConnected, appState.hasPermissions, activeStep, visibleEntries]);

  // When queue reports complete but state machine is still in onboarding,
  // trigger completion
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (isComplete && !hasNavigatedRef.current && machineState) {
      hasNavigatedRef.current = true;
      handleComplete();
    }
  }, [isComplete, machineState, handleComplete]);

  // Return null when no steps or no active step - prevents flicker
  if (visibleEntries.length === 0 || !activeEntry || !activeStep) {
    return null;
  }

  // Get navigation config with defaults
  const navigation = activeStep.meta.navigation ?? {};
  const showBack = navigation.showBack !== false && !isFirstStep;
  const showNext = navigation.hideContinue !== true;

  return (
    <OnboardingShell
      progressSlot={
        <ProgressIndicator
          steps={visibleEntries.map(e => e.step)}
          currentIndex={currentIndex}
        />
      }
      navigationSlot={
        <NavigationButtons
          showBack={showBack}
          showNext={showNext}
          skipConfig={canSkip ? activeStep.meta.skip : undefined}
          nextLabel={navigation.continueLabel}
          backLabel={navigation.backLabel}
          nextDisabled={isNextDisabled}
          onBack={goToPrevious}
          onNext={goToNext}
          onSkip={handleSkip}
        />
      }
    >
      <activeStep.Content
        key={activeStep.meta.id}
        context={context}
        onAction={handleStepAction}
        isLoading={activeStep.meta.id === 'secure-storage' && waitingForDbInit}
      />
    </OnboardingShell>
  );
}

export default OnboardingFlow;
