/**
 * Queue Builder
 *
 * Pure functions that build and query the onboarding step queue.
 * The queue is the single source of truth for step ordering and status.
 *
 * @module onboarding/queue/buildQueue
 */

import type { OnboardingContext, OnboardingStep } from "../types";
import type { Platform } from "../types";
import type { StepQueueEntry } from "./types";
import { getFlowSteps } from "../flows";
import logger from "../../../utils/logger";

/**
 * Determines if a step is applicable given the current context.
 * Uses the step's `isApplicable` predicate if defined, otherwise defaults to true.
 *
 * @param step - The step to check
 * @param context - Current onboarding context
 * @returns true if the step should be included in the queue
 */
function checkApplicable(step: OnboardingStep, context: OnboardingContext): boolean {
  if (step.meta.isApplicable) {
    return step.meta.isApplicable(context);
  }
  // Default: step is always applicable (platform filtering is done by flow arrays)
  return true;
}

/**
 * Determines if a step is complete given the current context.
 * Uses the step's `isComplete` predicate if defined, otherwise defaults to false.
 *
 * @param step - The step to check
 * @param context - Current onboarding context
 * @returns true if the step has been completed
 */
function checkComplete(step: OnboardingStep, context: OnboardingContext): boolean {
  if (step.meta.isComplete) {
    return step.meta.isComplete(context);
  }
  // Default: not complete (user must interact)
  return false;
}

/**
 * Builds the ordered onboarding queue from flow definitions and context.
 *
 * For each step in the platform's flow:
 * 1. Check `isApplicable(context)` → if false, mark `skipped`
 * 2. Check `isComplete(context)` → mark `complete` or `pending`
 * 3. First `pending` step becomes `active`
 *
 * @param platform - Current platform (determines flow order)
 * @param context - Current onboarding context
 * @returns Ordered array of queue entries
 */
export function buildOnboardingQueue(
  platform: Platform,
  context: OnboardingContext
): StepQueueEntry[] {
  let steps: OnboardingStep[];
  try {
    steps = getFlowSteps(platform);
  } catch {
    logger.error(`[Queue] Failed to get flow steps for platform: ${platform}`);
    return [];
  }

  let foundActive = false;
  const queue: StepQueueEntry[] = [];

  for (const step of steps) {
    const applicable = checkApplicable(step, context);

    if (!applicable) {
      queue.push({ step, status: "skipped", applicable: false });
      continue;
    }

    const complete = checkComplete(step, context);

    if (complete) {
      queue.push({ step, status: "complete", applicable: true });
    } else if (!foundActive) {
      queue.push({ step, status: "active", applicable: true });
      foundActive = true;
    } else {
      queue.push({ step, status: "pending", applicable: true });
    }
  }

  logger.debug(
    `%c[QUEUE] Built: ${queue
      .filter((e) => e.applicable)
      .map((e) => `${e.step.meta.id}(${e.status})`)
      .join(" → ")}`,
    "background: #2E8B57; color: white; font-weight: bold; padding: 2px 8px;"
  );

  return queue;
}

/**
 * Checks if the entire queue is complete (no pending or active entries).
 *
 * @param queue - The current queue
 * @returns true if all applicable steps are complete
 */
export function isQueueComplete(queue: StepQueueEntry[]): boolean {
  return queue.every((entry) => !entry.applicable || entry.status === "complete");
}

/**
 * Gets the active entry from the queue.
 *
 * @param queue - The current queue
 * @returns The active entry, or undefined if queue is complete
 */
export function getActiveEntry(queue: StepQueueEntry[]): StepQueueEntry | undefined {
  return queue.find((entry) => entry.status === "active");
}

/**
 * Gets only the applicable (visible) entries from the queue.
 * Filters out skipped/non-applicable steps.
 *
 * @param queue - The current queue
 * @returns Array of applicable queue entries
 */
export function getVisibleEntries(queue: StepQueueEntry[]): StepQueueEntry[] {
  return queue.filter((entry) => entry.applicable);
}
