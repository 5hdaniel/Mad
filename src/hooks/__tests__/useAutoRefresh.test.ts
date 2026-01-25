/**
 * Unit tests for useAutoRefresh hook
 *
 * TASK-1003: Tests auto-refresh functionality including:
 * - Parallel sync execution with Promise.allSettled
 * - Platform-specific sync behavior
 * - Delay before auto-trigger
 * - Error handling (silent failures)
 * - Progress state management
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoRefresh, markOnboardingImportComplete, shouldSkipMessagesSync, resetAutoRefreshTrigger } from "../useAutoRefresh";

// Mock the platform context
jest.mock("../../contexts/PlatformContext", () => ({
  usePlatform: jest.fn(() => ({ isMacOS: true })),
}));

import { usePlatform } from "../../contexts/PlatformContext";

describe("useAutoRefresh", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  // Store callbacks for triggering events in tests
  let messagesProgressCallback: ((progress: { current: number; total: number; percent: number }) => void) | null = null;
  let contactsProgressCallback: ((progress: { current: number; total: number; percent: number }) => void) | null = null;

  const mockTransactionsScan = jest.fn();
  const mockMessagesImport = jest.fn();
  const mockContactsGetAll = jest.fn();
  const mockPreferencesGet = jest.fn();

  const defaultOptions = {
    userId: "test-user-123",
    hasEmailConnected: true,
    isDatabaseInitialized: true,
    hasPermissions: true,
    isOnDashboard: true,
    isOnboarding: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset module-level state between tests (BACKLOG-205)
    resetAutoRefreshTrigger();

    // Reset callbacks
    messagesProgressCallback = null;
    contactsProgressCallback = null;

    // Reset mocks
    mockTransactionsScan.mockReset().mockResolvedValue({ success: true });
    mockMessagesImport.mockReset().mockResolvedValue({ success: true, messagesImported: 100 });
    mockContactsGetAll.mockReset().mockResolvedValue({ success: true, contacts: [] });
    mockPreferencesGet.mockReset().mockResolvedValue({ success: true, preferences: { autoSyncOnLogin: true } });

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Reset platform mock to macOS
    (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

    // Setup window.api mock
    (window as any).api = {
      transactions: {
        scan: mockTransactionsScan,
      },
      messages: {
        importMacOSMessages: mockMessagesImport,
        onImportProgress: jest.fn((cb) => {
          messagesProgressCallback = cb;
          return jest.fn(); // cleanup function
        }),
      },
      contacts: {
        getAll: mockContactsGetAll,
        onImportProgress: jest.fn((cb) => {
          contactsProgressCallback = cb;
          return jest.fn(); // cleanup function
        }),
      },
      preferences: {
        get: mockPreferencesGet,
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should start with default sync status", () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      expect(result.current.syncStatus.emails.isSyncing).toBe(false);
      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
      expect(result.current.syncStatus.contacts.isSyncing).toBe(false);
      expect(result.current.isAnySyncing).toBe(false);
      expect(result.current.currentSyncMessage).toBeNull();
    });

    it("should provide triggerRefresh function", () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      expect(typeof result.current.triggerRefresh).toBe("function");
    });
  });

  describe("auto-trigger behavior", () => {
    it("should trigger refresh after delay when on dashboard", async () => {
      renderHook(() => useAutoRefresh(defaultOptions));

      // Preferences need to load first
      await act(async () => {
        await Promise.resolve();
      });

      // Advance timer to trigger auto-refresh (2.5 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).toHaveBeenCalledWith("test-user-123");
    });

    it("should NOT trigger refresh when not on dashboard", async () => {
      renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          isOnDashboard: false,
        })
      );

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    it("should NOT trigger refresh during onboarding", async () => {
      renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          isOnboarding: true,
        })
      );

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    it("should NOT trigger refresh when database not initialized", async () => {
      renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          isDatabaseInitialized: false,
        })
      );

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    it("should NOT trigger refresh when userId is null", async () => {
      renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          userId: null,
        })
      );

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    it("should NOT trigger refresh when autoSyncOnLogin is disabled", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: { autoSyncOnLogin: false },
      });

      renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    // BACKLOG-205: Fixed flaky timer test - use multiple act() calls to properly flush async state
    it("should only trigger once per dashboard entry", async () => {
      renderHook(() => useAutoRefresh(defaultOptions));

      // Step 1: Let preference loading complete (sets hasLoadedPreference = true)
      await act(async () => {
        await Promise.resolve(); // Flush the loadPreference() promise
        await Promise.resolve(); // Flush any setState calls
      });

      // Step 2: Advance timer to trigger auto-refresh (2.5 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve(); // Flush the runAutoRefresh promise
      });

      // First trigger should have happened
      expect(mockTransactionsScan).toHaveBeenCalledTimes(1);

      // Step 3: Advance more time - should not trigger again (hasTriggeredAutoRefresh = true)
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockTransactionsScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("parallel sync execution", () => {
    it("should run email, messages, and contacts syncs in parallel on macOS", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

      // Make syncs take some time
      let emailResolve: () => void;
      let messagesResolve: () => void;
      let contactsResolve: () => void;

      mockTransactionsScan.mockReturnValue(
        new Promise((resolve) => {
          emailResolve = () => resolve({ success: true });
        })
      );
      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          messagesResolve = () => resolve({ success: true, messagesImported: 50 });
        })
      );
      mockContactsGetAll.mockReturnValue(
        new Promise((resolve) => {
          contactsResolve = () => resolve({ success: true, contacts: [] });
        })
      );

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      // Trigger manual refresh
      let refreshPromise: Promise<void>;
      await act(async () => {
        refreshPromise = result.current.triggerRefresh();
      });

      // All three should have been called (parallel)
      expect(mockTransactionsScan).toHaveBeenCalled();
      expect(mockMessagesImport).toHaveBeenCalled();
      expect(mockContactsGetAll).toHaveBeenCalled();

      // Resolve all
      await act(async () => {
        emailResolve!();
        messagesResolve!();
        contactsResolve!();
        await refreshPromise!;
      });
    });

    it("should NOT run messages sync on non-macOS platforms", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
      expect(mockMessagesImport).not.toHaveBeenCalled();
    });

    it("should NOT run messages sync without permissions", async () => {
      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasPermissions: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
      expect(mockMessagesImport).not.toHaveBeenCalled();
    });

    it("should NOT run email sync when email not connected", async () => {
      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
      expect(mockMessagesImport).toHaveBeenCalled(); // Still syncs messages on macOS
    });
  });

  describe("error handling", () => {
    it("should handle email sync error silently", async () => {
      mockTransactionsScan.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Should log error but not throw
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useAutoRefresh] Email sync error:",
        expect.any(Error)
      );
      expect(result.current.syncStatus.emails.error).toBe("Network error");
      expect(result.current.syncStatus.emails.isSyncing).toBe(false);
    });

    it("should handle messages sync error silently", async () => {
      mockMessagesImport.mockRejectedValue(new Error("Permission denied"));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useAutoRefresh] Message sync error:",
        expect.any(Error)
      );
      expect(result.current.syncStatus.messages.error).toBe("Permission denied");
    });

    it("should continue other syncs when one fails (Promise.allSettled)", async () => {
      mockTransactionsScan.mockRejectedValue(new Error("Email failed"));
      mockMessagesImport.mockResolvedValue({ success: true, messagesImported: 50 });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Email sync failed
      expect(result.current.syncStatus.emails.error).toBe("Email failed");
      // Messages sync succeeded
      expect(result.current.syncStatus.messages.error).toBeNull();
      expect(result.current.syncStatus.messages.message).toBe("Imported 50 messages");
    });
  });

  describe("sync status updates", () => {
    it("should update email sync status during sync", async () => {
      let resolveEmail: (value: any) => void;
      mockTransactionsScan.mockReturnValue(
        new Promise((resolve) => {
          resolveEmail = resolve;
        })
      );

      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: true,
        })
      );

      // Start refresh
      let refreshPromise: Promise<void>;
      await act(async () => {
        refreshPromise = result.current.triggerRefresh();
      });

      // Check syncing state
      expect(result.current.syncStatus.emails.isSyncing).toBe(true);
      expect(result.current.syncStatus.emails.message).toBe("Syncing emails...");
      expect(result.current.isAnySyncing).toBe(true);

      // Complete the sync
      await act(async () => {
        resolveEmail!({ success: true });
        await refreshPromise!;
      });

      expect(result.current.syncStatus.emails.isSyncing).toBe(false);
      expect(result.current.syncStatus.emails.message).toBe("Email sync complete");
    });

    it("should update messages sync status during sync", async () => {
      // Make email sync instant, messages slow
      mockTransactionsScan.mockResolvedValue({ success: true });

      let resolveMessages: (value: any) => void;
      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          resolveMessages = resolve;
        })
      );

      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: false, // Skip email to focus on messages
        })
      );

      let refreshPromise: Promise<void>;
      await act(async () => {
        refreshPromise = result.current.triggerRefresh();
      });

      expect(result.current.syncStatus.messages.isSyncing).toBe(true);
      expect(result.current.syncStatus.messages.message).toBe("Importing messages...");

      await act(async () => {
        resolveMessages!({ success: true, messagesImported: 200 });
        await refreshPromise!;
      });

      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
      expect(result.current.syncStatus.messages.message).toBe("Imported 200 messages");
    });

    it("should show 'Messages up to date' when no new messages", async () => {
      mockMessagesImport.mockResolvedValue({ success: true, messagesImported: 0 });

      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(result.current.syncStatus.messages.message).toBe("Messages up to date");
    });
  });

  describe("progress event handling", () => {
    it("should update messages progress from IPC events", async () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        messagesProgressCallback?.({ current: 50, total: 100, percent: 50 });
      });

      expect(result.current.syncStatus.messages.isSyncing).toBe(true);
      expect(result.current.syncStatus.messages.progress).toBe(50);
      expect(result.current.syncStatus.messages.message).toContain("50");
    });

    it("should mark messages complete at 100%", async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        messagesProgressCallback?.({ current: 100, total: 100, percent: 100 });
      });

      expect(result.current.syncStatus.messages.progress).toBe(100);

      // After timeout, should mark as not syncing
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
    });

    it("should update contacts progress from IPC events", async () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        contactsProgressCallback?.({ current: 25, total: 50, percent: 50 });
      });

      expect(result.current.syncStatus.contacts.isSyncing).toBe(true);
      expect(result.current.syncStatus.contacts.progress).toBe(50);
    });
  });

  describe("currentSyncMessage priority", () => {
    it("should prioritize email message when syncing", async () => {
      let resolveEmail: (value: any) => void;
      mockTransactionsScan.mockReturnValue(
        new Promise((resolve) => {
          resolveEmail = resolve;
        })
      );

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        result.current.triggerRefresh();
      });

      expect(result.current.currentSyncMessage).toBe("Syncing emails...");

      await act(async () => {
        resolveEmail!({ success: true });
      });
    });

    it("should show messages message when emails done", async () => {
      mockTransactionsScan.mockResolvedValue({ success: true });

      let resolveMessages: (value: any) => void;
      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          resolveMessages = resolve;
        })
      );

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        result.current.triggerRefresh();
        // Wait for email to complete
        await Promise.resolve();
      });

      // Now messages should be shown (emails completed quickly)
      // The current message shows whichever is still syncing
      expect(result.current.currentSyncMessage).toBe("Importing messages...");

      await act(async () => {
        resolveMessages!({ success: true, messagesImported: 10 });
      });
    });

    it("should return null when no sync in progress", () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      expect(result.current.currentSyncMessage).toBeNull();
    });
  });

  describe("onboarding import skip", () => {
    beforeEach(() => {
      // Reset the module-level flag by setting it through the exported function
      // We need to clear any previous state
    });

    it("should skip messages sync when marked as just completed onboarding import", async () => {
      // Mark onboarding import complete
      markOnboardingImportComplete();

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Messages sync should be skipped
      expect(mockMessagesImport).not.toHaveBeenCalled();
      // Email sync should still run
      expect(mockTransactionsScan).toHaveBeenCalled();
    });

    it("should allow messages sync on subsequent refreshes", async () => {
      // First refresh with skip flag
      markOnboardingImportComplete();

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockMessagesImport).not.toHaveBeenCalled();

      // Second refresh - flag should be cleared
      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockMessagesImport).toHaveBeenCalled();
    });
  });

  describe("manual triggerRefresh", () => {
    it("should work without waiting for auto-trigger delay", async () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      // Trigger immediately without waiting for delay
      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
    });

    it("should do nothing when userId is null", async () => {
      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          userId: null,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });
  });

  describe("preference loading", () => {
    // BACKLOG-205: Fixed flaky timer test using jest.runAllTimersAsync()
    it("should wait for preferences before triggering", async () => {
      let resolvePrefs: (value: any) => void;
      mockPreferencesGet.mockReturnValue(
        new Promise((resolve) => {
          resolvePrefs = resolve;
        })
      );

      renderHook(() => useAutoRefresh(defaultOptions));

      // Advance timer before prefs load - use advanceTimersByTimeAsync for proper async handling
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });

      // Should not have triggered yet (prefs still pending)
      expect(mockTransactionsScan).not.toHaveBeenCalled();

      // Now resolve preferences and let the hook react
      await act(async () => {
        resolvePrefs!({ success: true, preferences: { autoSyncOnLogin: true } });
        // Flush microtasks to let the state update
        await Promise.resolve();
      });

      // Now advance timer to trigger auto-refresh
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2500);
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
    });

    // BACKLOG-205: Fixed flaky timer test - use multiple act() calls to properly flush async state
    it("should default to enabled when preference not set", async () => {
      mockPreferencesGet.mockResolvedValue({ success: true, preferences: {} });

      renderHook(() => useAutoRefresh(defaultOptions));

      // Step 1: Let preference loading complete (sets hasLoadedPreference = true)
      await act(async () => {
        await Promise.resolve(); // Flush the loadPreference() promise
        await Promise.resolve(); // Flush any setState calls
      });

      // Step 2: Advance timer to trigger auto-refresh (2.5 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve(); // Flush the runAutoRefresh promise
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
    });

    // BACKLOG-205: Fixed flaky timer test - use multiple act() calls to properly flush async state
    it("should default to enabled on preference load error", async () => {
      mockPreferencesGet.mockRejectedValue(new Error("Failed to load"));

      renderHook(() => useAutoRefresh(defaultOptions));

      // Step 1: Let preference loading complete (catch block sets autoSyncEnabled = true, then finally sets hasLoadedPreference = true)
      await act(async () => {
        await Promise.resolve(); // Flush the loadPreference() rejection
        await Promise.resolve(); // Flush any setState calls
      });

      // Step 2: Advance timer to trigger auto-refresh (2.5 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2500);
        await Promise.resolve(); // Flush the runAutoRefresh promise
      });

      expect(mockTransactionsScan).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should cancel pending timeout on unmount", async () => {
      const { unmount } = renderHook(() => useAutoRefresh(defaultOptions));

      // Load prefs
      await act(async () => {
        await Promise.resolve();
      });

      // Unmount before timeout fires
      unmount();

      // Advance timer
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Should not have triggered
      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });
  });

  describe("helper functions", () => {
    it("shouldSkipMessagesSync should return correct state", () => {
      expect(shouldSkipMessagesSync()).toBe(false);

      markOnboardingImportComplete();

      expect(shouldSkipMessagesSync()).toBe(true);
    });
  });
});
