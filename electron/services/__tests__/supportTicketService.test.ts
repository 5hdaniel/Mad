/**
 * Support Ticket Service Tests
 * TASK-2180: Desktop In-App Support Ticket Dialog with Diagnostics
 */

import { collectDiagnostics, captureScreenshot } from "../supportTicketService";

// Mock electron
jest.mock("electron", () => ({
  app: {
    getVersion: jest.fn().mockReturnValue("2.9.5"),
  },
  BrowserWindow: {
    getFocusedWindow: jest.fn(),
  },
}));

// Mock os module
jest.mock("os", () => ({
  release: jest.fn().mockReturnValue("24.6.0"),
  homedir: jest.fn().mockReturnValue("/Users/testuser"),
}));

// Mock databaseService
jest.mock("../databaseService", () => ({
  __esModule: true,
  default: {
    isInitialized: jest.fn().mockReturnValue(true),
  },
}));

// Mock databaseEncryptionService
jest.mock("../databaseEncryptionService", () => ({
  __esModule: true,
  default: {
    isEncryptionAvailable: jest.fn().mockReturnValue(true),
  },
}));

// Mock syncStatusService
jest.mock("../syncStatusService", () => ({
  syncStatusService: {
    getStatus: jest.fn().mockReturnValue({
      isAnyOperationRunning: false,
      currentOperation: null,
    }),
  },
}));

// Mock deviceService
jest.mock("../deviceService", () => ({
  getDeviceId: jest.fn().mockReturnValue("device-abc-123"),
}));

// Mock failureLogService
jest.mock("../failureLogService", () => ({
  __esModule: true,
  default: {
    getRecentFailures: jest.fn().mockResolvedValue([
      {
        id: 1,
        timestamp: "2026-03-13T10:00:00Z",
        operation: "outlook_sync",
        error_message: "Connection timeout after 30s",
        metadata: null,
        acknowledged: 0,
      },
      {
        id: 2,
        timestamp: "2026-03-13T09:00:00Z",
        operation: "gmail_sync",
        error_message: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.long_token_here was invalid",
        metadata: null,
        acknowledged: 0,
      },
    ]),
  },
}));

// Mock sessionService
jest.mock("../sessionService", () => ({
  __esModule: true,
  default: {
    loadSession: jest.fn().mockResolvedValue({
      user: { id: "user-123" },
    }),
  },
}));

// Mock connectionStatusService
jest.mock("../connectionStatusService", () => ({
  __esModule: true,
  default: {
    checkAllConnections: jest.fn().mockResolvedValue({
      google: { connected: false, lastCheck: Date.now(), error: null },
      microsoft: { connected: false, lastCheck: Date.now(), error: null },
      allConnected: false,
      anyConnected: false,
    }),
  },
}));

// Mock logService
jest.mock("../logService", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock process
const originalProcess = process;
beforeAll(() => {
  Object.defineProperty(process, "versions", {
    value: { ...process.versions, electron: "35.7.5", node: "20.18.0" },
    configurable: true,
  });
  Object.defineProperty(process, "platform", {
    value: "darwin",
    configurable: true,
  });
  Object.defineProperty(process, "arch", {
    value: "arm64",
    configurable: true,
  });
});

afterAll(() => {
  Object.defineProperty(process, "versions", {
    value: originalProcess.versions,
    configurable: true,
  });
});

describe("supportTicketService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("collectDiagnostics", () => {
    it("should return all expected diagnostic fields", async () => {
      const diagnostics = await collectDiagnostics();

      expect(diagnostics).toBeDefined();
      expect(diagnostics.app_version).toBe("2.9.5");
      expect(diagnostics.electron_version).toBe("35.7.5");
      expect(diagnostics.os_platform).toBe("darwin");
      expect(diagnostics.os_version).toBe("24.6.0");
      expect(diagnostics.os_arch).toBe("arm64");
      expect(diagnostics.node_version).toBe("20.18.0");
      expect(diagnostics.db_initialized).toBe(true);
      expect(diagnostics.db_encrypted).toBe(true);
      expect(diagnostics.sync_status).toEqual({
        is_running: false,
        current_operation: null,
      });
      expect(diagnostics.device_id).toBe("device-abc-123");
      expect(typeof diagnostics.uptime_seconds).toBe("number");
      expect(diagnostics.collected_at).toBeDefined();
      expect(diagnostics.memory_usage).toBeDefined();
      expect(diagnostics.memory_usage.rss).toBeGreaterThan(0);
    });

    it("should include sanitized recent errors", async () => {
      const diagnostics = await collectDiagnostics();

      expect(diagnostics.recent_errors).toHaveLength(2);
      expect(diagnostics.recent_errors[0].operation).toBe("outlook_sync");
      expect(diagnostics.recent_errors[0].error_message).toBe(
        "Connection timeout after 30s"
      );
    });

    it("should sanitize bearer tokens from error messages", async () => {
      const diagnostics = await collectDiagnostics();

      // The second error had a Bearer token that should be redacted
      const secondError = diagnostics.recent_errors[1];
      expect(secondError.error_message).not.toContain("eyJhbGciOiJSUzI1NiI");
      expect(secondError.error_message).toContain("[REDACTED]");
    });

    it("should replace home directory paths with ~", async () => {
      const os = require("os");
      os.homedir.mockReturnValue("/Users/testuser");

      // Mock failureLogService to return an error with a path
      const failureLogService = require("../failureLogService").default;
      failureLogService.getRecentFailures.mockResolvedValue([
        {
          id: 3,
          timestamp: "2026-03-13T10:00:00Z",
          operation: "file_access",
          error_message: "Cannot read /Users/testuser/Documents/secret.txt",
          metadata: null,
          acknowledged: 0,
        },
      ]);

      const diagnostics = await collectDiagnostics();

      expect(diagnostics.recent_errors[0].error_message).not.toContain(
        "/Users/testuser"
      );
      expect(diagnostics.recent_errors[0].error_message).toContain("~");
    });

    it("should handle partial failure gracefully", async () => {
      // Make one service throw
      const databaseService = require("../databaseService").default;
      databaseService.isInitialized.mockImplementation(() => {
        throw new Error("DB not ready");
      });

      const diagnostics = await collectDiagnostics();

      // Should still return diagnostics, just with default value for db_initialized
      expect(diagnostics).toBeDefined();
      expect(diagnostics.db_initialized).toBe(false); // Default/fallback
      expect(diagnostics.app_version).toBe("2.9.5"); // Other fields still work
    });

    it("should handle failureLogService errors gracefully", async () => {
      const failureLogService = require("../failureLogService").default;
      failureLogService.getRecentFailures.mockRejectedValue(
        new Error("DB locked")
      );

      const diagnostics = await collectDiagnostics();

      expect(diagnostics).toBeDefined();
      expect(diagnostics.recent_errors).toEqual([]); // Empty array on failure
    });

    it("should sanitize email addresses from error messages", async () => {
      const failureLogService = require("../failureLogService").default;
      failureLogService.getRecentFailures.mockResolvedValue([
        {
          id: 4,
          timestamp: "2026-03-13T10:00:00Z",
          operation: "email_sync",
          error_message: "Failed to sync for user@example.com",
          metadata: null,
          acknowledged: 0,
        },
      ]);

      const diagnostics = await collectDiagnostics();

      expect(diagnostics.recent_errors[0].error_message).not.toContain(
        "user@example.com"
      );
      expect(diagnostics.recent_errors[0].error_message).toContain(
        "[REDACTED_EMAIL]"
      );
    });

    it("should truncate long error messages", async () => {
      const failureLogService = require("../failureLogService").default;
      const longMessage = "A".repeat(500);
      failureLogService.getRecentFailures.mockResolvedValue([
        {
          id: 5,
          timestamp: "2026-03-13T10:00:00Z",
          operation: "sync",
          error_message: longMessage,
          metadata: null,
          acknowledged: 0,
        },
      ]);

      const diagnostics = await collectDiagnostics();

      // Should be truncated to 200 chars + "..."
      expect(diagnostics.recent_errors[0].error_message.length).toBeLessThanOrEqual(203);
    });
  });

  describe("captureScreenshot", () => {
    it("should return null when no focused window", async () => {
      const { BrowserWindow } = require("electron");
      BrowserWindow.getFocusedWindow.mockReturnValue(null);

      const result = await captureScreenshot();
      expect(result).toBeNull();
    });

    it("should return base64 PNG when window is available", async () => {
      const { BrowserWindow } = require("electron");
      const mockPngBuffer = Buffer.from("fake-png-data");
      BrowserWindow.getFocusedWindow.mockReturnValue({
        webContents: {
          capturePage: jest.fn().mockResolvedValue({
            toPNG: jest.fn().mockReturnValue(mockPngBuffer),
          }),
        },
      });

      const result = await captureScreenshot();
      expect(result).toBe(mockPngBuffer.toString("base64"));
    });

    it("should return null on error", async () => {
      const { BrowserWindow } = require("electron");
      BrowserWindow.getFocusedWindow.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await captureScreenshot();
      expect(result).toBeNull();
    });
  });
});
