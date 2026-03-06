/**
 * Unit tests for useSessionValidator hook
 * TASK-2109: Tests session validation with sync-aware deferred logout
 * TASK-2114: Tests retry logic for network resilience
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

/** Helper to flush all pending microtasks */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

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
    // Only 1 call needed when valid
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(1);
  });

  it("should trigger logout after all retries when session is persistently invalid", async () => {
    mockValidateRemoteSession.mockResolvedValue({ valid: false });
    syncStateRef.isActive = false;

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
    // First attempt returns invalid, waits 3s before retry
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(1);
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();

    // Advance through retry delay 1 (3s)
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(2);
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();

    // Advance through retry delay 2 (3s) -- third and final attempt
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(3);

    // Now logout should have been triggered
    expect(alertSpy).toHaveBeenCalledWith(
      "Your session was ended from another device. Please sign in again."
    );
    expect(mockOnSessionInvalidated).toHaveBeenCalled();
  });

  it("should not trigger logout when validation succeeds on retry 2", async () => {
    // First call: invalid, second call: valid
    mockValidateRemoteSession
      .mockResolvedValueOnce({ valid: false })
      .mockResolvedValueOnce({ valid: true });

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    // Trigger initial check
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(1);

    // Advance through retry delay -- second attempt succeeds
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(2);

    // Should NOT have triggered logout
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("should not retry on network error (thrown exception) -- skip immediately", async () => {
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

    // Should only call once (no retries on thrown errors)
    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(1);
    // Should NOT logout on network errors
    expect(mockOnSessionInvalidated).not.toHaveBeenCalled();
  });

  it("should defer logout when session is invalid and sync IS running (after retries)", async () => {
    mockValidateRemoteSession.mockResolvedValue({ valid: false });
    syncStateRef.isActive = true;

    renderHook(() =>
      useSessionValidator({
        isAuthenticated: true,
        onSessionInvalidated: mockOnSessionInvalidated,
      })
    );

    // Trigger initial check
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // Advance through all retries (2 retry delays of 3s each)
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockValidateRemoteSession).toHaveBeenCalledTimes(3);

    // Logout should NOT have been called (deferred)
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
});
