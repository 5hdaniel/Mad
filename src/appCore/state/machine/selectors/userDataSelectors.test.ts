/**
 * User Data Selectors Tests
 *
 * Tests for user-related state selectors.
 */

import type {
  AppState,
  LoadingState,
  ReadyState,
  OnboardingState,
  ErrorState,
  UnauthenticatedState,
} from "../types";
import {
  selectCurrentOnboardingStep,
  selectHasCompletedEmailOnboarding,
  selectHasSelectedPhoneType,
  selectIsStepComplete,
  selectCompletedSteps,
  selectPhoneType,
} from "./userDataSelectors";

describe("userDataSelectors", () => {
  // Test states
  const loadingState: LoadingState = {
    status: "loading",
    phase: "checking-storage",
  };

  const readyState: ReadyState = {
    status: "ready",
    user: { id: "test", email: "test@example.com" },
    platform: { isMacOS: true, isWindows: false, hasIPhone: true },
    userData: {
      phoneType: "iphone",
      hasCompletedEmailOnboarding: true,
      hasEmailConnected: true,
      needsDriverSetup: false,
      hasPermissions: true,
    },
  };

  const onboardingPhoneType: OnboardingState = {
    status: "onboarding",
    step: "phone-type",
    user: { id: "test", email: "test@example.com" },
    platform: { isMacOS: true, isWindows: false, hasIPhone: false },
    completedSteps: [],
  };

  const onboardingSecureStorage: OnboardingState = {
    status: "onboarding",
    step: "secure-storage",
    user: { id: "test", email: "test@example.com" },
    platform: { isMacOS: true, isWindows: false, hasIPhone: true },
    completedSteps: ["phone-type"],
  };

  const onboardingEmail: OnboardingState = {
    status: "onboarding",
    step: "email-connect",
    user: { id: "test", email: "test@example.com" },
    platform: { isMacOS: true, isWindows: false, hasIPhone: true },
    completedSteps: ["phone-type", "secure-storage"],
  };

  const onboardingPermissions: OnboardingState = {
    status: "onboarding",
    step: "permissions",
    user: { id: "test", email: "test@example.com" },
    platform: { isMacOS: true, isWindows: false, hasIPhone: true },
    completedSteps: ["phone-type", "secure-storage", "email-connect"],
  };

  const errorState: ErrorState = {
    status: "error",
    error: { code: "UNKNOWN_ERROR", message: "Test error" },
    recoverable: true,
  };

  const unauthenticatedState: UnauthenticatedState = {
    status: "unauthenticated",
  };

  describe("selectCurrentOnboardingStep", () => {
    it("returns null when not onboarding", () => {
      expect(selectCurrentOnboardingStep(loadingState)).toBeNull();
      expect(selectCurrentOnboardingStep(readyState)).toBeNull();
      expect(selectCurrentOnboardingStep(errorState)).toBeNull();
      expect(selectCurrentOnboardingStep(unauthenticatedState)).toBeNull();
    });

    it("returns the current step when onboarding", () => {
      expect(selectCurrentOnboardingStep(onboardingPhoneType)).toBe("phone-type");
      expect(selectCurrentOnboardingStep(onboardingSecureStorage)).toBe("secure-storage");
      expect(selectCurrentOnboardingStep(onboardingEmail)).toBe("email-connect");
      expect(selectCurrentOnboardingStep(onboardingPermissions)).toBe("permissions");
    });
  });

  describe("selectHasCompletedEmailOnboarding", () => {
    it("returns true when ready", () => {
      expect(selectHasCompletedEmailOnboarding(readyState)).toBe(true);
    });

    it("returns false when loading", () => {
      expect(selectHasCompletedEmailOnboarding(loadingState)).toBe(false);
    });

    it("returns false when unauthenticated", () => {
      expect(selectHasCompletedEmailOnboarding(unauthenticatedState)).toBe(false);
    });

    it("returns false when error", () => {
      expect(selectHasCompletedEmailOnboarding(errorState)).toBe(false);
    });

    it("returns false when on or before email step", () => {
      expect(selectHasCompletedEmailOnboarding(onboardingPhoneType)).toBe(false);
      expect(selectHasCompletedEmailOnboarding(onboardingSecureStorage)).toBe(false);
      expect(selectHasCompletedEmailOnboarding(onboardingEmail)).toBe(false);
    });

    it("returns true when past email step", () => {
      expect(selectHasCompletedEmailOnboarding(onboardingPermissions)).toBe(true);
    });
  });

  describe("selectHasSelectedPhoneType", () => {
    it("returns true when ready", () => {
      expect(selectHasSelectedPhoneType(readyState)).toBe(true);
    });

    it("returns false when loading", () => {
      expect(selectHasSelectedPhoneType(loadingState)).toBe(false);
    });

    it("returns false when unauthenticated", () => {
      expect(selectHasSelectedPhoneType(unauthenticatedState)).toBe(false);
    });

    it("returns false when error", () => {
      expect(selectHasSelectedPhoneType(errorState)).toBe(false);
    });

    it("returns false when on phone type step", () => {
      expect(selectHasSelectedPhoneType(onboardingPhoneType)).toBe(false);
    });

    it("returns true when past phone type step", () => {
      expect(selectHasSelectedPhoneType(onboardingSecureStorage)).toBe(true);
      expect(selectHasSelectedPhoneType(onboardingEmail)).toBe(true);
      expect(selectHasSelectedPhoneType(onboardingPermissions)).toBe(true);
    });
  });

  describe("selectIsStepComplete", () => {
    it("returns true for all steps when ready", () => {
      expect(selectIsStepComplete(readyState, "phone-type")).toBe(true);
      expect(selectIsStepComplete(readyState, "secure-storage")).toBe(true);
      expect(selectIsStepComplete(readyState, "email-connect")).toBe(true);
      expect(selectIsStepComplete(readyState, "permissions")).toBe(true);
      expect(selectIsStepComplete(readyState, "apple-driver")).toBe(true);
    });

    it("returns false for all steps when loading", () => {
      expect(selectIsStepComplete(loadingState, "phone-type")).toBe(false);
      expect(selectIsStepComplete(loadingState, "secure-storage")).toBe(false);
      expect(selectIsStepComplete(loadingState, "email-connect")).toBe(false);
    });

    it("returns false for current and future steps when onboarding", () => {
      // On phone-type step - no steps complete
      expect(selectIsStepComplete(onboardingPhoneType, "phone-type")).toBe(false);
      expect(selectIsStepComplete(onboardingPhoneType, "secure-storage")).toBe(false);
      expect(selectIsStepComplete(onboardingPhoneType, "email-connect")).toBe(false);

      // On secure-storage step - phone-type complete
      expect(selectIsStepComplete(onboardingSecureStorage, "phone-type")).toBe(true);
      expect(selectIsStepComplete(onboardingSecureStorage, "secure-storage")).toBe(false);
      expect(selectIsStepComplete(onboardingSecureStorage, "email-connect")).toBe(false);

      // On email-connect step - phone-type and secure-storage complete
      expect(selectIsStepComplete(onboardingEmail, "phone-type")).toBe(true);
      expect(selectIsStepComplete(onboardingEmail, "secure-storage")).toBe(true);
      expect(selectIsStepComplete(onboardingEmail, "email-connect")).toBe(false);
    });
  });

  describe("selectCompletedSteps", () => {
    it("returns empty array when loading", () => {
      expect(selectCompletedSteps(loadingState)).toEqual([]);
    });

    it("returns empty array when unauthenticated", () => {
      expect(selectCompletedSteps(unauthenticatedState)).toEqual([]);
    });

    it("returns empty array when error", () => {
      expect(selectCompletedSteps(errorState)).toEqual([]);
    });

    it("returns completedSteps from onboarding state", () => {
      expect(selectCompletedSteps(onboardingPhoneType)).toEqual([]);
      expect(selectCompletedSteps(onboardingSecureStorage)).toEqual(["phone-type"]);
      expect(selectCompletedSteps(onboardingEmail)).toEqual(["phone-type", "secure-storage"]);
    });

    it("returns all steps when ready", () => {
      const completedSteps = selectCompletedSteps(readyState);
      expect(completedSteps).toContain("phone-type");
      expect(completedSteps).toContain("secure-storage");
      expect(completedSteps).toContain("email-connect");
      expect(completedSteps).toContain("permissions");
      expect(completedSteps).toContain("apple-driver");
      expect(completedSteps).toContain("android-coming-soon");
    });
  });

  describe("selectPhoneType", () => {
    it("returns phoneType from ready state", () => {
      expect(selectPhoneType(readyState)).toBe("iphone");

      const readyWithAndroid: ReadyState = {
        ...readyState,
        userData: { ...readyState.userData, phoneType: "android" },
      };
      expect(selectPhoneType(readyWithAndroid)).toBe("android");

      const readyWithNull: ReadyState = {
        ...readyState,
        userData: { ...readyState.userData, phoneType: null },
      };
      expect(selectPhoneType(readyWithNull)).toBeNull();
    });

    it("returns null when loading", () => {
      expect(selectPhoneType(loadingState)).toBeNull();
    });

    it("returns null when unauthenticated", () => {
      expect(selectPhoneType(unauthenticatedState)).toBeNull();
    });

    it("returns null when error", () => {
      expect(selectPhoneType(errorState)).toBeNull();
    });

    it("returns iphone when onboarding with hasIPhone true", () => {
      expect(selectPhoneType(onboardingSecureStorage)).toBe("iphone");
    });

    it("returns null when onboarding with hasIPhone false", () => {
      expect(selectPhoneType(onboardingPhoneType)).toBeNull();
    });
  });
});
