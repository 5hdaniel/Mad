/**
 * Onboarding Step Component Type Definitions
 *
 * Props and component types for step rendering.
 *
 * @module onboarding/types/components
 */

import type { ComponentType } from "react";
import type { StepAction } from "./actions";
import type { OnboardingStepMeta } from "./config";
import type { OnboardingContext } from "./context";

// =============================================================================
// STEP COMPONENTS
// =============================================================================

/**
 * Props passed to all onboarding step content components.
 * Provides access to context and action dispatch.
 */
export interface OnboardingStepContentProps {
  /**
   * The current onboarding context with all state.
   * Use this to conditionally render UI based on previous selections.
   */
  context: OnboardingContext;

  /**
   * Dispatch function to trigger step actions.
   * Call this when user interactions require state changes or navigation.
   *
   * @param action - The action to dispatch
   *
   * @example
   * onAction({ type: 'SELECT_PHONE', payload: { phoneType: 'iphone' } })
   */
  onAction: (action: StepAction) => void;
}

/**
 * Complete onboarding step definition.
 * Combines metadata configuration with the content component.
 */
export interface OnboardingStep {
  /**
   * Step metadata defining behavior and configuration.
   */
  meta: OnboardingStepMeta;

  /**
   * React component that renders the step content.
   * Receives context and action dispatch as props.
   */
  Content: ComponentType<OnboardingStepContentProps>;
}
