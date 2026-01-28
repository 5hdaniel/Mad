/**
 * macOS Onboarding Flow Definition
 *
 * Defines the step order for macOS platform onboarding.
 * This flow includes macOS-specific steps like secure storage (Keychain) setup.
 *
 * @module onboarding/flows/macosFlow
 */

import type { OnboardingStepId, Platform } from "../types";

/**
 * The platform this flow is designed for.
 */
export const MACOS_PLATFORM: Platform = "macos";

/**
 * Ordered list of step IDs for the macOS onboarding flow.
 *
 * Flow order:
 * 1. phone-type - Select iPhone or Android
 * 2. email-connect - Connect email account (Google or Microsoft)
 * 3. secure-storage - Set up macOS Keychain for secure credential storage (DB init happens here)
 * 4. permissions - Grant required macOS permissions (Full Disk Access)
 */
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "email-connect",
  "secure-storage",
  "permissions",
] as const;

/**
 * macOS flow configuration object.
 * Combines platform identifier with ordered step list.
 */
export const MACOS_FLOW = {
  platform: MACOS_PLATFORM,
  steps: MACOS_FLOW_STEPS,
} as const;
