/**
 * State Machine Module
 *
 * Barrel export for the unified state machine.
 * Exports types and reducer for convenient importing.
 *
 * @module appCore/state/machine
 */

export * from "./types";
export { appStateReducer, getNextOnboardingStep } from "./reducer";
