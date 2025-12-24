/**
 * OnboardingFlow Component
 *
 * Main orchestrator component for the new onboarding architecture.
 * Uses useOnboardingFlow hook and integrates with existing app state machine.
 *
 * @module onboarding/OnboardingFlow
 */

import React, { useCallback, useEffect, useRef } from "react";
import { useOnboardingFlow, type OnboardingAppState } from "./hooks";
import { OnboardingShell } from "./shell/OnboardingShell";
import { ProgressIndicator } from "./shell/ProgressIndicator";
import { NavigationButtons } from "./shell/NavigationButtons";
import type { AppStateMachine } from "../../appCore/state/types";
import type { StepAction } from "./types";

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
  // Build app state from state machine
  const appState: OnboardingAppState = {
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
  };


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

        case "NAVIGATE_NEXT":
        case "NAVIGATE_BACK":
        case "ONBOARDING_COMPLETE":
          // These are handled by the hook's internal navigation
          break;
      }
    },
    [app]
  );

  // Handle onboarding completion
  const handleComplete = useCallback(() => {
    app.goToStep("dashboard");
  }, [app]);

  // Map app's currentStep to onboarding step ID
  // This ensures the OnboardingFlow starts at the correct step based on routing
  const getInitialStepId = (): string | undefined => {
    const stepMap: Record<string, string> = {
      "phone-type-selection": "phone-type",
      "keychain-explanation": "secure-storage",
      "email-onboarding": "email-connect",
      "permissions": "permissions",
      "apple-driver-setup": "apple-driver",
      "android-coming-soon": "android-coming-soon",
    };
    return stepMap[app.currentStep];
  };

  // Initialize the hook
  const flow = useOnboardingFlow({
    appState,
    onAction: handleAction,
    onComplete: handleComplete,
    initialStepId: getInitialStepId(),
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

  // When all steps are filtered out (returning user with everything complete),
  // navigate to dashboard. This handles the case where a returning user's data
  // loads and all onboarding steps are already complete.
  // Track if we've already navigated to prevent infinite loops
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (steps.length === 0 && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      app.goToStep("dashboard");
    }
  }, [steps.length, app]);

  // Guard against no steps (shouldn't happen, but safety check)
  if (!currentStep) {
    return null;
  }

  // Get navigation config with defaults
  const navigation = currentStep.meta.navigation ?? {};
  const showBack = navigation.showBack !== false && !isFirstStep;
  const showNext = navigation.hideContinue !== true;

  // Action handler - flowHandleAction already calls onAction (which is handleAction)
  // so we just need to call flowHandleAction, not both
  const handleStepAction = useCallback(
    (action: StepAction) => {
      // flowHandleAction calls onAction internally, then handles navigation
      flowHandleAction(action);
    },
    [flowHandleAction]
  );

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
      />
    </OnboardingShell>
  );
}

export default OnboardingFlow;
