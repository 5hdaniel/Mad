/**
 * Onboarding Module
 *
 * Public exports for the new onboarding architecture.
 *
 * @module onboarding
 */

// Main orchestrator component
export { OnboardingFlow } from "./OnboardingFlow";
export type { OnboardingFlowProps } from "./OnboardingFlow";

// Types
export type {
  Platform,
  OnboardingStepId,
  SkipConfig,
  StepNavigationConfig,
  OnboardingStepMeta,
  OnboardingContext,
  StepAction,
  OnboardingStepContentProps,
  OnboardingStep,
} from "./types";

// Hooks
export {
  useOnboardingFlow,
  type UseOnboardingFlowOptions,
  type UseOnboardingFlowReturn,
  type OnboardingAppState,
} from "./hooks";

// Shell components
export { OnboardingShell } from "./shell/OnboardingShell";
export { ProgressIndicator } from "./shell/ProgressIndicator";
export { NavigationButtons } from "./shell/NavigationButtons";

// Flow utilities
export { getFlowSteps, getFlowForPlatform, FLOWS } from "./flows";

// Step registry
export { registerStep, getStep, getAllSteps, STEP_REGISTRY } from "./steps";
