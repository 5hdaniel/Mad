/**
 * Onboarding Queue Type Definitions
 *
 * Types for the single-queue onboarding architecture.
 * The queue replaces the dual-authority system (reducer + flow engine)
 * with a single ordered list that determines step progression.
 *
 * @module onboarding/queue/types
 */

import type { OnboardingStep } from "../types";

/**
 * Status of a step in the queue.
 * - pending: Not yet reached
 * - active: Currently displayed
 * - complete: User has finished this step
 * - skipped: Not applicable for current context
 */
export type StepStatus = "pending" | "active" | "complete" | "skipped";

/**
 * A single entry in the onboarding queue.
 * Wraps an OnboardingStep with queue-specific status info.
 */
export interface StepQueueEntry {
  /** The underlying step definition (component + meta) */
  step: OnboardingStep;
  /** Current status in the queue */
  status: StepStatus;
  /** Whether this step is applicable given current context */
  applicable: boolean;
}
