/**
 * Tests for Platform Detection Utility
 * Verifies platform detection and feature availability checks
 */

import {
  getPlatform,
  isMacOS,
  isWindows,
  isLinux,
  isFeatureAvailable,
  platformFeatures,
} from "../platform";

// Store originals
const originalApi = window.api;
const originalNavigator = window.navigator;

// Helper to mock navigator properties
function mockNavigator(platform: string, userAgent: string) {
  Object.defineProperty(window, "navigator", {
    value: {
      ...originalNavigator,
      platform,
      userAgent,
    },
    writable: true,
    configurable: true,
  });
}

describe("Platform Detection Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.api
    Object.defineProperty(window, "api", {
      value: originalApi,
      writable: true,
      configurable: true,
    });
    // Restore original navigator
    Object.defineProperty(window, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe("getPlatform", () => {
    it('should return "macos" when platform is darwin', () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "darwin" } },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("macos");
    });

    it('should return "windows" when platform is win32', () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "win32" } },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("windows");
    });

    it('should return "linux" when platform is linux', () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "linux" } },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("linux");
    });

    it('should default to "windows" when platform is unknown and no navigator fallback', () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "unknown" } },
        writable: true,
        configurable: true,
      });
      mockNavigator("", "");

      expect(getPlatform()).toBe("windows");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not detect platform"),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should fallback to navigator.platform when window.api is undefined', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("MacIntel", "");

      expect(getPlatform()).toBe("macos");
    });

    it('should fallback to navigator.platform for Windows when window.api is undefined', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("Win32", "");

      expect(getPlatform()).toBe("windows");
    });

    it('should fallback to navigator.platform for Linux when window.api is undefined', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("Linux x86_64", "");

      expect(getPlatform()).toBe("linux");
    });

    it('should fallback to userAgent when both api and navigator.platform are unavailable', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

      expect(getPlatform()).toBe("macos");
    });

    it('should fallback to userAgent for Windows when navigator.platform is unavailable', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

      expect(getPlatform()).toBe("windows");
    });

    it('should fallback to userAgent for Linux when navigator.platform is unavailable', () => {
      Object.defineProperty(window, "api", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockNavigator("", "Mozilla/5.0 (X11; Linux x86_64)");

      expect(getPlatform()).toBe("linux");
    });

    it('should default to "windows" when all detection methods fail', () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      Object.defineProperty(window, "api", {
        value: { system: {} },
        writable: true,
        configurable: true,
      });
      mockNavigator("", "");

      expect(getPlatform()).toBe("windows");
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("isMacOS", () => {
    it("should return true on macOS", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "darwin" } },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(true);
    });

    it("should return false on Windows", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "win32" } },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(false);
    });

    it("should return false on Linux", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "linux" } },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(false);
    });
  });

  describe("isWindows", () => {
    it("should return true on Windows", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "win32" } },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(true);
    });

    it("should return false on macOS", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "darwin" } },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(false);
    });

    it("should return false on Linux", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "linux" } },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(false);
    });
  });

  describe("isLinux", () => {
    it("should return true on Linux", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "linux" } },
        writable: true,
        configurable: true,
      });

      expect(isLinux()).toBe(true);
    });

    it("should return false on macOS", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "darwin" } },
        writable: true,
        configurable: true,
      });

      expect(isLinux()).toBe(false);
    });

    it("should return false on Windows", () => {
      Object.defineProperty(window, "api", {
        value: { ...originalApi, system: { ...originalApi?.system, platform: "win32" } },
        writable: true,
        configurable: true,
      });

      expect(isLinux()).toBe(false);
    });
  });

  describe("platformFeatures", () => {
    it("should have localMessagesAccess only for macOS", () => {
      expect(platformFeatures.localMessagesAccess).toEqual(["macos"]);
    });

    it("should have localContactsAccess only for macOS", () => {
      expect(platformFeatures.localContactsAccess).toEqual(["macos"]);
    });

    it("should have iPhoneUSBSync for Windows and Linux", () => {
      expect(platformFeatures.iPhoneUSBSync).toEqual(["windows", "linux"]);
    });

    it("should have emailIntegration for all platforms", () => {
      expect(platformFeatures.emailIntegration).toEqual([
        "macos",
        "windows",
        "linux",
      ]);
    });
  });

  describe("isFeatureAvailable", () => {
    describe("on macOS", () => {
      beforeEach(() => {
        Object.defineProperty(window, "api", {
          value: { ...originalApi, system: { ...originalApi?.system, platform: "darwin" } },
          writable: true,
          configurable: true,
        });
      });

      it("should have localMessagesAccess available", () => {
        expect(isFeatureAvailable("localMessagesAccess")).toBe(true);
      });

      it("should have localContactsAccess available", () => {
        expect(isFeatureAvailable("localContactsAccess")).toBe(true);
      });

      it("should NOT have iPhoneUSBSync available", () => {
        expect(isFeatureAvailable("iPhoneUSBSync")).toBe(false);
      });

      it("should have emailIntegration available", () => {
        expect(isFeatureAvailable("emailIntegration")).toBe(true);
      });
    });

    describe("on Windows", () => {
      beforeEach(() => {
        Object.defineProperty(window, "api", {
          value: { ...originalApi, system: { ...originalApi?.system, platform: "win32" } },
          writable: true,
          configurable: true,
        });
      });

      it("should NOT have localMessagesAccess available", () => {
        expect(isFeatureAvailable("localMessagesAccess")).toBe(false);
      });

      it("should NOT have localContactsAccess available", () => {
        expect(isFeatureAvailable("localContactsAccess")).toBe(false);
      });

      it("should have iPhoneUSBSync available", () => {
        expect(isFeatureAvailable("iPhoneUSBSync")).toBe(true);
      });

      it("should have emailIntegration available", () => {
        expect(isFeatureAvailable("emailIntegration")).toBe(true);
      });
    });

    describe("on Linux", () => {
      beforeEach(() => {
        Object.defineProperty(window, "api", {
          value: { ...originalApi, system: { ...originalApi?.system, platform: "linux" } },
          writable: true,
          configurable: true,
        });
      });

      it("should NOT have localMessagesAccess available", () => {
        expect(isFeatureAvailable("localMessagesAccess")).toBe(false);
      });

      it("should NOT have localContactsAccess available", () => {
        expect(isFeatureAvailable("localContactsAccess")).toBe(false);
      });

      it("should have iPhoneUSBSync available", () => {
        expect(isFeatureAvailable("iPhoneUSBSync")).toBe(true);
      });

      it("should have emailIntegration available", () => {
        expect(isFeatureAvailable("emailIntegration")).toBe(true);
      });
    });
  });
});
