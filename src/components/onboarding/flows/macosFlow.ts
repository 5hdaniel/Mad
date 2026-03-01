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
 * 2. secure-storage - Set up macOS Keychain for secure credential storage (DB init happens here)
 * 3. account-verification - Verify user exists in local DB (creates if missing, auto-retries on failure)
 * 4. contact-source - Select which contact sources to sync (macOS Contacts, Outlook)
 * 5. email-connect - Connect email account (Google or Microsoft) - DB and user are ready by this point
 * 6. data-sync - Sync checkpoint: pulls phone_type from Supabase to local DB before FDA step
 * 7. permissions - Grant required macOS permissions (Full Disk Access for Messages sync)
 */
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "secure-storage",
  "account-verification",
  "contact-source",
  "email-connect",
  "data-sync",
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
