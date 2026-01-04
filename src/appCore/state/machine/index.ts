/**
 * State Machine Module
 *
 * Barrel export for the unified state machine.
 * Exports types, reducer, context provider, consumer hooks, and feature flags.
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

// Orchestrator and UI components
export { LoadingOrchestrator } from "./LoadingOrchestrator";
export { LoadingScreen } from "./components/LoadingScreen";
export { ErrorScreen } from "./components/ErrorScreen";

// Feature flag exports
export {
  FeatureFlaggedProvider,
  StateMachineDebugPanel,
  useNewStateMachine,
} from "./FeatureFlag";
export {
  isNewStateMachineEnabled,
  enableNewStateMachine,
  disableNewStateMachine,
  clearStateMachineFlag,
  getFeatureFlagStatus,
} from "./utils/featureFlags";
