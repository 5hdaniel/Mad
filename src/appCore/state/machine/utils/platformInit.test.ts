/**
 * Platform Initialization Utilities Tests
 *
 * Tests for platform detection and platform-specific behavior utilities.
 *
 * @module appCore/state/machine/utils/platformInit.test
 */

import {
  detectPlatform,
  needsKeychainPrompt,
  autoInitializesStorage,
  getDbInitMessage,
} from "./platformInit";

// ============================================
// MOCK SETUP
// ============================================

const originalNavigator = window.navigator;

function mockNavigator(platform: string, userAgent: string = "") {
  Object.defineProperty(window, "navigator", {
    value: { platform, userAgent },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  Object.defineProperty(window, "navigator", {
    value: originalNavigator,
    writable: true,
    configurable: true,
  });
});

// ============================================
// detectPlatform TESTS
// ============================================

describe("detectPlatform", () => {
  describe("macOS detection", () => {
    it("detects macOS from platform string 'MacIntel'", () => {
      mockNavigator("MacIntel", "");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(true);
      expect(result.isWindows).toBe(false);
    });

    it("detects macOS from platform string 'Mac68K'", () => {
      mockNavigator("Mac68K", "");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(true);
      expect(result.isWindows).toBe(false);
    });

    it("detects macOS from userAgent when platform is empty", () => {
      mockNavigator(
        "",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      );
      const result = detectPlatform();
      expect(result.isMacOS).toBe(true);
      expect(result.isWindows).toBe(false);
    });
  });

  describe("Windows detection", () => {
    it("detects Windows from platform string 'Win32'", () => {
      mockNavigator("Win32", "");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(false);
      expect(result.isWindows).toBe(true);
    });

    it("detects Windows from platform string 'Win64'", () => {
      mockNavigator("Win64", "");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(false);
      expect(result.isWindows).toBe(true);
    });

    it("detects Windows from userAgent when platform is empty", () => {
      mockNavigator(
        "",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
      const result = detectPlatform();
      expect(result.isMacOS).toBe(false);
      expect(result.isWindows).toBe(true);
    });
  });

  describe("unknown platform", () => {
    it("returns false for both when platform is unknown", () => {
      mockNavigator("Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64)");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(false);
      expect(result.isWindows).toBe(false);
    });

    it("handles empty platform and userAgent", () => {
      mockNavigator("", "");
      const result = detectPlatform();
      expect(result.isMacOS).toBe(false);
      expect(result.isWindows).toBe(false);
    });
  });
});

// ============================================
// needsKeychainPrompt TESTS
// ============================================

describe("needsKeychainPrompt", () => {
  it("returns true for macOS", () => {
    const platform = { isMacOS: true, isWindows: false };
    expect(needsKeychainPrompt(platform)).toBe(true);
  });

  it("returns false for Windows", () => {
    const platform = { isMacOS: false, isWindows: true };
    expect(needsKeychainPrompt(platform)).toBe(false);
  });

  it("returns false for unknown platform", () => {
    const platform = { isMacOS: false, isWindows: false };
    expect(needsKeychainPrompt(platform)).toBe(false);
  });
});

// ============================================
// autoInitializesStorage TESTS
// ============================================

describe("autoInitializesStorage", () => {
  it("returns true for Windows (DPAPI is silent)", () => {
    const platform = { isMacOS: false, isWindows: true };
    expect(autoInitializesStorage(platform)).toBe(true);
  });

  it("returns false for macOS (Keychain may prompt)", () => {
    const platform = { isMacOS: true, isWindows: false };
    expect(autoInitializesStorage(platform)).toBe(false);
  });

  it("returns false for unknown platform", () => {
    const platform = { isMacOS: false, isWindows: false };
    expect(autoInitializesStorage(platform)).toBe(false);
  });
});

// ============================================
// getDbInitMessage TESTS
// ============================================

describe("getDbInitMessage", () => {
  it("returns Keychain message for macOS", () => {
    const platform = { isMacOS: true, isWindows: false };
    expect(getDbInitMessage(platform)).toBe("Waiting for Keychain access...");
  });

  it("returns standard message for Windows", () => {
    const platform = { isMacOS: false, isWindows: true };
    expect(getDbInitMessage(platform)).toBe("Initializing secure database...");
  });

  it("returns standard message for unknown platform", () => {
    const platform = { isMacOS: false, isWindows: false };
    expect(getDbInitMessage(platform)).toBe("Initializing secure database...");
  });
});
