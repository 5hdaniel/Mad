/**
 * Feature Flag Utilities
 *
 * Controls the rollout of the new state machine.
 * Supports multiple toggle methods for testing and rollback.
 *
 * Priority (highest first):
 * 1. URL parameter: ?newStateMachine=true|false
 * 2. localStorage: 'useNewStateMachine' = 'true' | 'false'
 * 3. Default: false (Phase 1 safety)
 *
 * @module appCore/state/machine/utils/featureFlags
 */

const STORAGE_KEY = "useNewStateMachine";
const URL_PARAM = "newStateMachine";

/**
 * Check if the new state machine is enabled.
 *
 * @returns true if new state machine should be used, false otherwise
 *
 * @example
 * ```ts
 * if (isNewStateMachineEnabled()) {
 *   // Use new state machine
 * } else {
 *   // Use legacy behavior
 * }
 * ```
 */
export function isNewStateMachineEnabled(): boolean {
  // URL param takes precedence (for testing)
  if (typeof window !== "undefined" && window.location) {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get(URL_PARAM);
    if (urlParam === "true") return true;
    if (urlParam === "false") return false;
  }

  // Check localStorage
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch {
      // localStorage may throw in some contexts (e.g., private browsing)
      // Fall through to default
    }
  }

  // Default: disabled in Phase 1 (safety)
  // Change to true in Phase 2 when ready for testing
  return false;
}

/**
 * Enable the new state machine.
 * Sets localStorage and optionally reloads the page.
 *
 * @param reload - Whether to reload the page after enabling (default: true)
 */
export function enableNewStateMachine(reload = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage may throw in some contexts
  }
  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Disable the new state machine (rollback).
 * Sets localStorage and optionally reloads the page.
 *
 * @param reload - Whether to reload the page after disabling (default: true)
 */
export function disableNewStateMachine(reload = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, "false");
  } catch {
    // localStorage may throw in some contexts
  }
  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Clear the feature flag (return to default behavior).
 *
 * @param reload - Whether to reload the page after clearing (default: false)
 */
export function clearStateMachineFlag(reload = false): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may throw in some contexts
  }
  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Get the current feature flag state as a string for debugging.
 *
 * @returns Object with source and value of the flag
 */
export function getFeatureFlagStatus(): {
  source: "url" | "localStorage" | "default";
  value: boolean;
} {
  // Check URL param first
  if (typeof window !== "undefined" && window.location) {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get(URL_PARAM);
    if (urlParam === "true") return { source: "url", value: true };
    if (urlParam === "false") return { source: "url", value: false };
  }

  // Check localStorage
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") return { source: "localStorage", value: true };
      if (stored === "false") return { source: "localStorage", value: false };
    } catch {
      // Fall through to default
    }
  }

  return { source: "default", value: false };
}
