/**
 * Onboarding Step Type Definitions
 *
 * Core step identifiers and platform types for the onboarding system.
 *
 * @module onboarding/types/steps
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Supported platform identifiers for the application.
 * Used to determine which onboarding steps are relevant for the current platform.
 */
export type Platform = "macos" | "windows" | "linux";

/**
 * Unique identifiers for each onboarding step.
 * These IDs are used for step navigation, persistence, and configuration lookup.
 */
export type OnboardingStepId =
  | "welcome"
  | "terms"
  | "phone-type"
  | "android-coming-soon"
  | "secure-storage"
  | "driver-setup"
  | "apple-driver"
  | "email-connect"
  | "permissions"
  | "complete";

/**
 * Extract step IDs that match certain criteria.
 * Useful for type-safe step filtering.
 */
export type SkippableStepId = Extract<
  OnboardingStepId,
  "email-connect" | "driver-setup"
>;
