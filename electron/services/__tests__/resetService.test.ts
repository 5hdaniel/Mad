/**
 * Reset Service Tests
 * TASK-1802: Reset App Data Self-Healing Feature
 */

// Mock fs/promises
const mockRm = jest.fn().mockResolvedValue(undefined);
jest.mock("fs/promises", () => ({
  rm: mockRm,
}));

// Mock electron
const mockApp = {
  getPath: jest.fn().mockReturnValue("/mock/userData"),
  relaunch: jest.fn(),
  exit: jest.fn(),
};
jest.mock("electron", () => ({
  app: mockApp,
}));

// Mock logService
jest.mock("../logService", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock sessionService with __esModule for default export
const mockClearSession = jest.fn().mockResolvedValue(true);
jest.mock("../sessionService", () => ({
  __esModule: true,
  default: {
    clearSession: mockClearSession,
  },
}));

// Mock errorLoggingService
const mockSubmitError = jest.fn().mockResolvedValue({ success: true });
jest.mock("../errorLoggingService", () => ({
  getErrorLoggingService: jest.fn().mockReturnValue({
    submitError: mockSubmitError,
  }),
}));

import { getResetService, type ResetResult } from "../resetService";

describe("ResetService", () => {
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    // Reset all mocks between tests
    jest.clearAllMocks();

    // Reset mock implementations
    mockRm.mockResolvedValue(undefined);
    mockClearSession.mockResolvedValue(true);
    mockSubmitError.mockResolvedValue({ success: true });

    // Speed up tests by making setTimeout instant
    originalSetTimeout = global.setTimeout;
    global.setTimeout = ((fn: () => void) => fn()) as unknown as typeof setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = getResetService();
      const instance2 = getResetService();
      expect(instance1).toBe(instance2);
    });
  });

  describe("performReset", () => {
    it("should log the reset action to Supabase", async () => {
      const service = getResetService();
      await service.performReset();

      expect(mockSubmitError).toHaveBeenCalledWith({
        errorType: "user_reset",
        errorMessage: "User initiated app data reset from ErrorScreen",
        currentScreen: "ErrorScreen",
        appState: expect.objectContaining({
          action: "reset_app_data",
        }),
      });
    });

    it("should clear the session", async () => {
      const service = getResetService();
      await service.performReset();

      expect(mockClearSession).toHaveBeenCalled();
    });

    it("should clear the userData directory", async () => {
      const service = getResetService();
      await service.performReset();

      expect(mockApp.getPath).toHaveBeenCalledWith("userData");
      expect(mockRm).toHaveBeenCalledWith("/mock/userData", {
        recursive: true,
        force: true,
      });
    });

    it("should relaunch the app after reset", async () => {
      const service = getResetService();
      await service.performReset();

      expect(mockApp.relaunch).toHaveBeenCalled();
      expect(mockApp.exit).toHaveBeenCalledWith(0);
    });

    it("should return success: true on successful reset", async () => {
      const service = getResetService();
      const result: ResetResult = await service.performReset();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should continue reset even if error logging fails", async () => {
      mockSubmitError.mockRejectedValue(new Error("Network error"));

      const service = getResetService();
      const result = await service.performReset();

      // Reset should still proceed
      expect(mockRm).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should continue reset even if session clearing fails", async () => {
      mockClearSession.mockRejectedValue(new Error("Session error"));

      const service = getResetService();
      const result = await service.performReset();

      // Reset should still proceed
      expect(mockRm).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should return error if clearing app data fails", async () => {
      mockRm.mockRejectedValue(new Error("Permission denied"));

      const service = getResetService();
      const result = await service.performReset();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Permission denied");
    });
  });
});
