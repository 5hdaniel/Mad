/**
 * Onboarding Flow Utilities
 *
 * Central module for platform-specific onboarding flows.
 * Provides flow retrieval and validation utilities.
 *
 * @module onboarding/flows
 */

import type { OnboardingStepId, Platform } from "../types";
import { getStep, STEP_REGISTRY } from "../steps";
import { MACOS_FLOW } from "./macosFlow";
import { WINDOWS_FLOW } from "./windowsFlow";

// =============================================================================
// FLOW REGISTRY
// =============================================================================

/**
 * Registry mapping platforms to their flow configurations.
 */
export const FLOWS: Record<Platform, { platform: Platform; steps: readonly OnboardingStepId[] }> = {
  macos: MACOS_FLOW,
  windows: WINDOWS_FLOW,
  linux: MACOS_FLOW, // Linux uses same flow as macOS for now
};

// =============================================================================
// FLOW RETRIEVAL
// =============================================================================

/**
 * Get the ordered list of step IDs for a given platform.
 *
 * @param platform - The platform to get the flow for
 * @returns Ordered array of step IDs for the platform
 * @throws Error if no flow is defined for the platform
 *
 * @example
 * ```ts
 * const macosSteps = getFlowForPlatform('macos');
 * // Returns: ['phone-type', 'secure-storage', 'email-connect', 'permissions']
 * ```
 */
export function getFlowForPlatform(platform: Platform): readonly OnboardingStepId[] {
  const flow = FLOWS[platform];

  if (!flow || flow.steps.length === 0) {
    throw new Error(
      `[Onboarding] No flow defined for platform: ${platform}. ` +
      `Available platforms: [${Object.keys(FLOWS).join(", ")}]`
    );
  }

  return flow.steps;
}

// =============================================================================
// FLOW VALIDATION
// =============================================================================

/**
 * Validate that all steps in a flow support the target platform.
 * This function should be called when steps are registered to ensure
 * flow configurations are valid.
 *
 * @param stepIds - Array of step IDs to validate
 * @param platform - The target platform
 * @throws Error if any step doesn't support the platform (with actionable message)
 *
 * @example
 * ```ts
 * // Validate macOS flow steps support macOS platform
 * validateFlowSteps(MACOS_FLOW_STEPS, 'macos');
 * ```
 */
export function validateFlowSteps(
  stepIds: readonly OnboardingStepId[],
  platform: Platform
): void {
  // Only validate in development mode
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Skip validation if no steps are registered yet
  if (Object.keys(STEP_REGISTRY).length === 0) {
    return;
  }

  for (const stepId of stepIds) {
    // Check if step is registered
    const step = STEP_REGISTRY[stepId];
    if (!step) {
      // Step not registered yet - skip validation
      // This allows flows to be defined before steps are implemented
      continue;
    }

    // Get platforms the step supports (empty/undefined means all platforms)
    const supportedPlatforms = step.meta.platforms;

    // If platforms is undefined or empty, step supports all platforms
    if (!supportedPlatforms || supportedPlatforms.length === 0) {
      continue;
    }

    // Check if step supports the target platform
    if (!supportedPlatforms.includes(platform)) {
      throw new Error(
        `[Onboarding] Step "${stepId}" does not support platform "${platform}". ` +
        `Supported platforms: [${supportedPlatforms.join(", ")}]. ` +
        `Either remove this step from the ${platform} flow, or add "${platform}" ` +
        `to the step's platforms array.`
      );
    }
  }
}

/**
 * Validate all registered flows at startup.
 * Call this during application initialization (development only)
 * to catch flow configuration errors early.
 *
 * @throws Error if any flow contains steps that don't support their platform
 *
 * @example
 * ```ts
 * // In app initialization
 * if (process.env.NODE_ENV === 'development') {
 *   validateAllFlows();
 * }
 * ```
 */
export function validateAllFlows(): void {
  // Only validate in development mode
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  for (const [platform, flow] of Object.entries(FLOWS)) {
    validateFlowSteps(flow.steps, platform as Platform);
  }
}

/**
 * Get the full OnboardingStep objects for a platform's flow.
 * This function retrieves registered steps and validates platform support.
 *
 * @param platform - The platform to get steps for
 * @returns Array of OnboardingStep objects in flow order
 * @throws Error if any step is not registered or doesn't support the platform
 *
 * @example
 * ```ts
 * const steps = getFlowSteps('macos');
 * // Returns array of OnboardingStep objects
 * ```
 */
export function getFlowSteps(platform: Platform) {
  const stepIds = getFlowForPlatform(platform);

  return stepIds.map((stepId) => {
    const step = getStep(stepId);

    // Validate platform support in development
    if (process.env.NODE_ENV === "development") {
      const supportedPlatforms = step.meta.platforms;

      // If platforms is defined and non-empty, check support
      if (supportedPlatforms && supportedPlatforms.length > 0) {
        if (!supportedPlatforms.includes(platform)) {
          throw new Error(
            `[Onboarding] Step "${stepId}" does not support platform "${platform}". ` +
            `Supported platforms: [${supportedPlatforms.join(", ")}]. ` +
            `Either remove this step from the ${platform} flow, or add "${platform}" ` +
            `to the step's platforms array.`
          );
        }
      }
    }

    return step;
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export flow definitions
export { MACOS_FLOW, MACOS_FLOW_STEPS, MACOS_PLATFORM } from "./macosFlow";
export { WINDOWS_FLOW, WINDOWS_FLOW_STEPS, WINDOWS_PLATFORM } from "./windowsFlow";
