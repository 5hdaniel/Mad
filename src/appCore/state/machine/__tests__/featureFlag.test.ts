/**
 * Feature Flag Behavior Tests (Phase 2)
 *
 * Comprehensive tests for the state machine feature flag behavior.
 * Validates that the flag defaults to enabled (Phase 2) and that
 * explicit disable/enable still works correctly.
 *
 * @module appCore/state/machine/__tests__/featureFlag.test
 */

import {
  isNewStateMachineEnabled,
  enableNewStateMachine,
  disableNewStateMachine,
  clearStateMachineFlag,
  getFeatureFlagStatus,
} from "../utils/featureFlags";

// Mock window.location for URL param tests
const mockLocation = {
  search: "",
  reload: jest.fn(),
};

const originalWindow = global.window;

describe("Feature Flag Behavior (Phase 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockLocation.search = "";
    mockLocation.reload.mockClear();

    Object.defineProperty(global, "window", {
      value: {
        ...originalWindow,
        location: mockLocation,
      },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
    });
  });

  describe("Default Behavior (Phase 2)", () => {
    it("defaults to enabled when no localStorage value is set", () => {
      // Clear any existing value
      localStorage.removeItem("useNewStateMachine");

      const result = isNewStateMachineEnabled();
      expect(result).toBe(true);
    });

    it("returns enabled status from getFeatureFlagStatus when no value set", () => {
      localStorage.removeItem("useNewStateMachine");

      const status = getFeatureFlagStatus();
      expect(status.source).toBe("default");
      expect(status.value).toBe(true);
    });

    it("maintains enabled default after clearing flag", () => {
      // Set then clear
      localStorage.setItem("useNewStateMachine", "false");
      clearStateMachineFlag(false);

      expect(isNewStateMachineEnabled()).toBe(true);
    });
  });

  describe("Explicit Settings", () => {
    it('is enabled when localStorage is explicitly "true"', () => {
      localStorage.setItem("useNewStateMachine", "true");

      const result = isNewStateMachineEnabled();
      expect(result).toBe(true);
    });

    it('is disabled when localStorage is explicitly "false"', () => {
      localStorage.setItem("useNewStateMachine", "false");

      const result = isNewStateMachineEnabled();
      expect(result).toBe(false);
    });

    it("enableNewStateMachine sets localStorage to true", () => {
      enableNewStateMachine(false);

      expect(localStorage.getItem("useNewStateMachine")).toBe("true");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("disableNewStateMachine sets localStorage to false", () => {
      disableNewStateMachine(false);

      expect(localStorage.getItem("useNewStateMachine")).toBe("false");
      expect(isNewStateMachineEnabled()).toBe(false);
    });
  });

  describe("Rollback Behavior", () => {
    it("can be disabled via localStorage for rollback", () => {
      // Simulate rollback procedure
      localStorage.setItem("useNewStateMachine", "false");

      expect(isNewStateMachineEnabled()).toBe(false);
      expect(getFeatureFlagStatus()).toEqual({
        source: "localStorage",
        value: false,
      });
    });

    it("can be re-enabled after rollback", () => {
      // First rollback
      localStorage.setItem("useNewStateMachine", "false");
      expect(isNewStateMachineEnabled()).toBe(false);

      // Then re-enable
      localStorage.setItem("useNewStateMachine", "true");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("returns to default (enabled) when flag is cleared after rollback", () => {
      // Rollback
      localStorage.setItem("useNewStateMachine", "false");
      expect(isNewStateMachineEnabled()).toBe(false);

      // Clear flag
      clearStateMachineFlag(false);
      expect(isNewStateMachineEnabled()).toBe(true);
    });
  });

  describe("URL Override (Testing)", () => {
    it("URL param true works when no localStorage", () => {
      mockLocation.search = "?newStateMachine=true";

      expect(isNewStateMachineEnabled()).toBe(true);
      expect(getFeatureFlagStatus()).toEqual({
        source: "url",
        value: true,
      });
    });

    it("URL param false overrides default enabled", () => {
      mockLocation.search = "?newStateMachine=false";

      expect(isNewStateMachineEnabled()).toBe(false);
      expect(getFeatureFlagStatus()).toEqual({
        source: "url",
        value: false,
      });
    });

    it("URL param takes precedence over localStorage", () => {
      mockLocation.search = "?newStateMachine=true";
      localStorage.setItem("useNewStateMachine", "false");

      expect(isNewStateMachineEnabled()).toBe(true);
      expect(getFeatureFlagStatus().source).toBe("url");
    });
  });

  describe("Flag Behavior Matrix", () => {
    /**
     * Flag Behavior Matrix (Phase 2):
     *
     * | localStorage value | URL param | Expected Result |
     * |-------------------|-----------|-----------------|
     * | Not set           | Not set   | ENABLED (default) |
     * | 'true'            | Not set   | ENABLED |
     * | 'false'           | Not set   | DISABLED (rollback) |
     * | Any               | 'true'    | ENABLED (override) |
     * | Any               | 'false'   | DISABLED (override) |
     */

    it("handles all matrix cases correctly", () => {
      // Case 1: Nothing set -> enabled
      localStorage.clear();
      mockLocation.search = "";
      expect(isNewStateMachineEnabled()).toBe(true);

      // Case 2: localStorage true -> enabled
      localStorage.setItem("useNewStateMachine", "true");
      mockLocation.search = "";
      expect(isNewStateMachineEnabled()).toBe(true);

      // Case 3: localStorage false -> disabled (rollback)
      localStorage.setItem("useNewStateMachine", "false");
      mockLocation.search = "";
      expect(isNewStateMachineEnabled()).toBe(false);

      // Case 4: URL true overrides localStorage false -> enabled
      localStorage.setItem("useNewStateMachine", "false");
      mockLocation.search = "?newStateMachine=true";
      expect(isNewStateMachineEnabled()).toBe(true);

      // Case 5: URL false overrides localStorage true -> disabled
      localStorage.setItem("useNewStateMachine", "true");
      mockLocation.search = "?newStateMachine=false";
      expect(isNewStateMachineEnabled()).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles invalid localStorage values as default (enabled)", () => {
      localStorage.setItem("useNewStateMachine", "invalid");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("handles empty string localStorage value as default (enabled)", () => {
      localStorage.setItem("useNewStateMachine", "");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("handles invalid URL param values (falls through to localStorage)", () => {
      mockLocation.search = "?newStateMachine=maybe";
      localStorage.setItem("useNewStateMachine", "false");
      expect(isNewStateMachineEnabled()).toBe(false);
    });

    it("handles case-sensitive values (only lowercase works)", () => {
      localStorage.setItem("useNewStateMachine", "TRUE");
      expect(isNewStateMachineEnabled()).toBe(true); // Falls through to default

      localStorage.setItem("useNewStateMachine", "FALSE");
      expect(isNewStateMachineEnabled()).toBe(true); // Falls through to default
    });
  });
});
