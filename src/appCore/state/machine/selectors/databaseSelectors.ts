/**
 * Database State Selectors
 *
 * Pure selector functions for deriving database-related state from AppState.
 * These selectors enable hooks to query state machine state without
 * coupling to the specific state structure.
 *
 * @module appCore/state/machine/selectors/databaseSelectors
 */

import type { AppState } from "../types";

/**
 * Returns true if database is initialized.
 * In loading state, checks if we've passed the 'initializing-db' phase.
 *
 * Note: For first-time macOS users, DB init is deferred until the onboarding
 * secure-storage step. In this case, deferredDbInit flag is set and we
 * return false even though we're past the initializing-db phase.
 *
 * @param state - Current application state
 * @returns true if database is initialized
 *
 * @example
 * ```ts
 * const isDbReady = selectIsDatabaseInitialized(state);
 * if (!isDbReady) {
 *   // Show loading or wait for initialization
 * }
 * ```
 */
export function selectIsDatabaseInitialized(state: AppState): boolean {
  let result: boolean;
  switch (state.status) {
    case "loading":
      // For first-time macOS users, DB init is deferred - return false
      if (state.deferredDbInit) {
        result = false;
        break;
      }
      // DB is initialized if we're past the initializing-db phase
      result = !["checking-storage", "initializing-db"].includes(state.phase);
      break;
    case "ready":
      result = true;
      break;
    case "onboarding":
      // For first-time macOS users, DB init is deferred until secure-storage step
      if (state.deferredDbInit) {
        result = false;
        break;
      }
      result = true;
      break;
    case "unauthenticated":
      // For first-time macOS users, DB init is deferred
      if (state.deferredDbInit) {
        result = false;
        break;
      }
      result = false;
      break;
    case "error":
      result = false;
      break;
    default:
      result = false;
  }

  return result;
}

/**
 * Returns true if DB initialization was deferred for first-time macOS users.
 * When true, the DB will be initialized during the onboarding secure-storage step.
 *
 * This flag is preserved through state transitions:
 * loading -> unauthenticated -> onboarding
 *
 * @param state - Current application state
 * @returns true if DB init is deferred
 */
export function selectIsDeferredDbInit(state: AppState): boolean {
  switch (state.status) {
    case "loading":
      return state.deferredDbInit === true;
    case "unauthenticated":
      return state.deferredDbInit === true;
    case "onboarding":
      return state.deferredDbInit === true;
    default:
      return false;
  }
}

/**
 * Returns true if currently checking secure storage.
 * This is the first phase of initialization.
 *
 * @param state - Current application state
 * @returns true if currently in checking-storage phase
 */
export function selectIsCheckingSecureStorage(state: AppState): boolean {
  return state.status === "loading" && state.phase === "checking-storage";
}

/**
 * Returns true if currently initializing database.
 * This may trigger OS prompts on macOS for keychain access.
 *
 * @param state - Current application state
 * @returns true if currently in initializing-db phase
 */
export function selectIsInitializingDatabase(state: AppState): boolean {
  return state.status === "loading" && state.phase === "initializing-db";
}

/**
 * Returns true if currently loading authentication state.
 *
 * @param state - Current application state
 * @returns true if currently in loading-auth phase
 */
export function selectIsLoadingAuth(state: AppState): boolean {
  return state.status === "loading" && state.phase === "loading-auth";
}

/**
 * Returns true if currently loading user data.
 * This is the final phase before entering ready or onboarding state.
 *
 * @param state - Current application state
 * @returns true if currently in loading-user-data phase
 */
export function selectIsLoadingUserData(state: AppState): boolean {
  return state.status === "loading" && state.phase === "loading-user-data";
}
