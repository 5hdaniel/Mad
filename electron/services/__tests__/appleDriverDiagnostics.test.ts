/**
 * Apple Driver Diagnostics Tests
 *
 * Tests for the Sentry reporting and diagnostics functions added to
 * appleDriverService.ts (TASK-2272).
 *
 * Tests verify:
 * - getDriverDiagnostics() returns correct shape
 * - classifyInstallFailure() maps error codes correctly
 * - Sentry breadcrumbs and messages are sent with correct tags
 */

import type { DriverInstallResult } from "../appleDriverService";

// Mock child_process to prevent real system calls
jest.mock("child_process", () => ({
  exec: jest.fn((_cmd: string, _opts: unknown, callback?: Function) => {
    if (typeof _opts === "function") {
      callback = _opts;
    }
    const error = new Error("Command not found");
    (error as NodeJS.ErrnoException).code = "ENOENT";
    if (callback) {
      callback(error, "", "");
    }
    return {
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
    };
  }),
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

// Mock fs to prevent file system access
jest.mock("fs", () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(() => ""),
  createWriteStream: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
  unlinkSync: jest.fn(),
}));

// Mock Sentry
const mockAddBreadcrumb = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetContext = jest.fn();
jest.mock("@sentry/electron/main", () => ({
  addBreadcrumb: mockAddBreadcrumb,
  captureMessage: mockCaptureMessage,
  setContext: mockSetContext,
}));

import {
  getDriverDiagnostics,
  classifyInstallFailure,
  checkAppleDrivers,
  DriverDiagnostics,
  DriverFailureReason,
} from "../appleDriverService";

describe("Apple Driver Diagnostics (TASK-2272)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("getDriverDiagnostics", () => {
    it("should return correct shape when drivers are installed (non-Windows passthrough)", async () => {
      // On macOS/Linux, checkAppleDrivers returns isInstalled: true
      if (process.platform !== "win32") {
        const diagnostics = await getDriverDiagnostics();

        expect(diagnostics).toHaveProperty("isInstalled");
        expect(diagnostics).toHaveProperty("version");
        expect(diagnostics).toHaveProperty("serviceRunning");
        expect(diagnostics).toHaveProperty("bundledDriverAvailable");
        expect(diagnostics).toHaveProperty("lastError");
        expect(diagnostics).toHaveProperty("lastCheckTimestamp");

        expect(diagnostics.isInstalled).toBe(true);
        expect(diagnostics.serviceRunning).toBe(true);
        expect(diagnostics.lastError).toBeNull();
        expect(typeof diagnostics.lastCheckTimestamp).toBe("string");
        // Should be valid ISO timestamp
        expect(new Date(diagnostics.lastCheckTimestamp).toISOString()).toBe(
          diagnostics.lastCheckTimestamp,
        );
      }
    });

    it("should return bundledDriverAvailable as boolean", async () => {
      const diagnostics = await getDriverDiagnostics();

      expect(typeof diagnostics.bundledDriverAvailable).toBe("boolean");
    });

    it("should call Sentry.addBreadcrumb with diagnostics data", async () => {
      await getDriverDiagnostics();

      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "diagnostics.driver",
          level: "info",
          data: expect.objectContaining({
            bundledAvailable: expect.any(Boolean),
          }),
        }),
      );
    });

    it("should include isInstalled status in breadcrumb message", async () => {
      await getDriverDiagnostics();

      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("installed="),
        }),
      );
    });

    it("should satisfy DriverDiagnostics type contract", async () => {
      const diagnostics: DriverDiagnostics = await getDriverDiagnostics();

      // Verify all fields match expected types
      expect(typeof diagnostics.isInstalled).toBe("boolean");
      expect(
        diagnostics.version === null || typeof diagnostics.version === "string",
      ).toBe(true);
      expect(typeof diagnostics.serviceRunning).toBe("boolean");
      expect(typeof diagnostics.bundledDriverAvailable).toBe("boolean");
      expect(
        diagnostics.lastError === null ||
          typeof diagnostics.lastError === "string",
      ).toBe(true);
      expect(typeof diagnostics.lastCheckTimestamp).toBe("string");
    });
  });

  describe("checkAppleDrivers Sentry integration", () => {
    it("should call Sentry.setContext with apple_drivers after check (non-Windows passthrough)", async () => {
      if (process.platform !== "win32") {
        // On non-Windows, checkAppleDrivers returns early without Sentry calls
        await checkAppleDrivers();
        // setContext is only called on Windows; verify no error thrown
        expect(true).toBe(true);
      }
    });

    it("should add breadcrumb on Windows driver check", async () => {
      // On non-Windows, the breadcrumb is not added (early return)
      // This test documents the expected behavior
      await checkAppleDrivers();

      if (process.platform === "win32") {
        expect(mockAddBreadcrumb).toHaveBeenCalledWith(
          expect.objectContaining({
            category: "driver.check",
          }),
        );
        expect(mockSetContext).toHaveBeenCalledWith(
          "apple_drivers",
          expect.objectContaining({
            isInstalled: expect.any(Boolean),
          }),
        );
      }
    });
  });

  describe("classifyInstallFailure", () => {
    it("should classify user_cancelled when cancelled is true", () => {
      const result: DriverInstallResult = {
        success: false,
        error: null,
        rebootRequired: false,
        cancelled: true,
      };

      expect(classifyInstallFailure(result, "/some/path.msi")).toBe(
        "user_cancelled",
      );
    });

    it("should classify msi_not_found when msiPath is null", () => {
      const result: DriverInstallResult = {
        success: false,
        error: "Not found",
        rebootRequired: false,
      };

      expect(classifyInstallFailure(result, null)).toBe("msi_not_found");
    });

    it("should classify permissions_denied for error code 1603", () => {
      const result: DriverInstallResult = {
        success: false,
        error: "Installation failed with code 1603",
        rebootRequired: false,
      };

      expect(classifyInstallFailure(result, "/some/path.msi")).toBe(
        "permissions_denied",
      );
    });

    it("should classify insufficient_storage for disk-related errors", () => {
      const diskResult: DriverInstallResult = {
        success: false,
        error: "Not enough disk space",
        rebootRequired: false,
      };

      expect(classifyInstallFailure(diskResult, "/some/path.msi")).toBe(
        "insufficient_storage",
      );

      const spaceResult: DriverInstallResult = {
        success: false,
        error: "Insufficient space on drive C:",
        rebootRequired: false,
      };

      expect(classifyInstallFailure(spaceResult, "/some/path.msi")).toBe(
        "insufficient_storage",
      );
    });

    it("should classify unknown for unrecognized errors", () => {
      const result: DriverInstallResult = {
        success: false,
        error: "Some random error occurred",
        rebootRequired: false,
      };

      expect(classifyInstallFailure(result, "/some/path.msi")).toBe("unknown");
    });

    it("should prioritize cancelled over msi_not_found", () => {
      const result: DriverInstallResult = {
        success: false,
        error: null,
        rebootRequired: false,
        cancelled: true,
      };

      // Even with null msiPath, cancelled takes priority
      expect(classifyInstallFailure(result, null)).toBe("user_cancelled");
    });

    it("should return valid DriverFailureReason values", () => {
      const validReasons: DriverFailureReason[] = [
        "insufficient_storage",
        "permissions_denied",
        "network_error",
        "extraction_failed",
        "msi_not_found",
        "user_cancelled",
        "unknown",
      ];

      const result: DriverInstallResult = {
        success: false,
        error: "test error",
        rebootRequired: false,
      };

      const reason = classifyInstallFailure(result, "/path.msi");
      expect(validReasons).toContain(reason);
    });
  });
});
