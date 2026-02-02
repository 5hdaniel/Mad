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

// Mock useSyncQueue hook - define function first, then use in mock
const mockUseSyncQueueFn = jest.fn();
jest.mock("../useSyncQueue", () => ({
  useSyncQueue: () => mockUseSyncQueueFn(),
}));

// Mock SyncQueueService - use inline object in jest.mock factory
jest.mock("../../services/SyncQueueService", () => ({
  syncQueue: {
    reset: jest.fn(),
    queue: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    error: jest.fn(),
    skip: jest.fn(),
    getState: jest.fn(),
    onStateChange: jest.fn(() => jest.fn()),
    onAllComplete: jest.fn(() => jest.fn()),
  },
}));

// Import the mock after mocking
import { syncQueue as mockSyncQueue } from "../../services/SyncQueueService";

// Helper to create SyncQueue state for mocking
const createQueueState = (
  contacts: 'idle' | 'queued' | 'running' | 'complete' = 'idle',
  emails: 'idle' | 'queued' | 'running' | 'complete' = 'idle',
  messages: 'idle' | 'queued' | 'running' | 'complete' = 'idle',
  isRunning = false
) => ({
  state: {
    contacts: { type: 'contacts' as const, state: contacts },
    emails: { type: 'emails' as const, state: emails },
    messages: { type: 'messages' as const, state: messages },
    isRunning,
    isComplete: !isRunning && contacts === 'complete' && emails === 'complete' && messages === 'complete',
    runStartedAt: isRunning ? Date.now() : null,
    runCompletedAt: null,
  },
  isRunning,
  isComplete: false,
});

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

    // Setup default useSyncQueue mock
    mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'idle', false));

    // Reset SyncQueue mock
    (mockSyncQueue.reset as jest.Mock).mockClear();
    (mockSyncQueue.queue as jest.Mock).mockClear();
    (mockSyncQueue.start as jest.Mock).mockClear();
    (mockSyncQueue.complete as jest.Mock).mockClear();
    (mockSyncQueue.error as jest.Mock).mockClear();

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
    // Updated: Auto-refresh now only runs messages sync (not emails)
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

      // Only messages sync runs on auto-refresh (emails disabled)
      expect(mockMessagesImport).toHaveBeenCalledWith("test-user-123");
      expect(mockTransactionsScan).not.toHaveBeenCalled();
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
    // Updated: Auto-refresh now only runs messages sync (not emails/contacts)
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

      // First trigger should have happened (messages only, not emails)
      expect(mockMessagesImport).toHaveBeenCalledTimes(1);
      expect(mockTransactionsScan).not.toHaveBeenCalled(); // Emails disabled on auto-refresh

      // Step 3: Advance more time - should not trigger again (hasTriggeredAutoRefresh = true)
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockMessagesImport).toHaveBeenCalledTimes(1);
    });
  });

  describe("messages-only sync execution", () => {
    // Updated: Auto-refresh now only runs messages sync to avoid INP issues
    it("should run ONLY messages sync on macOS (emails and contacts disabled)", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

      let messagesResolve: () => void;

      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          messagesResolve = () => resolve({ success: true, messagesImported: 50 });
        })
      );

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      // Trigger manual refresh
      let refreshPromise: Promise<void>;
      await act(async () => {
        refreshPromise = result.current.triggerRefresh();
      });

      // Only messages should be called (emails and contacts are disabled on auto-refresh)
      expect(mockMessagesImport).toHaveBeenCalled();
      expect(mockTransactionsScan).not.toHaveBeenCalled();
      expect(mockContactsGetAll).not.toHaveBeenCalled();

      // Resolve
      await act(async () => {
        messagesResolve!();
        await refreshPromise!;
      });
    });

    it("should NOT run any sync on non-macOS platforms (messages only supported on macOS)", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // No syncs run - messages is macOS only, emails/contacts are disabled
      expect(mockMessagesImport).not.toHaveBeenCalled();
      expect(mockTransactionsScan).not.toHaveBeenCalled();
      expect(mockContactsGetAll).not.toHaveBeenCalled();
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

      // No syncs - messages requires permissions, emails/contacts disabled
      expect(mockMessagesImport).not.toHaveBeenCalled();
      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });

    it("should still run messages sync when email not connected", async () => {
      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Messages sync runs regardless of email connection (independent feature)
      expect(mockMessagesImport).toHaveBeenCalled();
      // Email sync is disabled on auto-refresh regardless
      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    // Note: Email sync is disabled on auto-refresh, so we only test messages errors
    // With TASK-1777, errors are tracked via SyncQueue

    it("should handle messages sync error silently", async () => {
      mockMessagesImport.mockRejectedValue(new Error("Permission denied"));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useAutoRefresh] Message sync error:",
        expect.any(Error)
      );
      // syncQueue.error should have been called
      expect(mockSyncQueue.error).toHaveBeenCalledWith('messages', "Permission denied");
    });

    it("should complete gracefully when messages sync fails", async () => {
      mockMessagesImport.mockRejectedValue(new Error("Import failed"));

      // After error, SyncQueue state would show error
      const errorState = {
        ...createQueueState('idle', 'idle', 'error', false),
        state: {
          ...createQueueState('idle', 'idle', 'error', false).state,
          messages: { type: 'messages' as const, state: 'error' as const, error: 'Import failed' },
        },
      };
      mockUseSyncQueueFn.mockReturnValue(errorState);

      const { result, rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
        rerender();
      });

      // Messages sync failed but hook should still be in valid state
      expect(result.current.syncStatus.messages.error).toBe("Import failed");
      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
      expect(result.current.isAnySyncing).toBe(false);
    });
  });

  describe("sync status updates", () => {
    // Note: Email sync is disabled on auto-refresh, only messages sync runs
    // With TASK-1777 refactoring, isSyncing comes from SyncQueue, messages are simplified

    it("should update messages sync status during sync", async () => {
      let resolveMessages: (value: any) => void;
      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          resolveMessages = resolve;
        })
      );

      // Start with idle state
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'idle', false));
      const { result, rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      // Start sync - SyncQueue will be updated
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'running', true));
      let refreshPromise: Promise<void>;
      await act(async () => {
        refreshPromise = result.current.triggerRefresh();
        rerender();
      });

      // isSyncing comes from SyncQueue mock
      expect(result.current.syncStatus.messages.isSyncing).toBe(true);
      // message is now empty (simplified - state tracked via SyncQueue)
      expect(result.current.isAnySyncing).toBe(true);

      // Complete sync
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'complete', false));
      await act(async () => {
        resolveMessages!({ success: true, messagesImported: 200 });
        await refreshPromise!;
        rerender();
      });

      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
      // message tracking removed in TASK-1777
    });

    it("should complete sync when no new messages", async () => {
      mockMessagesImport.mockResolvedValue({ success: true, messagesImported: 0 });
      // Start with running then complete
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'running', true));

      const { result, rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'complete', false));
      await act(async () => {
        await result.current.triggerRefresh();
        rerender();
      });

      // Verify sync completed successfully (message tracking removed)
      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
      // syncQueue.complete should have been called
      expect(mockSyncQueue.complete).toHaveBeenCalledWith('messages');
    });
  });

  describe("progress event handling", () => {
    it("should update messages progress from IPC events", async () => {
      // Mock SyncQueue to show messages as running
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'running', true));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        messagesProgressCallback?.({ current: 50, total: 100, percent: 50 });
      });

      // isSyncing comes from SyncQueue mock
      expect(result.current.syncStatus.messages.isSyncing).toBe(true);
      expect(result.current.syncStatus.messages.progress).toBe(50);
      // message is now empty (messages simplified, state in SyncQueue)
    });

    it("should mark messages complete at 100%", async () => {
      jest.useFakeTimers();
      // Mock SyncQueue to show messages as running first
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'running', true));

      const { result, rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        messagesProgressCallback?.({ current: 100, total: 100, percent: 100 });
      });

      expect(result.current.syncStatus.messages.progress).toBe(100);

      // After sync completes, SyncQueue state changes to complete
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'complete', false));
      rerender();

      expect(result.current.syncStatus.messages.isSyncing).toBe(false);
    });

    it("should update contacts progress from IPC events", async () => {
      // Mock SyncQueue to show contacts as running
      mockUseSyncQueueFn.mockReturnValue(createQueueState('running', 'idle', 'idle', true));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      act(() => {
        contactsProgressCallback?.({ current: 25, total: 50, percent: 50 });
      });

      expect(result.current.syncStatus.contacts.isSyncing).toBe(true);
      expect(result.current.syncStatus.contacts.progress).toBe(50);
    });
  });

  describe("currentSyncMessage priority", () => {
    // Note: currentSyncMessage is now simplified (returns null)
    // State tracking is via SyncQueue, not messages
    it("should return null (simplified implementation)", async () => {
      let resolveMessages: (value: any) => void;
      mockMessagesImport.mockReturnValue(
        new Promise((resolve) => {
          resolveMessages = resolve;
        })
      );
      // Mock SyncQueue to show messages as running
      mockUseSyncQueueFn.mockReturnValue(createQueueState('idle', 'idle', 'running', true));

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        result.current.triggerRefresh();
      });

      // currentSyncMessage is now null (simplified implementation)
      expect(result.current.currentSyncMessage).toBe(null);

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
      // Email sync is disabled on auto-refresh
      expect(mockTransactionsScan).not.toHaveBeenCalled();
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

      // Only messages sync runs on refresh (emails/contacts disabled)
      expect(mockMessagesImport).toHaveBeenCalled();
      expect(mockTransactionsScan).not.toHaveBeenCalled();
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

      expect(mockMessagesImport).not.toHaveBeenCalled();
      expect(mockTransactionsScan).not.toHaveBeenCalled();
    });
  });

  describe("preference loading", () => {
    // BACKLOG-205: Fixed flaky timer test using jest.runAllTimersAsync()
    // Updated: Now only messages sync runs (not emails)
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
      expect(mockMessagesImport).not.toHaveBeenCalled();

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

      expect(mockMessagesImport).toHaveBeenCalled();
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

      expect(mockMessagesImport).toHaveBeenCalled();
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

      expect(mockMessagesImport).toHaveBeenCalled();
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
