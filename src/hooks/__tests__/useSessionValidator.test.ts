/**
 * Unit tests for useSessionValidator hook
 * TASK-2109: Tests session validation with sync-aware deferred logout
 */

import { renderHook, act } from "@testing-library/react";
import { useSessionValidator } from "../useSessionValidator";
import { syncStateRef } from "../useIPhoneSync";

// Mock NetworkContext
const mockIsOnline = { current: true };
jest.mock("../../contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: mockIsOnline.current }),
}));

// Mock logger
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useSessionValidator", () => {
  let mockOnSessionInvalidated: jest.Mock;
  let mockValidateRemoteSession: jest.Mock;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnSessionInvalidated = jest.fn().mockResolvedValue(undefined);
    mockValidateRemoteSession = jest.fn().mockResolvedValue({ valid: true });
    alertSpy = jest.spyOn(window, "alert").mockImplementation();

    // Reset sync state
    syncStateRef.isActive = false;
    syncStateRef.deferredLogout = false;

    // Reset online state
    mockIsOnline.current = true;

    // Setup window.api mock
    (window as any).api = {
      auth: {
        validateRemoteSession: mockValidateRemoteSession,
      },
    };

    // Mock document.hidden
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    alertSpy.mockRestore();
    syncStateRef.isActive = false;
    syncStateRef.deferredLogout = false;
  });

  it("should not trigger logout when session is valid", async () => {
    mockValidateRemoteSession.mockResolvedValue({ valid: true });

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    // Trigger the initial check (5s delay)
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("should trigger logout when session is invalid and no sync running", async () => {
    mockValidateRemoteSession.mockResolvedValue({ valid: false });
    syncStateRef.isActive = false;

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Your session was ended from another device. Please sign in again."
    );
    expect(mockOnSessionInvalidated).toHaveBeenCalled();
  });

  it("should defer logout when session is invalid and sync IS running", async () => {
    mockValidateRemoteSession.mockResolvedValue({ valid: false });
    syncStateRef.isActive = true;

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Logout should NOT have been called
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    // Deferred logout flag should be set
    expect(syncStateRef.deferredLogout).toBe(true);
  });

  it("should not poll when not authenticated", async () => {
    renderHook(() =>
      useSessionValidator({
        isAuthenticated: false,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    await act(async () => {
      jest.advanceTimersByTime(65000);
      await Promise.resolve();
    });

    expect(mockValidateRemoteSession).not.toHaveBeenCalled();
  });

  it("should not poll when offline", async () => {
    mockIsOnline.current = false;

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    await act(async () => {
      jest.advanceTimersByTime(65000);
      await Promise.resolve();
    });

    expect(mockValidateRemoteSession).not.toHaveBeenCalled();
  });

  it("should handle validation errors gracefully", async () => {
    mockValidateRemoteSession.mockRejectedValue(new Error("Network error"));

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should not logout on network errors
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();
  });
});
