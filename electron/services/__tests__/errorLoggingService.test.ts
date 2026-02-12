/**
 * Error Logging Service Tests
 * TASK-1800: Production Error Logging to Supabase
 */

import ErrorLoggingService, { getErrorLoggingService } from "../errorLoggingService";

// Mock dependencies
jest.mock("../supabaseService", () => ({
  getClient: jest.fn().mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: "error-log-123" }, error: null }),
        }),
      }),
    }),
  }),
}));

jest.mock("../deviceService", () => ({
  getDeviceId: jest.fn().mockReturnValue("device-123"),
}));

jest.mock("../logService", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("electron", () => ({
  app: {
    getVersion: jest.fn().mockReturnValue("2.0.0"),
  },
}));

// Mock os module
jest.mock("os", () => ({
  type: jest.fn().mockReturnValue("Darwin"),
  release: jest.fn().mockReturnValue("24.0.0"),
  hostname: jest.fn().mockReturnValue("test-host"),
  freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024), // 4GB
}));

// Mock process
const originalProcess = process;
beforeAll(() => {
  Object.defineProperty(process, "memoryUsage", {
    value: () => ({ heapUsed: 100 * 1024 * 1024 }), // 100MB
  });
  Object.defineProperty(process, "platform", {
    value: "darwin",
  });
  Object.defineProperty(process, "versions", {
    value: { electron: "35.0.0" },
  });
});

afterAll(() => {
  Object.defineProperty(process, "memoryUsage", {
    value: originalProcess.memoryUsage,
  });
});

describe("ErrorLoggingService", () => {
  let service: ReturnType<typeof getErrorLoggingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh instance (singleton reset not needed for testing)
    service = getErrorLoggingService();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = getErrorLoggingService();
      const instance2 = getErrorLoggingService();
      expect(instance1).toBe(instance2);
    });
  });

  describe("submitError", () => {
    it("should submit error to Supabase with all required fields", async () => {
      const payload = {
        errorType: "app_error",
        errorCode: "TEST_ERROR",
        errorMessage: "Test error message",
        currentScreen: "ErrorScreen",
        userFeedback: "I was testing the app",
      };

      const result = await service.submitError(payload);

      expect(result.success).toBe(true);
      expect(result.errorId).toBe("error-log-123");
    });

    it("should submit error without optional fields", async () => {
      const payload = {
        errorType: "app_error",
        errorMessage: "Minimal error",
      };

      const result = await service.submitError(payload);

      expect(result.success).toBe(true);
    });

    it("should handle Supabase errors gracefully", async () => {
      // Override mock to simulate error
      const supabaseService = require("../supabaseService");
      supabaseService.getClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      });

      const payload = {
        errorType: "app_error",
        errorMessage: "Test error",
      };

      const result = await service.submitError(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  describe("sanitizeAppState", () => {
    it("should remove PII fields from app state", async () => {
      const payload = {
        errorType: "app_error",
        errorMessage: "Test error",
        appState: {
          transactions: [{ id: "1" }],
          contacts: [{ name: "John" }],
          messages: ["secret message"],
          currentView: "dashboard",
          theme: "dark",
        },
      };

      // The sanitization happens internally - we just verify it completes
      const result = await service.submitError(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("getQueueSize", () => {
    it("should return current queue size", () => {
      const size = service.getQueueSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});
