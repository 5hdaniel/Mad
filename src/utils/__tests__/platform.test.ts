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
  Platform,
} from "../platform";

// Store original window.electron
const originalElectron = window.electron;

describe("Platform Detection Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, "electron", {
      value: originalElectron,
      writable: true,
      configurable: true,
    });
  });

  describe("getPlatform", () => {
    it('should return "macos" when platform is darwin', () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "darwin" },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("macos");
    });

    it('should return "windows" when platform is win32', () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "win32" },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("windows");
    });

    it('should return "linux" when platform is linux', () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "linux" },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("linux");
    });

    it('should default to "windows" when platform is unknown', () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      Object.defineProperty(window, "electron", {
        value: { platform: "unknown" },
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("windows");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Platform] Unknown platform detected: "unknown"',
        ),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should default to "windows" when window.electron is undefined', () => {
      Object.defineProperty(window, "electron", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("windows");
    });

    it('should default to "windows" when platform property is missing', () => {
      Object.defineProperty(window, "electron", {
        value: {},
        writable: true,
        configurable: true,
      });

      expect(getPlatform()).toBe("windows");
    });
  });

  describe("isMacOS", () => {
    it("should return true on macOS", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "darwin" },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(true);
    });

    it("should return false on Windows", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "win32" },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(false);
    });

    it("should return false on Linux", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "linux" },
        writable: true,
        configurable: true,
      });

      expect(isMacOS()).toBe(false);
    });
  });

  describe("isWindows", () => {
    it("should return true on Windows", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "win32" },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(true);
    });

    it("should return false on macOS", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "darwin" },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(false);
    });

    it("should return false on Linux", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "linux" },
        writable: true,
        configurable: true,
      });

      expect(isWindows()).toBe(false);
    });
  });

  describe("isLinux", () => {
    it("should return true on Linux", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "linux" },
        writable: true,
        configurable: true,
      });

      expect(isLinux()).toBe(true);
    });

    it("should return false on macOS", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "darwin" },
        writable: true,
        configurable: true,
      });

      expect(isLinux()).toBe(false);
    });

    it("should return false on Windows", () => {
      Object.defineProperty(window, "electron", {
        value: { platform: "win32" },
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
        Object.defineProperty(window, "electron", {
          value: { platform: "darwin" },
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
        Object.defineProperty(window, "electron", {
          value: { platform: "win32" },
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
        Object.defineProperty(window, "electron", {
          value: { platform: "linux" },
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
