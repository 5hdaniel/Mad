/**
 * Onboarding Step Architecture Type Definitions
 *
 * This file re-exports all types from the types/ directory for backwards compatibility.
 * New code should import directly from './types' (the directory barrel export).
 *
 * @module onboarding/types
 * @deprecated Import from './types' directory instead
 */

export type {
  // Core types
  Platform,
  OnboardingStepId,
  SkippableStepId,
  // Context
  OnboardingContext,
  // Actions
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
  StepAction,
  StepActionType,
  // Configuration
  SkipConfig,
  StepNavigationConfig,
  OnboardingStepMeta,
  // Components
  OnboardingStepContentProps,
  OnboardingStep,
  // Flows
  OnboardingStepRegistry,
  OnboardingFlowSequence,
  OnboardingFlowConfig,
  // State
  OnboardingPersistedState,
  // Hooks
  OnboardingOrchestratorProps,
  UseOnboardingFlowReturn,
} from "./types/index";
