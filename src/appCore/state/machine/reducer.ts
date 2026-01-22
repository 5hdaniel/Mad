/**
 * State Machine Reducer
 *
 * Core reducer for the unified state machine. Handles all state transitions
 * in a pure, predictable manner. This replaces the fragmented hook-based
 * state coordination (BACKLOG-142).
 *
 * @module appCore/state/machine/reducer
 */

import type {
  AppState,
  AppAction,
  LoadingState,
  OnboardingState,
  ReadyState,
  OnboardingStep,
  PlatformInfo,
  User,
  UserData,
  LoginSuccessAction,
} from "./types";
import { INITIAL_APP_STATE } from "./types";

// ============================================
// EXTENDED ACTION TYPES (for reducer context)
// ============================================

/**
 * Extended UserDataLoadedAction that includes context needed for transitions.
 * The orchestrator should provide user and platform when dispatching.
 */
interface UserDataLoadedWithContext {
  type: "USER_DATA_LOADED";
  data: UserData;
  /** User from previous AUTH_LOADED - required for state transition */
  user: User;
  /** Platform from previous AUTH_LOADED - required for state transition */
  platform: PlatformInfo;
}

/**
 * Union type for actions that the reducer can handle with full context.
 */
type AppActionWithContext = Exclude<AppAction, { type: "USER_DATA_LOADED" }> | UserDataLoadedWithContext | LoginSuccessAction;

// ============================================
// ONBOARDING STEP PROGRESSION
// ============================================

/**
 * Determines the next onboarding step based on completed steps,
 * platform info, and user data.
 *
 * Step order:
 * 1. phone-type - Always first (select iPhone/Android)
 * 2. secure-storage - macOS only (keychain explanation)
 * 3. email-connect - Email connection/onboarding
 * 4. permissions - macOS only (Full Disk Access)
 * 5. apple-driver - Windows + iPhone only (driver setup)
 *
 * @param completed - Array of already completed steps
 * @param platform - Platform information
 * @param userData - User preferences and completion state
 * @returns The next step to show, or null if all complete
 */
export function getNextOnboardingStep(
  completed: OnboardingStep[],
  platform: PlatformInfo,
  userData: UserData
): OnboardingStep | null {
  // Define step order with conditional inclusion
  const steps: OnboardingStep[] = [];

  // 1. Phone type selection is always first
  steps.push("phone-type");

  // 2. macOS secure storage explanation
  if (platform.isMacOS) {
    steps.push("secure-storage");
  }

  // 3. Email connection
  steps.push("email-connect");

  // 4. macOS permissions (if not already granted)
  if (platform.isMacOS && !userData.hasPermissions) {
    steps.push("permissions");
  }

  // 5. Windows + iPhone driver setup (if needed)
  if (platform.isWindows && platform.hasIPhone && userData.needsDriverSetup) {
    steps.push("apple-driver");
  }

  // Find first uncompleted step
  for (const step of steps) {
    if (!completed.includes(step)) {
      return step;
    }
  }

  return null; // All steps complete
}

/**
 * Checks if onboarding is complete based on user data.
 * Onboarding is complete when email onboarding is done and
 * platform-specific requirements are met.
 */
function isOnboardingComplete(userData: UserData, platform: PlatformInfo): boolean {
  // Must have completed email onboarding
  if (!userData.hasCompletedEmailOnboarding) {
    return false;
  }

  // Must have phone type selected
  if (!userData.phoneType) {
    return false;
  }

  // macOS must have permissions
  if (platform.isMacOS && !userData.hasPermissions) {
    return false;
  }

  // Windows + iPhone must not need driver setup
  if (platform.isWindows && platform.hasIPhone && userData.needsDriverSetup) {
    return false;
  }

  return true;
}

// ============================================
// REDUCER
// ============================================

/**
 * Core reducer for app state machine.
 * All state transitions are explicit and predictable.
 *
 * Key principles:
 * - Pure function: no side effects
 * - Invalid transitions return current state unchanged
 * - Error states track previousState for retry functionality
 *
 * @param state - Current application state
 * @param action - Action to process
 * @returns New application state
 */
export function appStateReducer(
  state: AppState,
  action: AppActionWithContext
): AppState {
  switch (action.type) {
    // ============================================
    // LOADING PHASE TRANSITIONS
    // ============================================

    case "STORAGE_CHECKED": {
      // Only valid from initial loading state
      if (state.status !== "loading" || state.phase !== "checking-storage") {
        return state; // Invalid transition
      }

      if (action.hasKeyStore) {
        // Key store exists, proceed to initialize DB
        return {
          status: "loading",
          phase: "initializing-db",
        };
      } else {
        // No key store - still need to initialize (will create one)
        // For new installs, we still go through db init
        return {
          status: "loading",
          phase: "initializing-db",
        };
      }
    }

    case "DB_INIT_STARTED": {
      // Progress indicator - valid during initializing-db phase
      if (state.status !== "loading" || state.phase !== "initializing-db") {
        return state;
      }
      return { ...state, progress: 0 };
    }

    case "DB_INIT_COMPLETE": {
      if (state.status !== "loading" || state.phase !== "initializing-db") {
        return state;
      }

      if (!action.success) {
        // DB initialization failed - transition to error state
        return {
          status: "error",
          error: {
            code: "DB_INIT_FAILED",
            message: action.error || "Failed to initialize database",
          },
          recoverable: true,
          previousState: state,
        };
      }

      // Success - proceed to load auth
      return {
        status: "loading",
        phase: "loading-auth",
      };
    }

    case "AUTH_LOADED": {
      if (state.status !== "loading" || state.phase !== "loading-auth") {
        return state;
      }

      if (!action.user) {
        // No authenticated user
        return { status: "unauthenticated" };
      }

      if (action.isNewUser) {
        // New user - start onboarding immediately
        // For new users, we don't need to load user data first
        const firstStep = getNextOnboardingStep([], action.platform, {
          phoneType: null,
          hasCompletedEmailOnboarding: false,
          hasEmailConnected: false,
          needsDriverSetup: true, // Assume needed until checked
          hasPermissions: false,
        });

        return {
          status: "onboarding",
          step: firstStep || "phone-type", // Default to phone-type if null
          user: action.user,
          platform: action.platform,
          completedSteps: [],
        };
      }

      // Returning user - need to load their data
      return {
        status: "loading",
        phase: "loading-user-data",
      };
    }

    // ============================================
    // LOGIN_SUCCESS - Fresh login from unauthenticated state
    // ============================================

    case "LOGIN_SUCCESS": {
      // Only valid from unauthenticated state
      if (state.status !== "unauthenticated") {
        return state; // Invalid transition
      }

      if (action.isNewUser) {
        // New user - start onboarding immediately
        const firstStep = getNextOnboardingStep([], action.platform, {
          phoneType: null,
          hasCompletedEmailOnboarding: false,
          hasEmailConnected: false,
          needsDriverSetup: true, // Assume needed until checked
          hasPermissions: false,
        });

        return {
          status: "onboarding",
          step: firstStep || "phone-type", // Default to phone-type if null
          user: action.user,
          platform: action.platform,
          completedSteps: [],
        };
      }

      // Returning user - need to load their data
      // Store user/platform in loading state for Phase 4 to use
      return {
        status: "loading",
        phase: "loading-user-data",
        progress: 75, // Skip phases 1-3, go directly to user data loading
        user: action.user,
        platform: action.platform,
      };
    }

    case "USER_DATA_LOADED": {
      if (state.status !== "loading" || state.phase !== "loading-user-data") {
        return state;
      }

      // User and platform context can come from:
      // 1. Action (app restart flow via authDataRef in LoadingOrchestrator)
      // 2. State (fresh login flow via LOGIN_SUCCESS)
      const actionWithContext = action as UserDataLoadedWithContext;
      const loadingState = state as LoadingState;

      const user = actionWithContext.user || loadingState.user;
      const platform = actionWithContext.platform || loadingState.platform;
      const { data } = actionWithContext;

      // Check if user and platform are provided
      if (!user || !platform) {
        // Missing context - this is a programming error
        // Return to checking-storage to restart the flow
        return {
          status: "error",
          error: {
            code: "USER_DATA_FAILED",
            message: "Missing user or platform context in USER_DATA_LOADED action",
          },
          recoverable: true,
          previousState: state,
        };
      }

      // Determine if onboarding is complete
      if (isOnboardingComplete(data, platform)) {
        // All onboarding complete - go to ready state
        return {
          status: "ready",
          user,
          platform,
          userData: data,
        };
      }

      // Need to complete onboarding
      // Determine which steps are already complete based on userData
      const completedSteps: OnboardingStep[] = [];

      if (data.phoneType) {
        completedSteps.push("phone-type");
      }

      if (data.hasCompletedEmailOnboarding) {
        completedSteps.push("email-connect");
      }

      if (platform.isMacOS && data.hasPermissions) {
        completedSteps.push("permissions");
        completedSteps.push("secure-storage"); // Implied complete if they got past it
      }

      if (platform.isWindows && platform.hasIPhone && !data.needsDriverSetup) {
        completedSteps.push("apple-driver");
      }

      const nextStep = getNextOnboardingStep(completedSteps, platform, data);

      return {
        status: "onboarding",
        step: nextStep || "phone-type", // Fallback shouldn't happen
        user,
        platform,
        completedSteps,
        // Preserve hasPermissions from loaded data so selector can access it
        // Fixes bug where users with FDA granted were stuck on permissions step
        hasPermissions: data.hasPermissions,
      };
    }

    // ============================================
    // ONBOARDING TRANSITIONS
    // ============================================

    case "ONBOARDING_STEP_COMPLETE": {
      console.log("[Reducer] ONBOARDING_STEP_COMPLETE received:", action.step, "current state:", state.status);
      if (state.status !== "onboarding") {
        console.log("[Reducer] Not in onboarding state, returning unchanged");
        return state;
      }

      // When completing a step, ensure all preceding steps are also marked complete
      // This handles the case where the UI navigates through steps without explicitly completing each one
      let completedSteps = state.completedSteps.includes(action.step)
        ? state.completedSteps
        : [...state.completedSteps, action.step];

      // If completing permissions on macOS, mark all preceding steps as complete
      // (you can't get to permissions without going through phone-type, secure-storage, email-connect)
      if (action.step === "permissions") {
        const precedingSteps: OnboardingStep[] = ["phone-type", "email-connect"];
        if (state.platform.isMacOS) {
          precedingSteps.push("secure-storage");
        }
        for (const step of precedingSteps) {
          if (!completedSteps.includes(step)) {
            completedSteps = [...completedSteps, step];
          }
        }
      }
      console.log("[Reducer] completedSteps after adding:", completedSteps);

      // Determine user data state based on completed steps
      const userData: UserData = {
        phoneType: completedSteps.includes("phone-type")
          ? (state.platform.hasIPhone ? "iphone" : "android")
          : null,
        hasCompletedEmailOnboarding: completedSteps.includes("email-connect"),
        hasEmailConnected: state.hasEmailConnected ?? false,
        needsDriverSetup:
          state.platform.isWindows &&
          state.platform.hasIPhone &&
          !completedSteps.includes("apple-driver"),
        hasPermissions:
          !state.platform.isMacOS || completedSteps.includes("permissions"),
      };

      const nextStep = getNextOnboardingStep(
        completedSteps,
        state.platform,
        userData
      );
      console.log("[Reducer] nextStep from getNextOnboardingStep:", nextStep, "platform:", state.platform, "userData:", userData);

      if (!nextStep) {
        // All onboarding complete - transition to ready
        console.log("[Reducer] No next step - transitioning to READY");
        return {
          status: "ready",
          user: state.user,
          platform: state.platform,
          userData,
        };
      }
      console.log("[Reducer] More steps to go, staying in onboarding with step:", nextStep);

      // Continue to next step
      return {
        ...state,
        step: nextStep,
        completedSteps,
      };
    }

    case "ONBOARDING_SKIP": {
      if (state.status !== "onboarding") {
        return state;
      }

      // Skipping is treated the same as completing for navigation
      // The actual skip behavior (what data gets stored) is handled by orchestrator
      return appStateReducer(state, {
        type: "ONBOARDING_STEP_COMPLETE",
        step: action.step,
      });
    }

    case "EMAIL_CONNECTED": {
      if (state.status !== "onboarding") {
        return state;
      }

      // Update onboarding state to track that email was connected
      return {
        ...state,
        hasEmailConnected: true,
      };
    }

    // ============================================
    // READY STATE TRANSITIONS
    // ============================================

    case "APP_READY": {
      // This is a no-op if already ready
      // It's used to explicitly signal readiness from other states
      if (state.status === "ready") {
        return state;
      }

      // APP_READY can only be dispatched when already in a terminal state
      // Other states should transition through proper actions
      return state;
    }

    case "START_EMAIL_SETUP": {
      // Only valid from ready state - allows user to connect email after initial onboarding
      if (state.status !== "ready") {
        return state;
      }

      // Transition back to onboarding with email-connect step
      // Preserve user data except mark email onboarding as incomplete
      return {
        status: "onboarding",
        step: "email-connect",
        user: state.user,
        platform: state.platform,
        // Mark all steps before email-connect as complete
        completedSteps: ["phone-type", ...(state.platform.isMacOS ? ["secure-storage" as const] : [])],
        // Preserve email connected state if they already have it (shouldn't happen, but be safe)
        hasEmailConnected: state.userData.hasEmailConnected,
        hasPermissions: state.userData.hasPermissions,
      };
    }

    // ============================================
    // LOGOUT
    // ============================================

    case "LOGOUT": {
      // Logout works from any state
      return { status: "unauthenticated" };
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    case "ERROR": {
      // Any state can transition to error
      return {
        status: "error",
        error: action.error,
        recoverable: action.recoverable ?? false,
        previousState: state,
      };
    }

    case "RETRY": {
      if (state.status !== "error") {
        return state;
      }

      if (!state.recoverable) {
        // Non-recoverable errors cannot be retried
        return state;
      }

      // Return to previous state, or initial if no previous state
      return state.previousState || INITIAL_APP_STATE;
    }

    default: {
      // Unknown action - return current state
      // TypeScript should catch this at compile time
      return state;
    }
  }
}
