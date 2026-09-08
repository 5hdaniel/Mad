/**
 * State Machine Reducer — persisted Full Disk Access skip (BACKLOG-3212)
 *
 * The defect: a macOS user who clicked "Skip for now" on the Full Disk Access
 * step was routed back into onboarding on EVERY launch. `isOnboardingComplete`
 * returned false on `!hasPermissions` alone, and the skip itself lived only in
 * a React useState Set that died with the process.
 *
 * These tests are a DISCRIMINATING PAIR, and the second half is the point:
 *
 *   1. flag present  -> the app reaches `ready`, no onboarding
 *   2. flag ABSENT   -> the app still routes to onboarding and still asks
 *
 * A fix that simply stopped asking anyone, ever, would pass (1) and fail (2).
 *
 * Fixture provenance: `fdaSkipped` is derived in LoadingOrchestrator Phase 4
 * from `preferences.onboarding.fdaSkipped` — the exact key
 * preferenceHandlers.onboardingSkip.test.ts proves the real `preferences:update`
 * handler writes when PermissionsStep sends its skip payload.
 */

import { appStateReducer } from "./reducer";
import type { AppState, LoadingState, PlatformInfo, ReadyState, User, UserData } from "./types";

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

/**
 * A returning macOS user who has done everything EXCEPT grant Full Disk
 * Access: phone type chosen, mailbox connected, email onboarding done.
 * This is the founder's reported state — the running app showed
 * status "onboarding", permissionsGranted false, isNewUser false.
 */
const declinedFdaWithMailbox: UserData = {
  phoneType: "iphone",
  hasCompletedEmailOnboarding: true,
  hasEmailConnected: true,
  needsDriverSetup: false,
  hasPermissions: false,
  fdaSkipped: true,
};

const loadingUserData: LoadingState = { status: "loading", phase: "loading-user-data" };

function loadUserData(data: UserData, platform: PlatformInfo = mockMacOSPlatform): AppState {
  return appStateReducer(loadingUserData, {
    type: "USER_DATA_LOADED" as const,
    data,
    user: mockUser,
    platform,
  });
}

describe("BACKLOG-3212 — a persisted FDA skip survives a relaunch", () => {
  it("routes a user who declined FDA (with a mailbox) straight to ready, not onboarding", () => {
    const result = loadUserData(declinedFdaWithMailbox);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      // hasPermissions must stay FALSE in the state that reaches the app.
      // Skipping is not granting: anything gating on real Full Disk Access
      // still has to see that it is absent.
      expect(result.userData.hasPermissions).toBe(false);
      expect(result.userData.fdaSkipped).toBe(true);
    }
  });

  it("CONTROL: the same user WITHOUT the flag is still routed into onboarding and still asked", () => {
    // Identical in every respect except the persisted choice. This is the
    // half that fails for a fix which just stops asking.
    const neverSkipped: UserData = { ...declinedFdaWithMailbox, fdaSkipped: false };

    const result = loadUserData(neverSkipped);

    expect(result.status).toBe("onboarding");
    if (result.status === "onboarding") {
      expect(result.completedSteps).not.toContain("permissions");
      expect(result.fdaSkipped).not.toBe(true);
    }
  });

  it("CONTROL: an absent flag (pre-3212 preference bag) behaves exactly like `false`", () => {
    // Every user who existed before this change has no `onboarding.fdaSkipped`
    // key at all. Absent must never be read as "already declined".
    const { fdaSkipped: _omitted, ...withoutTheKey } = declinedFdaWithMailbox;

    const result = loadUserData(withoutTheKey as UserData);

    expect(result.status).toBe("onboarding");
  });

  it("does NOT release a user who declined FDA and has no mailbox — the data-source floor still applies", () => {
    // hasCompletedEmailOnboarding is true for a user who SKIPPED email, so
    // releasing on fdaSkipped alone would drop someone onto the dashboard with
    // zero data sources and the BACKLOG-1821 floor would never fire again.
    const noSourceAtAll: UserData = {
      ...declinedFdaWithMailbox,
      hasEmailConnected: false, // skipped email
      hasCompletedEmailOnboarding: true,
    };

    const result = loadUserData(noSourceAtAll);

    expect(result.status).toBe("onboarding");
  });

  it("still seeds `permissions` as answered when such a user does enter onboarding", () => {
    // They are held for the floor, not re-asked for Full Disk Access. The
    // queue reads this via OnboardingState.fdaSkipped; completedSteps carries
    // the same fact for the legacy step-derivation path.
    const noSourceAtAll: UserData = {
      ...declinedFdaWithMailbox,
      hasEmailConnected: false,
    };

    const result = loadUserData(noSourceAtAll);

    expect(result.status).toBe("onboarding");
    if (result.status === "onboarding") {
      expect(result.fdaSkipped).toBe(true);
      expect(result.completedSteps).toContain("permissions");
      expect(result.step).not.toBe("permissions");
    }
  });

  it("leaves the FDA-granted path completely unchanged", () => {
    const granted: UserData = {
      phoneType: "iphone",
      hasCompletedEmailOnboarding: true,
      hasEmailConnected: true,
      needsDriverSetup: false,
      hasPermissions: true,
      // no fdaSkipped — a user who granted never skipped
    };

    const result = loadUserData(granted);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.userData.hasPermissions).toBe(true);
    }
  });

  it("a granted user is unaffected even if a stale skip flag is still on record", () => {
    // Skip, then grant later (e.g. via the BACKLOG-3208 Settings path). The
    // stale flag must be inert, never a downgrade.
    const grantedAfterSkipping: UserData = {
      phoneType: "iphone",
      hasCompletedEmailOnboarding: true,
      hasEmailConnected: true,
      needsDriverSetup: false,
      hasPermissions: true,
      fdaSkipped: true,
    };

    const result = loadUserData(grantedAfterSkipping);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.userData.hasPermissions).toBe(true);
    }
  });

  it("does not let a skip substitute for the other onboarding requirements", () => {
    // No phone type chosen — the skip must not shortcut anything but the FDA
    // question itself.
    const noPhoneType: UserData = { ...declinedFdaWithMailbox, phoneType: null };

    const result = loadUserData(noPhoneType);

    expect(result.status).toBe("onboarding");
  });

  it("carries the skip through START_EMAIL_SETUP so a ready user is not re-asked", () => {
    const ready: ReadyState = {
      status: "ready",
      user: mockUser,
      platform: mockMacOSPlatform,
      userData: declinedFdaWithMailbox,
    };

    const result = appStateReducer(ready, { type: "START_EMAIL_SETUP" });

    expect(result.status).toBe("onboarding");
    if (result.status === "onboarding") {
      expect(result.fdaSkipped).toBe(true);
      expect(result.hasPermissions).toBe(false);
    }
  });
});
