/**
 * Windows Onboarding Flow Definition
 *
 * Defines the step order for Windows platform onboarding.
 * This flow includes Windows-specific steps like Apple Mobile Device driver setup.
 *
 * @module onboarding/flows/windowsFlow
 */

import type { OnboardingStepId, Platform } from "../types";

/**
 * The platform this flow is designed for.
 */
export const WINDOWS_PLATFORM: Platform = "windows";

/**
 * Ordered list of step IDs for the Windows onboarding flow.
 *
 * Flow order:
 * 1. phone-type - Select iPhone or Android
 * 2. email-connect - Connect email account (Google or Microsoft)
 * 3. apple-driver - Install Apple Mobile Device USB Driver (for iPhone users)
 */
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "email-connect",
  "apple-driver",
] as const;

/**
 * Windows flow configuration object.
 * Combines platform identifier with ordered step list.
 */
export const WINDOWS_FLOW = {
  platform: WINDOWS_PLATFORM,
  steps: WINDOWS_FLOW_STEPS,
} as const;
