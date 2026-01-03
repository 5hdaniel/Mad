/**
 * State Machine Reducer Tests
 *
 * Comprehensive tests for the app state machine reducer.
 * Tests all state transitions, edge cases, and error recovery.
 *
 * @module appCore/state/machine/reducer.test
 */

import { appStateReducer, getNextOnboardingStep } from "./reducer";
import { INITIAL_APP_STATE } from "./types";
import type {
  AppState,
  AppAction,
  LoadingState,
  OnboardingState,
  ReadyState,
  ErrorState,
  OnboardingStep,
  PlatformInfo,
  User,
  UserData,
} from "./types";

// ============================================
// TEST FIXTURES
// ============================================

const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  displayName: "Test User",
};

const mockMacOSPlatform: PlatformInfo = {
  isMacOS: true,
  isWindows: false,
  hasIPhone: true,
};

const mockWindowsPlatform: PlatformInfo = {
  isMacOS: false,
  isWindows: true,
  hasIPhone: true,
};

const mockWindowsAndroidPlatform: PlatformInfo = {
  isMacOS: false,
  isWindows: true,
  hasIPhone: false,
};

const mockCompleteUserData: UserData = {
  phoneType: "iphone",
  hasCompletedEmailOnboarding: true,
  hasEmailConnected: true,
  needsDriverSetup: false,
  hasPermissions: true,
};

const mockIncompleteUserData: UserData = {
  phoneType: null,
  hasCompletedEmailOnboarding: false,
  hasEmailConnected: false,
  needsDriverSetup: true,
  hasPermissions: false,
};

// ============================================
// getNextOnboardingStep TESTS
// ============================================

describe("getNextOnboardingStep", () => {
  describe("macOS platform", () => {
    it("returns phone-type as first step for new user", () => {
      const result = getNextOnboardingStep([], mockMacOSPlatform, mockIncompleteUserData);
      expect(result).toBe("phone-type");
    });

    it("returns secure-storage after phone-type on macOS", () => {
      const result = getNextOnboardingStep(
        ["phone-type"],
        mockMacOSPlatform,
        mockIncompleteUserData
      );
      expect(result).toBe("secure-storage");
    });

    it("returns email-connect after secure-storage", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "secure-storage"],
        mockMacOSPlatform,
        mockIncompleteUserData
      );
      expect(result).toBe("email-connect");
    });

    it("returns permissions after email-connect if not granted", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "secure-storage", "email-connect"],
        mockMacOSPlatform,
        { ...mockIncompleteUserData, hasPermissions: false }
      );
      expect(result).toBe("permissions");
    });

    it("returns null when all macOS steps complete", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "secure-storage", "email-connect", "permissions"],
        mockMacOSPlatform,
        { ...mockIncompleteUserData, hasPermissions: true }
      );
      expect(result).toBeNull();
    });

    it("skips permissions if already granted", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "secure-storage", "email-connect"],
        mockMacOSPlatform,
        { ...mockIncompleteUserData, hasPermissions: true }
      );
      expect(result).toBeNull();
    });
  });

  describe("Windows + iPhone platform", () => {
    it("returns phone-type as first step", () => {
      const result = getNextOnboardingStep([], mockWindowsPlatform, mockIncompleteUserData);
      expect(result).toBe("phone-type");
    });

    it("skips secure-storage on Windows", () => {
      const result = getNextOnboardingStep(
        ["phone-type"],
        mockWindowsPlatform,
        mockIncompleteUserData
      );
      expect(result).toBe("email-connect");
    });

    it("returns apple-driver after email-connect if needed", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "email-connect"],
        mockWindowsPlatform,
        { ...mockIncompleteUserData, needsDriverSetup: true }
      );
      expect(result).toBe("apple-driver");
    });

    it("skips apple-driver if not needed", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "email-connect"],
        mockWindowsPlatform,
        { ...mockIncompleteUserData, needsDriverSetup: false }
      );
      expect(result).toBeNull();
    });

    it("returns null when all Windows+iPhone steps complete", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "email-connect", "apple-driver"],
        mockWindowsPlatform,
        { ...mockIncompleteUserData, needsDriverSetup: false }
      );
      expect(result).toBeNull();
    });
  });

  describe("Windows + Android platform", () => {
    it("skips apple-driver for Android users", () => {
      const result = getNextOnboardingStep(
        ["phone-type", "email-connect"],
        mockWindowsAndroidPlatform,
        mockIncompleteUserData
      );
      expect(result).toBeNull();
    });
  });
});

// ============================================
// LOADING PHASE TRANSITIONS
// ============================================

describe("appStateReducer - Loading Phase Transitions", () => {
  describe("STORAGE_CHECKED", () => {
    it("transitions from checking-storage to initializing-db when hasKeyStore is true", () => {
      const state = INITIAL_APP_STATE;
      const action: AppAction = { type: "STORAGE_CHECKED", hasKeyStore: true };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: "loading",
        phase: "initializing-db",
      });
    });

    it("transitions to initializing-db even when hasKeyStore is false", () => {
      const state = INITIAL_APP_STATE;
      const action: AppAction = { type: "STORAGE_CHECKED", hasKeyStore: false };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: "loading",
        phase: "initializing-db",
      });
    });

    it("returns current state if not in checking-storage phase", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = { type: "STORAGE_CHECKED", hasKeyStore: true };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });

    it("returns current state if not in loading status", () => {
      const state: AppState = { status: "unauthenticated" };
      const action: AppAction = { type: "STORAGE_CHECKED", hasKeyStore: true };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });

  describe("DB_INIT_STARTED", () => {
    it("sets progress to 0 in initializing-db phase", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = { type: "DB_INIT_STARTED" };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: "loading",
        phase: "initializing-db",
        progress: 0,
      });
    });

    it("returns current state if not in initializing-db phase", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action: AppAction = { type: "DB_INIT_STARTED" };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });

  describe("DB_INIT_COMPLETE", () => {
    it("transitions to loading-auth on success", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = { type: "DB_INIT_COMPLETE", success: true };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: "loading",
        phase: "loading-auth",
      });
    });

    it("transitions to error state on failure", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = {
        type: "DB_INIT_COMPLETE",
        success: false,
        error: "Keychain access denied",
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error.code).toBe("DB_INIT_FAILED");
        expect(result.error.message).toBe("Keychain access denied");
        expect(result.recoverable).toBe(true);
        expect(result.previousState).toEqual(state);
      }
    });

    it("uses default error message when none provided", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = { type: "DB_INIT_COMPLETE", success: false };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error.message).toBe("Failed to initialize database");
      }
    });

    it("returns current state if not in initializing-db phase", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action: AppAction = { type: "DB_INIT_COMPLETE", success: true };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });

  describe("AUTH_LOADED", () => {
    it("transitions to unauthenticated when no user", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action: AppAction = {
        type: "AUTH_LOADED",
        user: null,
        isNewUser: false,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result).toEqual({ status: "unauthenticated" });
    });

    it("transitions new user directly to onboarding", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action: AppAction = {
        type: "AUTH_LOADED",
        user: mockUser,
        isNewUser: true,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        expect(result.user).toEqual(mockUser);
        expect(result.platform).toEqual(mockMacOSPlatform);
        expect(result.step).toBe("phone-type");
        expect(result.completedSteps).toEqual([]);
      }
    });

    it("transitions returning user to loading-user-data", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action: AppAction = {
        type: "AUTH_LOADED",
        user: mockUser,
        isNewUser: false,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: "loading",
        phase: "loading-user-data",
      });
    });

    it("returns current state if not in loading-auth phase", () => {
      const state: LoadingState = { status: "loading", phase: "checking-storage" };
      const action: AppAction = {
        type: "AUTH_LOADED",
        user: mockUser,
        isNewUser: false,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });

  describe("USER_DATA_LOADED", () => {
    it("transitions to ready state when onboarding complete", () => {
      const state: LoadingState = { status: "loading", phase: "loading-user-data" };
      // Extended action with user and platform context
      const action = {
        type: "USER_DATA_LOADED" as const,
        data: mockCompleteUserData,
        user: mockUser,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.user).toEqual(mockUser);
        expect(result.platform).toEqual(mockMacOSPlatform);
        expect(result.userData).toEqual(mockCompleteUserData);
      }
    });

    it("transitions to onboarding when onboarding incomplete", () => {
      const state: LoadingState = { status: "loading", phase: "loading-user-data" };
      const action = {
        type: "USER_DATA_LOADED" as const,
        data: mockIncompleteUserData,
        user: mockUser,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        expect(result.user).toEqual(mockUser);
        expect(result.platform).toEqual(mockMacOSPlatform);
        expect(result.step).toBe("phone-type");
      }
    });

    it("correctly determines completed steps from userData", () => {
      const state: LoadingState = { status: "loading", phase: "loading-user-data" };
      const partialUserData: UserData = {
        phoneType: "iphone",
        hasCompletedEmailOnboarding: true,
        hasEmailConnected: false,
        needsDriverSetup: false,
        hasPermissions: false, // Still needs permissions on macOS
      };
      const action = {
        type: "USER_DATA_LOADED" as const,
        data: partialUserData,
        user: mockUser,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        expect(result.completedSteps).toContain("phone-type");
        expect(result.completedSteps).toContain("email-connect");
        expect(result.step).toBe("secure-storage"); // Next step after phone-type on macOS
      }
    });

    it("transitions to error when user context missing", () => {
      const state: LoadingState = { status: "loading", phase: "loading-user-data" };
      // Missing user and platform - simulating incorrect orchestrator usage
      const action = {
        type: "USER_DATA_LOADED" as const,
        data: mockCompleteUserData,
        user: undefined as unknown as User,
        platform: undefined as unknown as PlatformInfo,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error.code).toBe("USER_DATA_FAILED");
        expect(result.recoverable).toBe(true);
      }
    });

    it("returns current state if not in loading-user-data phase", () => {
      const state: LoadingState = { status: "loading", phase: "loading-auth" };
      const action = {
        type: "USER_DATA_LOADED" as const,
        data: mockCompleteUserData,
        user: mockUser,
        platform: mockMacOSPlatform,
      };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

// ============================================
// ONBOARDING TRANSITIONS
// ============================================

describe("appStateReducer - Onboarding Transitions", () => {
  const baseOnboardingState: OnboardingState = {
    status: "onboarding",
    step: "phone-type",
    user: mockUser,
    platform: mockMacOSPlatform,
    completedSteps: [],
  };

  describe("ONBOARDING_STEP_COMPLETE", () => {
    it("advances to next step when step completed", () => {
      const state = baseOnboardingState;
      const action: AppAction = {
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        expect(result.completedSteps).toContain("phone-type");
        expect(result.step).toBe("secure-storage"); // Next step on macOS
      }
    });

    it("transitions to ready when all steps complete", () => {
      const state: OnboardingState = {
        status: "onboarding",
        step: "permissions",
        user: mockUser,
        platform: mockMacOSPlatform,
        completedSteps: ["phone-type", "secure-storage", "email-connect"],
      };
      const action: AppAction = {
        type: "ONBOARDING_STEP_COMPLETE",
        step: "permissions",
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.user).toEqual(mockUser);
        expect(result.platform).toEqual(mockMacOSPlatform);
        expect(result.userData.hasPermissions).toBe(true);
      }
    });

    it("does not duplicate step in completedSteps", () => {
      const state: OnboardingState = {
        ...baseOnboardingState,
        completedSteps: ["phone-type"],
      };
      const action: AppAction = {
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        const phoneTypeCount = result.completedSteps.filter(
          (s) => s === "phone-type"
        ).length;
        expect(phoneTypeCount).toBe(1);
      }
    });

    it("returns current state if not in onboarding status", () => {
      const state: AppState = { status: "unauthenticated" };
      const action: AppAction = {
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
      };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });

    it("correctly handles Windows+iPhone apple-driver completion", () => {
      const windowsState: OnboardingState = {
        status: "onboarding",
        step: "apple-driver",
        user: mockUser,
        platform: mockWindowsPlatform,
        completedSteps: ["phone-type", "email-connect"],
      };
      const action: AppAction = {
        type: "ONBOARDING_STEP_COMPLETE",
        step: "apple-driver",
      };

      const result = appStateReducer(windowsState, action);

      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.userData.needsDriverSetup).toBe(false);
      }
    });
  });

  describe("ONBOARDING_SKIP", () => {
    it("treats skip the same as complete", () => {
      const state = baseOnboardingState;
      const action: AppAction = {
        type: "ONBOARDING_SKIP",
        step: "phone-type",
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("onboarding");
      if (result.status === "onboarding") {
        expect(result.completedSteps).toContain("phone-type");
        expect(result.step).toBe("secure-storage");
      }
    });

    it("returns current state if not in onboarding status", () => {
      const state: ReadyState = {
        status: "ready",
        user: mockUser,
        platform: mockMacOSPlatform,
        userData: mockCompleteUserData,
      };
      const action: AppAction = {
        type: "ONBOARDING_SKIP",
        step: "email-connect",
      };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

// ============================================
// READY STATE TRANSITIONS
// ============================================

describe("appStateReducer - Ready State Transitions", () => {
  describe("APP_READY", () => {
    it("returns same state if already ready", () => {
      const state: ReadyState = {
        status: "ready",
        user: mockUser,
        platform: mockMacOSPlatform,
        userData: mockCompleteUserData,
      };
      const action: AppAction = { type: "APP_READY" };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });

    it("does not transition from other states", () => {
      const state: AppState = { status: "unauthenticated" };
      const action: AppAction = { type: "APP_READY" };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

// ============================================
// LOGOUT TRANSITIONS
// ============================================

describe("appStateReducer - Logout", () => {
  it("transitions from ready to unauthenticated", () => {
    const state: ReadyState = {
      status: "ready",
      user: mockUser,
      platform: mockMacOSPlatform,
      userData: mockCompleteUserData,
    };
    const action: AppAction = { type: "LOGOUT" };

    const result = appStateReducer(state, action);

    expect(result).toEqual({ status: "unauthenticated" });
  });

  it("transitions from onboarding to unauthenticated", () => {
    const state: OnboardingState = {
      status: "onboarding",
      step: "phone-type",
      user: mockUser,
      platform: mockMacOSPlatform,
      completedSteps: [],
    };
    const action: AppAction = { type: "LOGOUT" };

    const result = appStateReducer(state, action);

    expect(result).toEqual({ status: "unauthenticated" });
  });

  it("transitions from loading to unauthenticated", () => {
    const state: LoadingState = { status: "loading", phase: "initializing-db" };
    const action: AppAction = { type: "LOGOUT" };

    const result = appStateReducer(state, action);

    expect(result).toEqual({ status: "unauthenticated" });
  });

  it("transitions from error to unauthenticated", () => {
    const state: ErrorState = {
      status: "error",
      error: { code: "UNKNOWN_ERROR", message: "test" },
      recoverable: false,
    };
    const action: AppAction = { type: "LOGOUT" };

    const result = appStateReducer(state, action);

    expect(result).toEqual({ status: "unauthenticated" });
  });
});

// ============================================
// ERROR HANDLING
// ============================================

describe("appStateReducer - Error Handling", () => {
  describe("ERROR", () => {
    it("transitions any state to error", () => {
      const state: ReadyState = {
        status: "ready",
        user: mockUser,
        platform: mockMacOSPlatform,
        userData: mockCompleteUserData,
      };
      const action: AppAction = {
        type: "ERROR",
        error: { code: "NETWORK_ERROR", message: "Connection lost" },
        recoverable: true,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error.code).toBe("NETWORK_ERROR");
        expect(result.error.message).toBe("Connection lost");
        expect(result.recoverable).toBe(true);
        expect(result.previousState).toEqual(state);
      }
    });

    it("defaults recoverable to false", () => {
      const state: AppState = { status: "unauthenticated" };
      const action: AppAction = {
        type: "ERROR",
        error: { code: "UNKNOWN_ERROR", message: "Something went wrong" },
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.recoverable).toBe(false);
      }
    });

    it("preserves previous state for recovery", () => {
      const state: LoadingState = { status: "loading", phase: "initializing-db" };
      const action: AppAction = {
        type: "ERROR",
        error: { code: "DB_INIT_FAILED", message: "Test error" },
        recoverable: true,
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.previousState).toEqual(state);
      }
    });
  });

  describe("RETRY", () => {
    it("returns to previous state if recoverable", () => {
      const previousState: LoadingState = {
        status: "loading",
        phase: "initializing-db",
      };
      const state: ErrorState = {
        status: "error",
        error: { code: "DB_INIT_FAILED", message: "Test error" },
        recoverable: true,
        previousState,
      };
      const action: AppAction = { type: "RETRY" };

      const result = appStateReducer(state, action);

      expect(result).toEqual(previousState);
    });

    it("returns to INITIAL_APP_STATE if no previous state", () => {
      const state: ErrorState = {
        status: "error",
        error: { code: "UNKNOWN_ERROR", message: "Test error" },
        recoverable: true,
      };
      const action: AppAction = { type: "RETRY" };

      const result = appStateReducer(state, action);

      expect(result).toEqual(INITIAL_APP_STATE);
    });

    it("returns current state if not recoverable", () => {
      const state: ErrorState = {
        status: "error",
        error: { code: "UNKNOWN_ERROR", message: "Fatal error" },
        recoverable: false,
      };
      const action: AppAction = { type: "RETRY" };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });

    it("returns current state if not in error status", () => {
      const state: ReadyState = {
        status: "ready",
        user: mockUser,
        platform: mockMacOSPlatform,
        userData: mockCompleteUserData,
      };
      const action: AppAction = { type: "RETRY" };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

// ============================================
// INVALID TRANSITIONS
// ============================================

describe("appStateReducer - Invalid Transitions", () => {
  it("returns current state for action in wrong status", () => {
    const state: AppState = { status: "unauthenticated" };
    const action: AppAction = { type: "DB_INIT_COMPLETE", success: true };

    const result = appStateReducer(state, action);

    expect(result).toBe(state);
  });

  it("returns current state for action in wrong phase", () => {
    const state: LoadingState = { status: "loading", phase: "checking-storage" };
    const action: AppAction = { type: "DB_INIT_COMPLETE", success: true };

    const result = appStateReducer(state, action);

    expect(result).toBe(state);
  });

  it("handles double-dispatch of same action", () => {
    const state = INITIAL_APP_STATE;
    const action: AppAction = { type: "STORAGE_CHECKED", hasKeyStore: true };

    const firstResult = appStateReducer(state, action);
    const secondResult = appStateReducer(firstResult, action);

    // Second dispatch should be a no-op (already in initializing-db)
    expect(secondResult).toBe(firstResult);
  });
});

// ============================================
// STATE IMMUTABILITY
// ============================================

describe("appStateReducer - Immutability", () => {
  it("does not mutate input state", () => {
    const state: OnboardingState = {
      status: "onboarding",
      step: "phone-type",
      user: mockUser,
      platform: mockMacOSPlatform,
      completedSteps: [],
    };
    const originalState = JSON.parse(JSON.stringify(state));
    const action: AppAction = {
      type: "ONBOARDING_STEP_COMPLETE",
      step: "phone-type",
    };

    appStateReducer(state, action);

    expect(state).toEqual(originalState);
  });

  it("returns same reference for no-op transitions", () => {
    const state: AppState = { status: "unauthenticated" };
    const action: AppAction = { type: "DB_INIT_COMPLETE", success: true };

    const result = appStateReducer(state, action);

    expect(result).toBe(state);
  });
});
