/**
 * Unit tests for useMacOSMessagesImport hook
 *
 * TASK-1113: Tests sync guard functionality including:
 * - Module-level guard prevents duplicate triggers
 * - React StrictMode double-mount handling
 * - Integration with shouldSkipMessagesSync
 * - Reset functionality for testing/logout
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useMacOSMessagesImport,
  resetMessagesImportTrigger,
} from "../useMacOSMessagesImport";
import {
  markOnboardingImportComplete,
  shouldSkipMessagesSync,
} from "../useAutoRefresh";

// Mock the platform context
jest.mock("../../contexts/PlatformContext", () => ({
  usePlatform: jest.fn(() => ({ isMacOS: true })),
}));

// Mock useAutoRefresh module
jest.mock("../useAutoRefresh", () => ({
  shouldSkipMessagesSync: jest.fn(() => false),
  markOnboardingImportComplete: jest.fn(),
}));

import { usePlatform } from "../../contexts/PlatformContext";

// Mock preferences API for TASK-1742
const mockPreferencesGet = jest.fn();

// Helper to flush all pending promises and timers
const flushPromisesAndTimers = async () => {
  // Flush microtask queue multiple times to handle chained promises
  // Combined with runOnlyPendingTimers to handle interleaved async effects
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    // Run any scheduled timers (like the 2-second delay in auto-import)
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  }
};

describe("useMacOSMessagesImport", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const mockImportMacOSMessages = jest.fn();

  const defaultOptions = {
    userId: "test-user-123",
    hasPermissions: true,
    isDatabaseInitialized: true,
    isOnboarding: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset the module-level flag before each test
    resetMessagesImportTrigger();

    // Reset mocks
    mockImportMacOSMessages.mockReset().mockResolvedValue({
      success: true,
      messagesImported: 100,
    });

    // Reset shouldSkipMessagesSync mock
    (shouldSkipMessagesSync as jest.Mock).mockReturnValue(false);

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Reset platform mock to macOS
    (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

    // Setup window.api mock
    (window as any).api = {
      messages: {
        importMacOSMessages: mockImportMacOSMessages,
      },
      preferences: {
        get: mockPreferencesGet,
      },
    };

    // Default: macos-native preference (TASK-1742)
    mockPreferencesGet.mockResolvedValue({
      success: true,
      preferences: { messages: { source: "macos-native" } },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should return triggerImport function and isImporting state", () => {
      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      expect(typeof result.current.triggerImport).toBe("function");
      expect(result.current.isImporting).toBe(false);
    });
  });

  describe("auto-import on startup", () => {
    it("should trigger import after 2 second delay when conditions are met", async () => {
      renderHook(() => useMacOSMessagesImport(defaultOptions));

      // TASK-1742: Wait for preference to load first
      await act(async () => {
        await flushPromisesAndTimers();
      });

      // Advance timer to trigger import (2 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledWith("test-user-123");
      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger import when not on macOS", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      renderHook(() => useMacOSMessagesImport(defaultOptions));

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });

    it("should NOT trigger import when userId is null", async () => {
      renderHook(() =>
        useMacOSMessagesImport({
          ...defaultOptions,
          userId: null,
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });

    it("should NOT trigger import when hasPermissions is false", async () => {
      renderHook(() =>
        useMacOSMessagesImport({
          ...defaultOptions,
          hasPermissions: false,
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });

    it("should NOT trigger import when database is not initialized", async () => {
      renderHook(() =>
        useMacOSMessagesImport({
          ...defaultOptions,
          isDatabaseInitialized: false,
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });

    it("should NOT trigger import during onboarding", async () => {
      renderHook(() =>
        useMacOSMessagesImport({
          ...defaultOptions,
          isOnboarding: true,
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });
  });

  describe("module-level sync guard (TASK-1113)", () => {
    it("should only trigger import ONCE even with multiple component mounts", async () => {
      // First mount
      const { unmount: unmount1 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      // Trigger the import
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);

      // Unmount and remount (simulates React StrictMode or component remount)
      unmount1();

      const { unmount: unmount2 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for potential duplicate trigger
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      // Should still be only 1 call due to module-level guard
      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);

      unmount2();
    });

    it("should NOT trigger duplicate import with React StrictMode double-mount simulation", async () => {
      // Simulate StrictMode by mounting twice quickly
      const { rerender, unmount } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      // Rerender immediately (simulates StrictMode behavior)
      rerender();

      // Wait for both potential triggers
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await flushPromisesAndTimers();
      });

      // Should only be called once
      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);

      unmount();
    });

    it("should allow new import after resetMessagesImportTrigger is called", async () => {
      // First mount and trigger
      const { unmount: unmount1 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);
      unmount1();

      // Reset the trigger flag (simulates logout)
      resetMessagesImportTrigger();

      // New mount should trigger again
      const { unmount: unmount2 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(2);
      unmount2();
    });

    it("should skip import when shouldSkipMessagesSync returns true", async () => {
      // Mark that onboarding just completed
      (shouldSkipMessagesSync as jest.Mock).mockReturnValue(true);

      renderHook(() => useMacOSMessagesImport(defaultOptions));

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[useMacOSMessagesImport] Skipping import - just completed onboarding import"
      );
    });

    it("should prevent future imports after skipping due to onboarding", async () => {
      // First time: skip due to onboarding flag
      (shouldSkipMessagesSync as jest.Mock).mockReturnValue(true);

      const { unmount: unmount1 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
      unmount1();

      // Second mount: even with flag cleared, module-level guard should prevent
      (shouldSkipMessagesSync as jest.Mock).mockReturnValue(false);

      const { unmount: unmount2 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      // Should still not be called because hasTriggeredImport is true
      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
      unmount2();
    });
  });

  describe("manual triggerImport", () => {
    it("should work immediately without waiting for auto-trigger", async () => {
      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      await act(async () => {
        await result.current.triggerImport();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledWith("test-user-123");
    });

    it("should do nothing when userId is null", async () => {
      const { result } = renderHook(() =>
        useMacOSMessagesImport({
          ...defaultOptions,
          userId: null,
        })
      );

      await act(async () => {
        await result.current.triggerImport();
      });

      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });

    it("should prevent concurrent imports", async () => {
      let resolveImport: (value: any) => void;
      mockImportMacOSMessages.mockReturnValue(
        new Promise((resolve) => {
          resolveImport = resolve;
        })
      );

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Start first import
      let importPromise: Promise<void>;
      await act(async () => {
        importPromise = result.current.triggerImport();
      });

      // Try to start second import while first is running
      await act(async () => {
        result.current.triggerImport();
      });

      // Should only have been called once
      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);

      // Complete the import
      await act(async () => {
        resolveImport!({ success: true, messagesImported: 50 });
        await importPromise!;
      });
    });
  });

  describe("error handling", () => {
    it("should handle import errors gracefully", async () => {
      mockImportMacOSMessages.mockRejectedValue(new Error("Permission denied"));

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      await act(async () => {
        await result.current.triggerImport();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useMacOSMessagesImport] Import error:",
        expect.any(Error)
      );
    });

    it("should log warning for non-permission import failures", async () => {
      mockImportMacOSMessages.mockResolvedValue({
        success: false,
        error: "Database locked",
      });

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      await act(async () => {
        await result.current.triggerImport();
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useMacOSMessagesImport] Import failed:",
        "Database locked"
      );
    });

    it("should NOT log warning for Full Disk Access permission errors", async () => {
      mockImportMacOSMessages.mockResolvedValue({
        success: false,
        error: "Full Disk Access not granted",
      });

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for preference to load (TASK-1742)
      await act(async () => {
        await Promise.resolve(); // Allow preference load promise to resolve
      });

      await act(async () => {
        await result.current.triggerImport();
      });

      // The warning spy should not have import-related warnings
      // Note: Preference load warnings are filtered out by checking the call args
      const importWarnings = consoleWarnSpy.mock.calls.filter(
        (call) => call[0]?.includes?.("[useMacOSMessagesImport] Import failed:")
      );
      expect(importWarnings).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("should cancel pending timeout on unmount", async () => {
      const { unmount } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Unmount before timer fires
      unmount();

      // Advance timer
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      // Should not have triggered (cleanup should have cleared timeout)
      // Note: Due to module-level flag, this test requires resetMessagesImportTrigger
      // to be called in beforeEach, which we do
      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
    });
  });

  describe("resetMessagesImportTrigger", () => {
    it("should reset the module-level flag allowing new imports", async () => {
      // Trigger first import
      const { unmount: unmount1 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);
      unmount1();

      // Without reset, new mount should not trigger
      const { unmount: unmount2 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(1);
      unmount2();

      // After reset, new mount should trigger
      resetMessagesImportTrigger();

      const { unmount: unmount3 } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // TASK-1742: Wait for preference to load
      await act(async () => {
        await flushPromisesAndTimers();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      expect(mockImportMacOSMessages).toHaveBeenCalledTimes(2);
      unmount3();
    });
  });

  describe("import source preference (TASK-1742)", () => {
    it("should return importSource state", async () => {
      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for preference to load
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importSource).toBe("macos-native");
    });

    it("should load iphone-sync preference correctly", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: { messages: { source: "iphone-sync" } },
      });

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for preference to load
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importSource).toBe("iphone-sync");
    });

    it("should skip auto-import when iphone-sync is selected", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: { messages: { source: "iphone-sync" } },
      });

      renderHook(() => useMacOSMessagesImport(defaultOptions));

      // Wait for preference to load, then advance timer
      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      // Should NOT have triggered import when iphone-sync is selected
      expect(mockImportMacOSMessages).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[useMacOSMessagesImport] Skipping auto-import - iPhone sync is selected"
      );
    });

    it("should trigger auto-import when macos-native is selected", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: { messages: { source: "macos-native" } },
      });

      renderHook(() => useMacOSMessagesImport(defaultOptions));

      // Wait for preference to load first
      await act(async () => {
        await flushPromisesAndTimers();
      });

      // Then advance timer to trigger auto-import
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromisesAndTimers();
      });

      // Should have triggered import when macos-native is selected
      expect(mockImportMacOSMessages).toHaveBeenCalledWith("test-user-123");
    });

    it("should default to macos-native when no preference saved", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: {},
      });

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for preference to load
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importSource).toBe("macos-native");
    });

    it("should handle preference load error gracefully", async () => {
      mockPreferencesGet.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useMacOSMessagesImport(defaultOptions)
      );

      // Wait for preference to load (should fail gracefully)
      await act(async () => {
        await Promise.resolve();
      });

      // Should default to macos-native
      expect(result.current.importSource).toBe("macos-native");
    });

    it("should not load preference when not on macOS", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      renderHook(() => useMacOSMessagesImport(defaultOptions));

      await act(async () => {
        await Promise.resolve();
      });

      // preferences.get should not be called on non-macOS
      expect(mockPreferencesGet).not.toHaveBeenCalled();
    });
  });
});
