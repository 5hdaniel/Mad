/**
 * App State Context Provider
 *
 * React context provider that wraps the state machine reducer,
 * providing type-safe access to app state throughout the component tree.
 *
 * @module appCore/state/machine/AppStateContext
 */

import React, { createContext, useReducer, useMemo } from "react";
import { appStateReducer } from "./reducer";
import {
  INITIAL_APP_STATE,
  type AppStateContextValue,
  type AppState,
  type AppAction,
} from "./types";

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface AppStateProviderProps {
  children: React.ReactNode;
  /** Optional initial state for testing */
  initialState?: AppState;
}

/**
 * Provider component for the app state machine.
 * Wraps children with state context and provides memoized derived values.
 *
 * @example
 * ```tsx
 * <AppStateProvider>
 *   <App />
 * </AppStateProvider>
 * ```
 *
 * @example Testing with initial state
 * ```tsx
 * <AppStateProvider initialState={{ status: 'ready', ... }}>
 *   <ComponentUnderTest />
 * </AppStateProvider>
 * ```
 */
export function AppStateProvider({
  children,
  initialState = INITIAL_APP_STATE,
}: AppStateProviderProps) {
  const [state, rawDispatch] = useReducer(appStateReducer, initialState);

  // Cast dispatch to accept AppAction (the reducer accepts both AppAction
  // and extended actions with additional context for orchestrator usage)
  const dispatch = rawDispatch as React.Dispatch<AppAction>;

  // Derive commonly-needed values with memoization
  const value = useMemo<AppStateContextValue>(() => {
    // Derived selectors
    const isLoading = state.status === "loading";
    const isReady = state.status === "ready";

    const currentUser =
      state.status === "ready"
        ? state.user
        : state.status === "onboarding"
          ? state.user
          : null;

    const platform =
      state.status === "ready"
        ? state.platform
        : state.status === "onboarding"
          ? state.platform
          : null;

    const loadingPhase = state.status === "loading" ? state.phase : null;

    const onboardingStep = state.status === "onboarding" ? state.step : null;

    const error = state.status === "error" ? state.error : null;

    return {
      state,
      dispatch,
      isLoading,
      isReady,
      currentUser,
      platform,
      loadingPhase,
      onboardingStep,
      error,
    };
  }, [state]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

// Export context for testing
export { AppStateContext };
