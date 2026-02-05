/**
 * Onboarding Types - Barrel Export
 *
 * This file re-exports all onboarding types from their domain-specific modules.
 * Import from this file for backwards compatibility.
 *
 * @module onboarding/types
 */

// Core step and platform types
export type {
  Platform,
  OnboardingStepId,
  SkippableStepId,
} from "./steps";

// Context types
export type { OnboardingContext } from "./context";

// Action types
export type {
  SelectPhoneAction,
  ConnectEmailStartAction,
  EmailConnectedAction,
  EmailSkippedAction,
  PermissionGrantedAction,
  DriverSetupCompleteAction,
  DriverSkippedAction,
  TermsAcceptedAction,
  TermsDeclinedAction,
  SecureStorageSetupAction,
  NavigateNextAction,
  NavigateBackAction,
  OnboardingCompleteAction,
  GoBackSelectIphoneAction,
  ContinueEmailOnlyAction,
  UserVerifiedInLocalDbAction,
  StepAction,
  StepActionType,
} from "./actions";

// Configuration types
export type {
  SkipConfig,
  StepNavigationConfig,
  OnboardingStepMeta,
} from "./config";

// Component types
export type {
  OnboardingStepContentProps,
  OnboardingStep,
} from "./components";

// Flow types
export type {
  OnboardingStepRegistry,
  OnboardingFlowSequence,
  OnboardingFlowConfig,
} from "./flows";

// State/persistence types
export type { OnboardingPersistedState } from "./state";

// Hook types
export type {
  OnboardingOrchestratorProps,
  UseOnboardingFlowReturn,
} from "./hooks";
