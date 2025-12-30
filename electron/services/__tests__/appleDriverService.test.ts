/**
 * Apple Driver Service Tests
 *
 * Tests for Windows Apple driver detection and installation service.
 * These tests verify the service behavior on non-Windows platforms and mock
 * the Windows-specific functionality.
 *
 * FIX (TASK-804): Resolved flaky test issues by:
 * - Adding proper beforeEach/afterEach for mock cleanup
 * - Mocking child_process.exec to avoid real system calls
 * - Removing extended timeout since we now use deterministic mocks
 */

import {
  checkAppleDrivers,
  installAppleDrivers,
  hasBundledDrivers,
  getBundledDriverPath,
  getITunesDownloadUrl,
  getITunesWebUrl,
  AppleDriverStatus,
  DriverInstallResult,
} from "../appleDriverService";

// Mock child_process to prevent real system calls and timing issues
jest.mock("child_process", () => ({
  exec: jest.fn((cmd, opts, callback) => {
    // If callback is provided as second arg (no opts)
    if (typeof opts === "function") {
      callback = opts;
    }
    // Simulate registry/service not found on non-Windows
    const error = new Error("Command not found");
    (error as NodeJS.ErrnoException).code = "ENOENT";
    if (callback) {
      callback(error, "", "");
    }
    return { on: jest.fn(), stdout: { on: jest.fn() }, stderr: { on: jest.fn() } };
  }),
  spawn: jest.fn(() => ({
    on: jest.fn((event, cb) => {
      if (event === "close") {
        // Simulate exit code 1 (not on Windows)
        setTimeout(() => cb(1), 0);
      }
    }),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

// Mock fs to prevent file system access issues
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

describe("AppleDriverService", () => {
  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Clean up after all tests
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("checkAppleDrivers", () => {
    it("should return installed status on non-Windows platforms", async () => {
      // On non-Windows, drivers are not needed
      if (process.platform !== "win32") {
        const status = await checkAppleDrivers();

        expect(status.isInstalled).toBe(true);
        expect(status.serviceRunning).toBe(true);
        expect(status.error).toBeNull();
      }
    });

    it("should return proper status structure", async () => {
      const status = await checkAppleDrivers();

      expect(status).toHaveProperty("isInstalled");
      expect(status).toHaveProperty("version");
      expect(status).toHaveProperty("serviceRunning");
      expect(status).toHaveProperty("error");

      expect(typeof status.isInstalled).toBe("boolean");
      expect(typeof status.serviceRunning).toBe("boolean");
      expect(
        status.version === null || typeof status.version === "string",
      ).toBe(true);
      expect(status.error === null || typeof status.error === "string").toBe(
        true,
      );
    });
  });

  describe("installAppleDrivers", () => {
    it("should return error on non-Windows platforms", async () => {
      if (process.platform !== "win32") {
        const result = await installAppleDrivers();

        expect(result.success).toBe(false);
        expect(result.error).toContain("Windows");
        expect(result.rebootRequired).toBe(false);
      }
    });

    it("should return proper result structure", async () => {
      const result = await installAppleDrivers();

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("rebootRequired");

      expect(typeof result.success).toBe("boolean");
      expect(typeof result.rebootRequired).toBe("boolean");
      expect(result.error === null || typeof result.error === "string").toBe(
        true,
      );
    });
  });

  describe("getBundledDriverPath", () => {
    it("should return null or valid path", () => {
      const path = getBundledDriverPath();

      // Should return null if MSI not present, or a string path
      expect(path === null || typeof path === "string").toBe(true);

      if (path !== null) {
        expect(path).toContain("AppleMobileDeviceSupport");
        expect(path.endsWith(".msi")).toBe(true);
      }
    });
  });

  describe("hasBundledDrivers", () => {
    it("should return boolean", () => {
      const result = hasBundledDrivers();

      expect(typeof result).toBe("boolean");
    });

    it("should be consistent with getBundledDriverPath", () => {
      const hasBundled = hasBundledDrivers();
      const path = getBundledDriverPath();

      if (hasBundled) {
        expect(path).not.toBeNull();
      } else {
        expect(path).toBeNull();
      }
    });
  });

  describe("getITunesDownloadUrl", () => {
    it("should return Microsoft Store URL", () => {
      const url = getITunesDownloadUrl();

      expect(typeof url).toBe("string");
      expect(url).toContain("ms-windows-store://");
      expect(url).toContain("ProductId");
    });
  });

  describe("getITunesWebUrl", () => {
    it("should return Apple website URL", () => {
      const url = getITunesWebUrl();

      expect(typeof url).toBe("string");
      expect(url).toContain("apple.com");
      expect(url).toContain("itunes");
    });
  });

  describe("AppleDriverStatus interface", () => {
    it("should support all status properties", () => {
      const status: AppleDriverStatus = {
        isInstalled: true,
        version: "12.0.0",
        serviceRunning: true,
        error: null,
      };

      expect(status.isInstalled).toBe(true);
      expect(status.version).toBe("12.0.0");
      expect(status.serviceRunning).toBe(true);
      expect(status.error).toBeNull();
    });

    it("should support null version", () => {
      const status: AppleDriverStatus = {
        isInstalled: false,
        version: null,
        serviceRunning: false,
        error: "Drivers not found",
      };

      expect(status.version).toBeNull();
      expect(status.error).toBe("Drivers not found");
    });
  });

  describe("DriverInstallResult interface", () => {
    it("should support successful installation", () => {
      const result: DriverInstallResult = {
        success: true,
        error: null,
        rebootRequired: false,
      };

      expect(result.success).toBe(true);
      expect(result.rebootRequired).toBe(false);
    });

    it("should support installation requiring reboot", () => {
      const result: DriverInstallResult = {
        success: true,
        error: null,
        rebootRequired: true,
      };

      expect(result.rebootRequired).toBe(true);
    });

    it("should support failed installation", () => {
      const result: DriverInstallResult = {
        success: false,
        error: "Installation cancelled",
        rebootRequired: false,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Installation cancelled");
    });
  });
});

describe("AppleDriverService Windows-specific (mocked)", () => {
  // These tests run with mocked Windows APIs
  // Mocks are defined at the top of this file

  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registry check", () => {
    it("should handle registry not found gracefully", async () => {
      // This tests the error handling when registry keys don't exist
      const status = await checkAppleDrivers();

      // Should not throw, should return a valid status
      expect(status).toBeDefined();
      expect(typeof status.isInstalled).toBe("boolean");
    });
  });

  describe("service status check", () => {
    it("should handle service not running", async () => {
      const status = await checkAppleDrivers();

      // On non-Windows or when service not found, should not throw
      expect(status).toBeDefined();
      expect(typeof status.serviceRunning).toBe("boolean");
    });
  });

  describe("MSI installation", () => {
    it("should handle missing MSI file gracefully", async () => {
      // If no MSI is bundled, should return appropriate error
      if (!hasBundledDrivers() && process.platform === "win32") {
        const result = await installAppleDrivers();

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      }
    });
  });
});
