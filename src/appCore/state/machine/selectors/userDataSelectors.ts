/**
 * User Data State Selectors
 *
 * Pure selector functions for deriving user-related state from AppState.
 * These selectors enable hooks to query onboarding progress and user
 * preferences without coupling to the specific state structure.
 *
 * @module appCore/state/machine/selectors/userDataSelectors
 */

import type { AppState, OnboardingStep } from "../types";

/**
 * Step order for comparison.
 * MUST match the order defined in types.ts and the reducer.
 */
const STEP_ORDER: OnboardingStep[] = [
  "phone-type",
  "secure-storage",
  "email-connect",
  "permissions",
  "apple-driver",
  "android-coming-soon",
];

/**
 * Get the index of a step in the order.
 * Returns -1 if step is not found (should not happen with valid steps).
 *
 * @param step - Onboarding step to find
 * @returns Index of the step, or -1 if not found
 */
function getStepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

/**
 * Returns current onboarding step, or null if not in onboarding.
 *
 * @param state - Current application state
 * @returns Current onboarding step, or null if not onboarding
 *
 * @example
 * ```ts
 * const step = selectCurrentOnboardingStep(state);
 * if (step === 'phone-type') {
 *   // Render phone type selection
 * }
 * ```
 */
export function selectCurrentOnboardingStep(
  state: AppState
): OnboardingStep | null {
  if (state.status !== "onboarding") {
    return null;
  }
  return state.step;
}

/**
 * Returns true if email onboarding is complete.
 * Email step is complete if we're past it or app is ready.
 *
 * @param state - Current application state
 * @returns true if email onboarding has been completed
 */
export function selectHasCompletedEmailOnboarding(state: AppState): boolean {
  if (state.status === "ready") {
    return true;
  }
  if (state.status === "onboarding") {
    // Check if we're past the email step
    const emailStepIndex = getStepIndex("email-connect");
    const currentIndex = getStepIndex(state.step);
    return currentIndex > emailStepIndex;
  }
  return false;
}

/**
 * Returns true if phone type has been selected.
 * Phone type is selected if we're past that step or app is ready.
 *
 * @param state - Current application state
 * @returns true if phone type has been selected
 */
export function selectHasSelectedPhoneType(state: AppState): boolean {
  if (state.status === "ready") {
    return true;
  }
  if (state.status === "onboarding") {
    const phoneTypeIndex = getStepIndex("phone-type");
    const currentIndex = getStepIndex(state.step);
    return currentIndex > phoneTypeIndex;
  }
  return false;
}

/**
 * Returns true if the given step has been completed.
 * A step is complete if we're past it in the onboarding flow or app is ready.
 *
 * @param state - Current application state
 * @param step - Step to check completion for
 * @returns true if the step has been completed
 */
export function selectIsStepComplete(
  state: AppState,
  step: OnboardingStep
): boolean {
  if (state.status === "ready") {
    return true;
  }
  if (state.status === "onboarding") {
    const targetIndex = getStepIndex(step);
    const currentIndex = getStepIndex(state.step);
    return currentIndex > targetIndex;
  }
  return false;
}

/**
 * Returns the list of completed onboarding steps.
 *
 * @param state - Current application state
 * @returns Array of completed steps, or empty array if not onboarding
 */
export function selectCompletedSteps(state: AppState): OnboardingStep[] {
  if (state.status === "onboarding") {
    return state.completedSteps;
  }
  if (state.status === "ready") {
    // All steps are complete when ready
    return [...STEP_ORDER];
  }
  return [];
}

/**
 * Returns the user's selected phone type.
 *
 * @param state - Current application state
 * @returns 'iphone', 'android', or null if not yet selected or not in a state with user data
 */
export function selectPhoneType(
  state: AppState
): "iphone" | "android" | null {
  if (state.status === "ready") {
    return state.userData.phoneType;
  }
  if (state.status === "onboarding") {
    // Use explicit selection from onboarding state if available
    // This is set when ONBOARDING_STEP_COMPLETE is dispatched with phoneType
    if (state.selectedPhoneType) {
      return state.selectedPhoneType;
    }
    // Fallback to platform detection (legacy behavior for states before phone-type step)
    if (state.platform) {
      return state.platform.hasIPhone ? "iphone" : null;
    }
  }
  return null;
}

/**
 * Returns true if user has an email connected.
 * Only available from ready state where userData exists.
 *
 * During onboarding, checks the hasEmailConnected flag on the onboarding state.
 * During loading, defaults to true to avoid flicker (matching legacy behavior).
 *
 * @param state - Current application state
 * @returns true if user has connected an email account
 */
export function selectHasEmailConnected(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasEmailConnected;
  }
  if (state.status === "onboarding") {
    // During onboarding, check if email was connected in this session
    return state.hasEmailConnected ?? false;
  }
  // Loading state - default true to avoid flicker (matching legacy behavior)
  return true;
}

/**
 * Returns true if user has macOS Full Disk Access permissions.
 * Only relevant for macOS; always false for other platforms or during loading.
 *
 * @param state - Current application state
 * @returns true if user has granted permissions
 */
export function selectHasPermissions(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  if (state.status === "onboarding") {
    // Check if permissions were loaded during initialization
    // This fixes the bug where returning users with FDA granted were stuck
    return state.hasPermissions ?? false;
  }
  return false;
}

// =============================================================================
// NULLABLE SELECTORS
// =============================================================================
// These selectors return `undefined` for unknown states instead of defensive
// values. Use these in step predicates where unknown should mean "show the step".
// See: Kent C. Dodds "Stop using isLoading booleans"

/**
 * Tri-state selector for email connection status.
 * Returns: true (connected), false (not connected), undefined (unknown/loading)
 *
 * Use this in step predicates: `emailConnected !== true` means show step
 * when either not connected OR unknown (loading).
 *
 * @param state - Current application state
 * @returns true, false, or undefined if state is unknown
 */
export function selectHasEmailConnectedNullable(
  state: AppState
): boolean | undefined {
  let result: boolean | undefined;

  if (state.status === "ready") {
    result = state.userData.hasEmailConnected;
  } else if (state.status === "onboarding") {
    result = state.hasEmailConnected ?? false;
  } else {
    // Loading/unauthenticated/error: state is unknown
    result = undefined;
  }

  console.log('[selectHasEmailConnectedNullable]', {
    status: state.status,
    'state.hasEmailConnected': state.status === 'onboarding' ? (state as any).hasEmailConnected : 'N/A',
    result,
  });

  return result;
}

/**
 * Tri-state selector for permissions status.
 * Returns: true (granted), false (not granted), undefined (unknown/loading)
 *
 * @param state - Current application state
 * @returns true, false, or undefined if state is unknown
 */
export function selectHasPermissionsNullable(
  state: AppState
): boolean | undefined {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  if (state.status === "onboarding") {
    return state.hasPermissions ?? undefined;
  }
  // Loading/unauthenticated/error: state is unknown
  return undefined;
}
