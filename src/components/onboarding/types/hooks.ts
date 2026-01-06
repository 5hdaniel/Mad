/**
 * Onboarding Hook Type Definitions
 *
 * Types for onboarding hooks and orchestrator components.
 *
 * @module onboarding/types/hooks
 */

import type { StepAction } from "./actions";
import type { OnboardingStepMeta } from "./config";
import type { OnboardingContext } from "./context";
import type { OnboardingFlowConfig } from "./flows";
import type { OnboardingPersistedState } from "./state";
import type { OnboardingStepId } from "./steps";

// =============================================================================
// ORCHESTRATOR & HOOKS
// =============================================================================

/**
 * Props for the main onboarding orchestrator component.
 */
export interface OnboardingOrchestratorProps {
  /**
   * Configuration for the onboarding flow.
   */
  config: OnboardingFlowConfig;

  /**
   * Optional initial context overrides.
   */
  initialContext?: Partial<OnboardingContext>;

  /**
   * Callback when onboarding is fully completed.
   */
  onComplete: () => void;

  /**
   * Optional callback for step changes.
   */
  onStepChange?: (stepId: OnboardingStepId, context: OnboardingContext) => void;

  /**
   * Optional callback to persist state.
   */
  onPersist?: (state: OnboardingPersistedState) => void;
}

/**
 * Return type for the useOnboardingFlow hook.
 */
export interface UseOnboardingFlowReturn {
  /**
   * Current step metadata.
   */
  currentStep: OnboardingStepMeta;

  /**
   * Current step index in the flow sequence.
   */
  currentStepIndex: number;

  /**
   * Total number of steps in the flow.
   */
  totalSteps: number;

  /**
   * The current onboarding context.
   */
  context: OnboardingContext;

  /**
   * Whether currently on the first step.
   */
  isFirstStep: boolean;

  /**
   * Whether currently on the last step.
   */
  isLastStep: boolean;

  /**
   * Navigate to the next step.
   */
  goNext: () => void;

  /**
   * Navigate to the previous step.
   */
  goBack: () => void;

  /**
   * Navigate to a specific step by ID.
   */
  goToStep: (stepId: OnboardingStepId) => void;

  /**
   * Dispatch an action to update context.
   */
  dispatch: (action: StepAction) => void;

  /**
   * List of visible steps based on current context.
   */
  visibleSteps: OnboardingStepMeta[];
}
