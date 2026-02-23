/**
 * Unit tests for Failure Log Handlers (TASK-2058)
 * Tests failure log IPC handlers:
 * - failure-log:get-recent
 * - failure-log:get-count
 * - failure-log:acknowledge-all
 * - failure-log:clear
 */

// Mock electron module
const mockIpcHandle = jest.fn();

jest.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

// Mock failureLogService
const mockGetRecentFailures = jest.fn();
const mockGetFailureCount = jest.fn();
const mockAcknowledgeAll = jest.fn();
const mockClearLog = jest.fn();

jest.mock("../services/failureLogService", () => ({
  __esModule: true,
  default: {
    getRecentFailures: mockGetRecentFailures,
    getFailureCount: mockGetFailureCount,
    acknowledgeAll: mockAcknowledgeAll,
    clearLog: mockClearLog,
  },
}));

// Mock logService
jest.mock("../services/logService", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { registerFailureLogHandlers } from "../handlers/failureLogHandlers";

describe("Failure Log Handlers", () => {
  // Store handlers keyed by channel name
  const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  beforeAll(() => {
    registerFailureLogHandlers();

    // Capture registered handlers
    for (const call of mockIpcHandle.mock.calls) {
      const [channel, handler] = call;
      handlers[channel] = handler;
    }
  });

  beforeEach(() => {
    // Clear mocks but keep the handlers captured in beforeAll
    mockGetRecentFailures.mockReset();
    mockGetFailureCount.mockReset();
    mockAcknowledgeAll.mockReset();
    mockClearLog.mockReset();
  });

  it("should register all 4 failure log handlers", () => {
    // handlers were captured in beforeAll before any resets
    expect(Object.keys(handlers)).toHaveLength(4);
    expect(handlers["failure-log:get-recent"]).toBeDefined();
    expect(handlers["failure-log:get-count"]).toBeDefined();
    expect(handlers["failure-log:acknowledge-all"]).toBeDefined();
    expect(handlers["failure-log:clear"]).toBeDefined();
  });

  describe("failure-log:get-recent", () => {
    it("should return recent failure entries", async () => {
      const mockEntries = [
        {
          id: 1,
          timestamp: "2026-02-22 12:00:00",
          operation: "outlook_contacts_sync",
          error_message: "Network error",
          metadata: null,
          acknowledged: 0,
        },
      ];
      mockGetRecentFailures.mockResolvedValue(mockEntries);

      const result = await handlers["failure-log:get-recent"]({}, 10);

      expect(result).toEqual({ success: true, entries: mockEntries });
      expect(mockGetRecentFailures).toHaveBeenCalledWith(10);
    });

    it("should use default limit when none provided", async () => {
      mockGetRecentFailures.mockResolvedValue([]);

      await handlers["failure-log:get-recent"]({}, undefined);

      expect(mockGetRecentFailures).toHaveBeenCalledWith(undefined);
    });

    it("should handle service errors gracefully", async () => {
      mockGetRecentFailures.mockRejectedValue(new Error("DB error"));

      const result = await handlers["failure-log:get-recent"]({}, 10);

      expect(result).toEqual({
        success: false,
        entries: [],
        error: "DB error",
      });
    });
  });

  describe("failure-log:get-count", () => {
    it("should return unacknowledged failure count", async () => {
      mockGetFailureCount.mockResolvedValue(5);

      const result = await handlers["failure-log:get-count"]({});

      expect(result).toEqual({ success: true, count: 5 });
    });

    it("should return 0 when no failures", async () => {
      mockGetFailureCount.mockResolvedValue(0);

      const result = await handlers["failure-log:get-count"]({});

      expect(result).toEqual({ success: true, count: 0 });
    });

    it("should handle service errors gracefully", async () => {
      mockGetFailureCount.mockRejectedValue(new Error("DB error"));

      const result = await handlers["failure-log:get-count"]({});

      expect(result).toEqual({
        success: false,
        count: 0,
        error: "DB error",
      });
    });
  });

  describe("failure-log:acknowledge-all", () => {
    it("should acknowledge all failures", async () => {
      mockAcknowledgeAll.mockResolvedValue(undefined);

      const result = await handlers["failure-log:acknowledge-all"]({});

      expect(result).toEqual({ success: true });
      expect(mockAcknowledgeAll).toHaveBeenCalledTimes(1);
    });

    it("should handle service errors gracefully", async () => {
      mockAcknowledgeAll.mockRejectedValue(new Error("DB error"));

      const result = await handlers["failure-log:acknowledge-all"]({});

      expect(result).toEqual({
        success: false,
        error: "DB error",
      });
    });
  });

  describe("failure-log:clear", () => {
    it("should clear the failure log", async () => {
      mockClearLog.mockResolvedValue(undefined);

      const result = await handlers["failure-log:clear"]({});

      expect(result).toEqual({ success: true });
      expect(mockClearLog).toHaveBeenCalledTimes(1);
    });

    it("should handle service errors gracefully", async () => {
      mockClearLog.mockRejectedValue(new Error("DB error"));

      const result = await handlers["failure-log:clear"]({});

      expect(result).toEqual({
        success: false,
        error: "DB error",
      });
    });
  });
});
