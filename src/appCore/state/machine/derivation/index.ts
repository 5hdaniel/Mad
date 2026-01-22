/**
 * Derivation Module
 *
 * Barrel export for step and navigation derivation functions.
 * These pure functions derive navigation targets and onboarding progress
 * from state, enabling effect-free rendering logic.
 *
 * @module appCore/state/machine/derivation
 */

// Step derivation functions
export {
  STEP_ORDER,
  deriveCurrentStep,
  deriveNextStep,
  deriveFirstStep,
  shouldSkipStep,
  isStepComplete,
  getTotalSteps,
  getCurrentStepNumber,
  isLastStep,
} from "./stepDerivation";

// Navigation derivation functions and types
export type {
  NavigationScreen,
  NavigationTarget,
  NavigationParams,
} from "./navigationDerivation";
export {
  deriveNavigationTarget,
  deriveScreen,
  shouldShowOnboarding,
  isAppReady,
  isLoading,
  isError,
  isAuthenticated,
  isUnauthenticated,
  needsNavigation,
  deriveAppStep,
  derivePageTitle,
} from "./navigationDerivation";
