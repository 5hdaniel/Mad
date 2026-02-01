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
 * 2. apple-driver - Install Apple Mobile Device USB Driver (for iPhone users, triggers DB init)
 * 3. email-connect - Connect email account (Google or Microsoft, DB is ready)
 *
 * Note: apple-driver is placed before email-connect to ensure database initialization
 * happens before email OAuth. For Android users, the apple-driver step is skipped
 * via shouldSkipStep() logic in stepDerivation.ts.
 */
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "apple-driver",
  "email-connect",
] as const;

/**
 * Windows flow configuration object.
 * Combines platform identifier with ordered step list.
 */
export const WINDOWS_FLOW = {
  platform: WINDOWS_PLATFORM,
  steps: WINDOWS_FLOW_STEPS,
} as const;
