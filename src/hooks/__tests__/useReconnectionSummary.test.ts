/**
 * Unit tests for useReconnectionSummary hook (TASK-2058)
 *
 * Tests:
 * - Shows notification when coming back online with failures
 * - Does not show notification when coming back online with no failures
 * - Does not show notification when initially online
 * - Acknowledges failures after showing notification
 */

import { renderHook, act } from "@testing-library/react";

// Track the isOnline value and provide a setter
let mockIsOnline = true;

jest.mock("../../contexts/NetworkContext", () => ({
  useNetwork: jest.fn(() => ({
    isOnline: mockIsOnline,
  })),
}));

const mockNotifyWarning = jest.fn();

jest.mock("../useNotification", () => ({
  useNotification: jest.fn(() => ({
    notify: {
      warning: mockNotifyWarning,
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    },
  })),
}));

// Mock window.api.failureLog
const mockGetCount = jest.fn();
const mockAcknowledgeAll = jest.fn();

Object.defineProperty(window, "api", {
  value: {
    failureLog: {
      getCount: mockGetCount,
      acknowledgeAll: mockAcknowledgeAll,
    },
  },
  writable: true,
});

import { useReconnectionSummary } from "../useReconnectionSummary";

describe("useReconnectionSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockGetCount.mockResolvedValue({ success: true, count: 0 });
    mockAcknowledgeAll.mockResolvedValue({ success: true });
  });

  it("should not show notification when initially online", () => {
    mockIsOnline = true;

    renderHook(() => useReconnectionSummary());

    expect(mockGetCount).not.toHaveBeenCalled();
    expect(mockNotifyWarning).not.toHaveBeenCalled();
  });

  it("should show notification when coming back online with failures", async () => {
    mockIsOnline = false;
    mockGetCount.mockResolvedValue({ success: true, count: 3 });

    const { rerender } = renderHook(() => useReconnectionSummary());

    // Simulate going online
    mockIsOnline = true;
    rerender();

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mockGetCount).toHaveBeenCalled();
    expect(mockNotifyWarning).toHaveBeenCalledWith(
      expect.stringContaining("3 operation(s) failed")
    );
    expect(mockAcknowledgeAll).toHaveBeenCalled();
  });

  it("should not show notification when coming back online with no failures", async () => {
    mockIsOnline = false;
    mockGetCount.mockResolvedValue({ success: true, count: 0 });

    const { rerender } = renderHook(() => useReconnectionSummary());

    // Simulate going online
    mockIsOnline = true;
    rerender();

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mockGetCount).toHaveBeenCalled();
    expect(mockNotifyWarning).not.toHaveBeenCalled();
    expect(mockAcknowledgeAll).not.toHaveBeenCalled();
  });

  it("should handle getCount API failure gracefully", async () => {
    mockIsOnline = false;
    mockGetCount.mockRejectedValue(new Error("DB unavailable"));

    const { rerender } = renderHook(() => useReconnectionSummary());

    // Simulate going online
    mockIsOnline = true;
    rerender();

    // Wait for async operations - should not throw
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mockNotifyWarning).not.toHaveBeenCalled();
  });
});
