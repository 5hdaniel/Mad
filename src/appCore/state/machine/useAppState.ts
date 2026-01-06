/**
 * App State Consumer Hooks
 *
 * Hooks for accessing app state machine from components.
 * The main useAppState hook provides full access, while selector hooks
 * provide convenient access to specific state slices.
 *
 * @module appCore/state/machine/useAppState
 */

import { useContext } from "react";
import { AppStateContext } from "./AppStateContext";
import type { AppStateContextValue } from "./types";

/**
 * Hook to access app state machine.
 * Must be used within AppStateProvider.
 *
 * @throws Error if used outside AppStateProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, dispatch, isReady, currentUser } = useAppState();
 *
 *   if (!isReady) return <Loading />;
 *   return <div>Hello, {currentUser?.email}</div>;
 * }
 * ```
 */
export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (context === null) {
    throw new Error(
      "useAppState must be used within an AppStateProvider. " +
        "Make sure your component is wrapped in <AppStateProvider>."
    );
  }

  return context;
}

/**
 * Selector hooks for specific state slices.
 * Use these for better performance when you only need specific data.
 *
 * Note: These hooks still re-render when ANY state changes because
 * they call useAppState() internally. For true selective subscriptions,
 * consider using an external state library (zustand, jotai) in the future.
 */

/**
 * Get the current app status.
 * @returns Current status: 'loading' | 'unauthenticated' | 'onboarding' | 'ready' | 'error'
 */
export function useAppStateStatus() {
  return useAppState().state.status;
}

/**
 * Get the current authenticated user.
 * @returns User object or null if not authenticated
 */
export function useCurrentUser() {
  return useAppState().currentUser;
}

/**
 * Get the current platform information.
 * @returns PlatformInfo object or null if not yet loaded
 */
export function usePlatform() {
  return useAppState().platform;
}

/**
 * Get the current loading phase.
 * @returns LoadingPhase or null if not in loading state
 */
export function useLoadingPhase() {
  return useAppState().loadingPhase;
}

/**
 * Get the current onboarding step.
 * @returns OnboardingStep or null if not in onboarding state
 */
export function useOnboardingStep() {
  return useAppState().onboardingStep;
}

/**
 * Get the current error.
 * @returns AppError or null if not in error state
 */
export function useAppError() {
  return useAppState().error;
}
