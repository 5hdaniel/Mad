/**
 * Unit tests for useAutoRefresh hook
 *
 * TASK-1003: Tests auto-refresh functionality including:
 * - Platform-specific sync behavior
 * - Delay before auto-trigger
 * - Progress state management
 *
 * TASK-1783: Updated to mock SyncOrchestrator instead of SyncQueueService
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoRefresh, resetAutoRefreshTrigger } from "../useAutoRefresh";
import { setMessagesImportTriggered, resetMessagesImportTrigger } from "../../utils/syncFlags";

// Mock the platform context
jest.mock("../../contexts/PlatformContext", () => ({
  usePlatform: jest.fn(() => ({ isMacOS: true })),
}));

// Mock the orchestrator state
const mockOrchestratorState = {
  isRunning: false,
  queue: [] as Array<{ type: string; status: string; progress: number; error?: string }>,
  currentSync: null,
  overallProgress: 0,
  pendingRequest: null,
};

const mockRequestSync = jest.fn().mockReturnValue({ started: true, needsConfirmation: false });
const mockForceSync = jest.fn();
const mockAcceptPending = jest.fn();
const mockRejectPending = jest.fn();
const mockCancel = jest.fn();

// Mock useSyncOrchestrator hook
jest.mock("../useSyncOrchestrator", () => ({
  useSyncOrchestrator: jest.fn(() => ({
    state: mockOrchestratorState,
    isRunning: mockOrchestratorState.isRunning,
    queue: mockOrchestratorState.queue,
    currentSync: mockOrchestratorState.currentSync,
    overallProgress: mockOrchestratorState.overallProgress,
    pendingRequest: mockOrchestratorState.pendingRequest,
    requestSync: mockRequestSync,
    forceSync: mockForceSync,
    acceptPending: mockAcceptPending,
    rejectPending: mockRejectPending,
    cancel: mockCancel,
  })),
}));

// Import the mock after mocking
import { usePlatform } from "../../contexts/PlatformContext";
import { useSyncOrchestrator } from "../useSyncOrchestrator";

describe("useAutoRefresh", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  const mockPreferencesGet = jest.fn();
  const mockNotificationSend = jest.fn();

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

    // Reset module-level state between tests
    resetAutoRefreshTrigger();
    resetMessagesImportTrigger();

    // Reset orchestrator mock state
    mockOrchestratorState.isRunning = false;
    mockOrchestratorState.queue = [];
    mockOrchestratorState.currentSync = null;
    mockOrchestratorState.overallProgress = 0;
    mockOrchestratorState.pendingRequest = null;

    // Reset mocks
    mockRequestSync.mockClear().mockReturnValue({ started: true, needsConfirmation: false });
    mockForceSync.mockClear();
    mockAcceptPending.mockClear();
    mockRejectPending.mockClear();
    mockCancel.mockClear();

    mockPreferencesGet.mockReset().mockResolvedValue({ success: true, preferences: { sync: { autoSyncOnLogin: true } } });
    mockNotificationSend.mockReset().mockResolvedValue(undefined);

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Reset platform mock to macOS
    (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

    // Update useSyncOrchestrator mock to return fresh state
    (useSyncOrchestrator as jest.Mock).mockReturnValue({
      state: mockOrchestratorState,
      isRunning: mockOrchestratorState.isRunning,
      queue: mockOrchestratorState.queue,
      currentSync: mockOrchestratorState.currentSync,
      overallProgress: mockOrchestratorState.overallProgress,
      pendingRequest: mockOrchestratorState.pendingRequest,
      requestSync: mockRequestSync,
      forceSync: mockForceSync,
      acceptPending: mockAcceptPending,
      rejectPending: mockRejectPending,
      cancel: mockCancel,
    });

    // Setup window.api mock
    (window as any).api = {
      preferences: {
        get: mockPreferencesGet,
      },
      notification: {
        send: mockNotificationSend,
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
    it("should trigger orchestrator sync after delay when on dashboard", async () => {
      renderHook(() => useAutoRefresh(defaultOptions));

      // Preferences need to load first
      await act(async () => {
        await Promise.resolve();
      });

      // Advance timer to trigger auto-refresh (1.5 seconds)
      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      // Should have called requestSync with contacts and messages (macOS)
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'messages'],
        'test-user-123'
      );
    });

    it("should include emails in sync when hasAIAddon is true", async () => {
      renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasAIAddon: true,
        })
      );

      // Preferences need to load first
      await act(async () => {
        await Promise.resolve();
      });

      // Advance timer to trigger auto-refresh
      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      // Should include emails since hasAIAddon is true
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'emails', 'messages'],
        'test-user-123'
      );
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

      expect(mockRequestSync).not.toHaveBeenCalled();
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

      expect(mockRequestSync).not.toHaveBeenCalled();
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

      expect(mockRequestSync).not.toHaveBeenCalled();
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

      expect(mockRequestSync).not.toHaveBeenCalled();
    });

    it("should NOT trigger refresh when autoSyncOnLogin is disabled", async () => {
      mockPreferencesGet.mockResolvedValue({
        success: true,
        preferences: { sync: { autoSyncOnLogin: false } },
      });

      renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockRequestSync).not.toHaveBeenCalled();
    });

    it("should only trigger once per dashboard entry", async () => {
      renderHook(() => useAutoRefresh(defaultOptions));

      // Step 1: Let preference loading complete
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Step 2: Advance timer to trigger auto-refresh
      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      // First trigger should have happened
      expect(mockRequestSync).toHaveBeenCalledTimes(1);

      // Step 3: Advance more time - should not trigger again
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockRequestSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("platform-specific sync behavior", () => {
    it("should include contacts and messages on macOS with permissions", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'messages'],
        'test-user-123'
      );
    });

    it("should sync only Outlook contacts on non-macOS platforms with email connected", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // TASK-1953: Outlook contacts sync via Graph API on all platforms when email connected
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts'],
        'test-user-123'
      );
    });

    it("should NOT sync anything on non-macOS without email connected", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasEmailConnected: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // No sync types available on non-macOS without email connection or AI addon
      expect(mockRequestSync).not.toHaveBeenCalled();
    });

    it("should sync only Outlook contacts without macOS permissions", async () => {
      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasPermissions: false,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // TASK-1953: Outlook contacts still sync without macOS permissions (uses Graph API)
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts'],
        'test-user-123'
      );
    });

    it("should include contacts and emails on non-macOS with AI addon", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      const { result } = renderHook(() =>
        useAutoRefresh({
          ...defaultOptions,
          hasAIAddon: true,
        })
      );

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // TASK-1953: contacts (Outlook) + emails (AI addon)
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'emails'],
        'test-user-123'
      );
    });
  });

  describe("sync status from orchestrator queue", () => {
    it("should reflect running status from orchestrator queue", async () => {
      // Update mock to return running state
      mockOrchestratorState.isRunning = true;
      mockOrchestratorState.queue = [
        { type: 'contacts', status: 'complete', progress: 100 },
        { type: 'messages', status: 'running', progress: 45 },
      ];

      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: true,
        queue: mockOrchestratorState.queue,
        currentSync: 'messages',
        overallProgress: 72,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      expect(result.current.isAnySyncing).toBe(true);
      expect(result.current.syncStatus.contacts.isSyncing).toBe(false); // complete
      expect(result.current.syncStatus.contacts.progress).toBe(100);
      expect(result.current.syncStatus.messages.isSyncing).toBe(true); // running
      expect(result.current.syncStatus.messages.progress).toBe(45);
    });

    it("should reflect error status from orchestrator queue", async () => {
      mockOrchestratorState.queue = [
        { type: 'contacts', status: 'error', progress: 0, error: 'Permission denied' },
      ];

      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: false,
        queue: mockOrchestratorState.queue,
        currentSync: null,
        overallProgress: 0,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      expect(result.current.syncStatus.contacts.error).toBe('Permission denied');
      expect(result.current.syncStatus.contacts.isSyncing).toBe(false);
    });

    it("should return default status for types not in queue", async () => {
      mockOrchestratorState.queue = [
        { type: 'messages', status: 'running', progress: 50 },
      ];

      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: true,
        queue: mockOrchestratorState.queue,
        currentSync: 'messages',
        overallProgress: 50,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      // Emails not in queue - should have default values
      expect(result.current.syncStatus.emails.isSyncing).toBe(false);
      expect(result.current.syncStatus.emails.progress).toBeNull();
      expect(result.current.syncStatus.emails.error).toBeNull();
    });
  });

  describe("OS notification", () => {
    it("should send notification when sync completes", async () => {
      // Start with syncing
      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: true,
        queue: [{ type: 'messages', status: 'running', progress: 50 }],
        currentSync: 'messages',
        overallProgress: 50,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      const { rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      // Now sync completes
      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: false,
        queue: [{ type: 'messages', status: 'complete', progress: 100 }],
        currentSync: null,
        overallProgress: 100,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      rerender();

      expect(mockNotificationSend).toHaveBeenCalledWith(
        "Sync Complete",
        "Keepr is ready to use. Your data has been synchronized."
      );
    });

    it("should NOT send notification when sync starts", async () => {
      // Start with not syncing
      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: false,
        queue: [],
        currentSync: null,
        overallProgress: 0,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      const { rerender } = renderHook(() => useAutoRefresh(defaultOptions));

      // Now sync starts
      (useSyncOrchestrator as jest.Mock).mockReturnValue({
        state: mockOrchestratorState,
        isRunning: true,
        queue: [{ type: 'messages', status: 'running', progress: 0 }],
        currentSync: 'messages',
        overallProgress: 0,
        pendingRequest: null,
        requestSync: mockRequestSync,
        forceSync: mockForceSync,
        acceptPending: mockAcceptPending,
        rejectPending: mockRejectPending,
        cancel: mockCancel,
      });

      rerender();

      expect(mockNotificationSend).not.toHaveBeenCalled();
    });
  });

  describe("onboarding import skip", () => {
    beforeEach(() => {
      resetMessagesImportTrigger();
    });

    it("should allow manual sync even when onboarding import flag is set", async () => {
      // Mark onboarding import complete
      setMessagesImportTriggered();

      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      // Manual triggerRefresh should bypass the import flag
      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'messages'],
        'test-user-123'
      );
    });

    it("should allow sync when import flag not set", async () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockRequestSync).toHaveBeenCalled();
    });
  });

  describe("manual triggerRefresh", () => {
    it("should work without waiting for auto-trigger delay", async () => {
      const { result } = renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await result.current.triggerRefresh();
      });

      expect(mockRequestSync).toHaveBeenCalledWith(
        ['contacts', 'messages'],
        'test-user-123'
      );
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

      expect(mockRequestSync).not.toHaveBeenCalled();
    });
  });

  describe("preference loading", () => {
    it("should wait for preferences before triggering", async () => {
      let resolvePrefs: (value: any) => void;
      mockPreferencesGet.mockReturnValue(
        new Promise((resolve) => {
          resolvePrefs = resolve;
        })
      );

      renderHook(() => useAutoRefresh(defaultOptions));

      // Advance timer before prefs load
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });

      // Should not have triggered yet
      expect(mockRequestSync).not.toHaveBeenCalled();

      // Now resolve preferences
      await act(async () => {
        resolvePrefs!({ success: true, preferences: { sync: { autoSyncOnLogin: true } } });
        await Promise.resolve();
      });

      // Now advance timer to trigger auto-refresh
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1500);
      });

      expect(mockRequestSync).toHaveBeenCalled();
    });

    it("should default to enabled when preference not set", async () => {
      mockPreferencesGet.mockResolvedValue({ success: true, preferences: {} });

      renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(mockRequestSync).toHaveBeenCalled();
    });

    it("should default to enabled on preference load error", async () => {
      mockPreferencesGet.mockRejectedValue(new Error("Failed to load"));

      renderHook(() => useAutoRefresh(defaultOptions));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(mockRequestSync).toHaveBeenCalled();
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
      expect(mockRequestSync).not.toHaveBeenCalled();
    });
  });
});
