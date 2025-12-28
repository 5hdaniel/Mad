/**
 * Onboarding Flow Type Definitions
 *
 * Types for flow configuration and registry.
 *
 * @module onboarding/types/flows
 */

import type { OnboardingStep } from "./components";
import type { OnboardingContext } from "./context";
import type { OnboardingStepId } from "./steps";

// =============================================================================
// REGISTRY & CONFIGURATION
// =============================================================================

/**
 * Registry of all onboarding steps keyed by their ID.
 * Used for step lookup and iteration.
 */
export type OnboardingStepRegistry = Record<OnboardingStepId, OnboardingStep>;

/**
 * Ordered list of step IDs defining the default flow sequence.
 * The actual steps shown may vary based on platform and context.
 */
export type OnboardingFlowSequence = readonly OnboardingStepId[];

/**
 * Configuration for the entire onboarding flow.
 */
export interface OnboardingFlowConfig {
  /**
   * Registry of all available steps.
   */
  steps: OnboardingStepRegistry;

  /**
   * Default sequence of steps (may be filtered based on context).
   */
  defaultSequence: OnboardingFlowSequence;

  /**
   * Initial context values for new onboarding flows.
   */
  initialContext: Partial<OnboardingContext>;
}
