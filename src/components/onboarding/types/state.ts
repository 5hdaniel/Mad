/**
 * Onboarding State Machine Type Definitions
 *
 * Types for persistence and state management.
 *
 * @module onboarding/types/state
 */

import type { OnboardingContext } from "./context";
import type { OnboardingStepId } from "./steps";

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Serializable onboarding state for persistence.
 * Contains only the fields that should be saved/restored.
 */
export interface OnboardingPersistedState {
  /**
   * ID of the last completed step.
   */
  lastCompletedStepId: OnboardingStepId | null;

  /**
   * ID of the current step (where user left off).
   */
  currentStepId: OnboardingStepId;

  /**
   * The onboarding context at time of persistence.
   */
  context: OnboardingContext;

  /**
   * Timestamp of when state was persisted.
   */
  persistedAt: string;

  /**
   * Version number for migration compatibility.
   */
  version: number;
}
