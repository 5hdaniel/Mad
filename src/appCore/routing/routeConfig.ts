/**
 * Route Configuration
 *
 * Constants and utilities for routing configuration.
 * Extracted from AppRouter.tsx to reduce file size.
 */

import type { AppStep, OutlookExportResults, AppExportResult } from "../state/types";

/**
 * Feature flag for new onboarding architecture.
 * Set to true to use the new unified onboarding system.
 * Set to false to use the legacy per-screen components.
 */
export const USE_NEW_ONBOARDING = true;

/**
 * Steps that are part of the onboarding flow.
 */
export const ONBOARDING_STEPS: AppStep[] = [
  "phone-type-selection",
  "android-coming-soon",
  "email-onboarding",
  "keychain-explanation",
  "permissions",
  "apple-driver-setup",
];

/**
 * Check if the current step is an onboarding step that should use the new system.
 */
export function isOnboardingStep(step: string): boolean {
  return ONBOARDING_STEPS.includes(step as AppStep);
}

/**
 * Transform Outlook export results into the format expected by ExportComplete.
 */
export function transformOutlookResults(
  results: OutlookExportResults | null
): AppExportResult | null {
  if (!results) {
    return null;
  }
  return {
    exportPath: results.exportPath,
    results: results.results?.map((r) => ({
      contactName: r.contactName,
      success: r.success,
    })),
  };
}
