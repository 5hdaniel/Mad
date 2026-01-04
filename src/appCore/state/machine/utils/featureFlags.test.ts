/**
 * Feature Flag Tests
 *
 * Tests for the state machine feature flag utilities.
 */

import {
  isNewStateMachineEnabled,
  enableNewStateMachine,
  disableNewStateMachine,
  clearStateMachineFlag,
  getFeatureFlagStatus,
} from "./featureFlags";

// Mock window.location
const mockLocation = {
  search: "",
  reload: jest.fn(),
};

// Store original values
const originalWindow = global.window;
const originalLocalStorage = global.localStorage;

describe("featureFlags", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorage.clear();
    mockLocation.search = "";
    mockLocation.reload.mockClear();

    // Mock window.location
    Object.defineProperty(global, "window", {
      value: {
        ...originalWindow,
        location: mockLocation,
      },
      writable: true,
    });
  });

  afterAll(() => {
    // Restore original window
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
    });
  });

  describe("isNewStateMachineEnabled", () => {
    it("returns false by default (Phase 1 safety)", () => {
      expect(isNewStateMachineEnabled()).toBe(false);
    });

    it("returns true when localStorage is set to true", () => {
      localStorage.setItem("useNewStateMachine", "true");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("returns false when localStorage is set to false", () => {
      localStorage.setItem("useNewStateMachine", "false");
      expect(isNewStateMachineEnabled()).toBe(false);
    });

    it("URL param true overrides localStorage false", () => {
      mockLocation.search = "?newStateMachine=true";
      localStorage.setItem("useNewStateMachine", "false");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("URL param false overrides localStorage true", () => {
      mockLocation.search = "?newStateMachine=false";
      localStorage.setItem("useNewStateMachine", "true");
      expect(isNewStateMachineEnabled()).toBe(false);
    });

    it("ignores invalid URL param values", () => {
      mockLocation.search = "?newStateMachine=invalid";
      localStorage.setItem("useNewStateMachine", "true");
      expect(isNewStateMachineEnabled()).toBe(true);
    });

    it("ignores invalid localStorage values", () => {
      localStorage.setItem("useNewStateMachine", "invalid");
      expect(isNewStateMachineEnabled()).toBe(false);
    });

    it("handles URL param with other params", () => {
      mockLocation.search = "?foo=bar&newStateMachine=true&baz=qux";
      expect(isNewStateMachineEnabled()).toBe(true);
    });
  });

  describe("enableNewStateMachine", () => {
    it("sets localStorage to true", () => {
      enableNewStateMachine(false);
      expect(localStorage.getItem("useNewStateMachine")).toBe("true");
    });

    it("reloads page by default", () => {
      enableNewStateMachine();
      expect(mockLocation.reload).toHaveBeenCalled();
    });

    it("does not reload when reload=false", () => {
      enableNewStateMachine(false);
      expect(mockLocation.reload).not.toHaveBeenCalled();
    });
  });

  describe("disableNewStateMachine", () => {
    it("sets localStorage to false", () => {
      disableNewStateMachine(false);
      expect(localStorage.getItem("useNewStateMachine")).toBe("false");
    });

    it("reloads page by default", () => {
      disableNewStateMachine();
      expect(mockLocation.reload).toHaveBeenCalled();
    });

    it("does not reload when reload=false", () => {
      disableNewStateMachine(false);
      expect(mockLocation.reload).not.toHaveBeenCalled();
    });
  });

  describe("clearStateMachineFlag", () => {
    it("removes localStorage item", () => {
      localStorage.setItem("useNewStateMachine", "true");
      clearStateMachineFlag();
      expect(localStorage.getItem("useNewStateMachine")).toBeNull();
    });

    it("does not reload by default", () => {
      clearStateMachineFlag();
      expect(mockLocation.reload).not.toHaveBeenCalled();
    });

    it("reloads when reload=true", () => {
      clearStateMachineFlag(true);
      expect(mockLocation.reload).toHaveBeenCalled();
    });
  });

  describe("getFeatureFlagStatus", () => {
    it("returns default source when no flag is set", () => {
      const status = getFeatureFlagStatus();
      expect(status.source).toBe("default");
      expect(status.value).toBe(false);
    });

    it("returns localStorage source when localStorage is set", () => {
      localStorage.setItem("useNewStateMachine", "true");
      const status = getFeatureFlagStatus();
      expect(status.source).toBe("localStorage");
      expect(status.value).toBe(true);
    });

    it("returns url source when URL param is set", () => {
      mockLocation.search = "?newStateMachine=true";
      const status = getFeatureFlagStatus();
      expect(status.source).toBe("url");
      expect(status.value).toBe(true);
    });

    it("URL source takes precedence over localStorage", () => {
      mockLocation.search = "?newStateMachine=false";
      localStorage.setItem("useNewStateMachine", "true");
      const status = getFeatureFlagStatus();
      expect(status.source).toBe("url");
      expect(status.value).toBe(false);
    });
  });
});
