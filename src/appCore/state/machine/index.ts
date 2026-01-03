/**
 * State Machine Module
 *
 * Barrel export for the unified state machine.
 * Exports types, reducer, context provider, and consumer hooks.
 *
 * @module appCore/state/machine
 */

export * from "./types";
export { appStateReducer, getNextOnboardingStep } from "./reducer";
export { AppStateProvider, AppStateContext } from "./AppStateContext";
export {
  useAppState,
  useAppStateStatus,
  useCurrentUser,
  usePlatform,
  useLoadingPhase,
  useOnboardingStep,
  useAppError,
} from "./useAppState";
