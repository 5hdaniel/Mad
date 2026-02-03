/**
 * SyncStatusIndicator Tests
 *
 * TASK-1785: Tests for sync progress indicators on Dashboard
 * Updated to use SyncOrchestrator instead of SyncQueue
 *
 * Key test cases:
 * 1. Progress shows for ALL users (not gated by license)
 * 2. AI-specific features (pending count, Review Now) only show with AI add-on
 * 3. Pills display in queue order
 * 4. Error state shows red pill with tooltip
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncStatusIndicator } from "../SyncStatusIndicator";
import type { SyncItem, SyncType } from "../../../services/SyncOrchestratorService";

// Mock the useLicense hook
const mockUseLicense = jest.fn();
jest.mock("../../../contexts/LicenseContext", () => ({
  useLicense: () => mockUseLicense(),
}));

// Mock the useSyncOrchestrator hook
const mockUseSyncOrchestrator = jest.fn();
jest.mock("../../../hooks/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => mockUseSyncOrchestrator(),
}));

// Helper to create SyncItem
const createSyncItem = (
  type: SyncType,
  status: 'pending' | 'running' | 'complete' | 'error' = 'pending',
  progress = 0,
  error?: string
): SyncItem => ({
  type,
  status,
  progress,
  error,
});

// Helper to create orchestrator state
const createOrchestratorState = (
  queue: SyncItem[] = [],
  isRunning = false,
  overallProgress = 0
) => ({
  state: {
    isRunning,
    queue,
    currentSync: queue.find(item => item.status === 'running')?.type ?? null,
    overallProgress,
    pendingRequest: null,
  },
  isRunning,
  queue,
  currentSync: queue.find(item => item.status === 'running')?.type ?? null,
  overallProgress,
  pendingRequest: null,
  requestSync: jest.fn(),
  forceSync: jest.fn(),
  acceptPending: jest.fn(),
  rejectPending: jest.fn(),
  cancel: jest.fn(),
});

describe("SyncStatusIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default: no AI add-on
    mockUseLicense.mockReturnValue({
      hasAIAddon: false,
      licenseType: "individual",
      isLoading: false,
    });
    // Default: empty queue (not running)
    mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Progress visibility for ALL users", () => {
    it("should render sync progress indicator when syncing (no AI add-on)", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });
      // Set up orchestrator with messages running
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 75));

      render(<SyncStatusIndicator />);

      expect(screen.getByTestId("sync-status-indicator")).toBeInTheDocument();
      expect(screen.getByText("Syncing:")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should render sync progress indicator when syncing (with AI add-on)", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: true,
        licenseType: "individual",
        isLoading: false,
      });
      // Set up orchestrator with messages running
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('emails', 'complete', 100),
        createSyncItem('messages', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 83));

      render(<SyncStatusIndicator />);

      expect(screen.getByTestId("sync-status-indicator")).toBeInTheDocument();
      expect(screen.getByText("Syncing:")).toBeInTheDocument();
    });

    it("should not render when not syncing and queue is empty", () => {
      // Default mock is already empty and not running
      render(<SyncStatusIndicator />);

      expect(screen.queryByTestId("sync-status-indicator")).not.toBeInTheDocument();
    });
  });

  describe("Queue order rendering", () => {
    it("should render pills in queue order", () => {
      // Queue order: messages first, then contacts, then emails
      const queue = [
        createSyncItem('messages', 'running', 30),
        createSyncItem('contacts', 'pending', 0),
        createSyncItem('emails', 'pending', 0),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 10));

      render(<SyncStatusIndicator />);

      const pills = screen.getAllByText(/Messages|Contacts|Emails/);
      expect(pills[0]).toHaveTextContent("Messages");
      expect(pills[1]).toHaveTextContent("Contacts");
      expect(pills[2]).toHaveTextContent("Emails");
    });

    it("should only show pills for items in queue", () => {
      // Queue only has contacts and messages (no emails)
      const queue = [
        createSyncItem('contacts', 'running', 50),
        createSyncItem('messages', 'pending', 0),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 25));

      render(<SyncStatusIndicator />);

      expect(screen.getByText("Contacts")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.queryByText("Emails")).not.toBeInTheDocument();
    });
  });

  describe("Status colors", () => {
    it("should show pending pills with gray styling", () => {
      const queue = [
        createSyncItem('contacts', 'pending', 0),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 0));

      render(<SyncStatusIndicator />);

      const pill = screen.getByText("Contacts");
      expect(pill).toHaveClass("bg-gray-100", "text-gray-500");
    });

    it("should show running pills with blue styling", () => {
      const queue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 50));

      render(<SyncStatusIndicator />);

      const pill = screen.getByText("Contacts");
      expect(pill).toHaveClass("bg-blue-100", "text-blue-700");
    });

    it("should show complete pills with green styling and checkmark", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 75));

      render(<SyncStatusIndicator />);

      const pill = screen.getByText("Contacts").closest("span");
      expect(pill).toHaveClass("bg-green-100", "text-green-700");
      // Should have a checkmark SVG
      const svg = pill?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should show error pills with red styling and X icon", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'error', 0, 'Database connection failed'),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, false, 50));

      render(<SyncStatusIndicator />);

      const pill = screen.getByText("Messages").closest("span");
      expect(pill).toHaveClass("bg-red-100", "text-red-700");
      // Should have error tooltip
      expect(pill).toHaveAttribute("title", "Database connection failed");
    });
  });

  describe("Error state", () => {
    it("should show red background when there is an error", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'error', 0, 'Import failed'),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, false, 50));

      render(<SyncStatusIndicator />);

      const indicator = screen.getByTestId("sync-status-indicator");
      expect(indicator).toHaveClass("bg-red-50", "border-red-200");
    });

    it("should show 'Sync Error:' label when there is an error", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'error', 0, 'Import failed'),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, false, 50));

      render(<SyncStatusIndicator />);

      expect(screen.getByText("Sync Error:")).toBeInTheDocument();
    });
  });

  describe("Completion state", () => {
    it("should show generic completion message for non-AI users", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
        createSyncItem('messages', 'pending', 0),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 25));

      const { rerender } = render(
        <SyncStatusIndicator pendingCount={5} />
      );

      // Transition to not syncing - update mock to empty queue (complete state)
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator pendingCount={5} />);

      // Should show generic completion, NOT "X transactions found"
      expect(screen.getByText("Sync Complete")).toBeInTheDocument();
      expect(screen.getByText("All data synced successfully")).toBeInTheDocument();
      expect(screen.queryByText(/transactions found/)).not.toBeInTheDocument();
      expect(screen.queryByText("Review Now")).not.toBeInTheDocument();
    });

    it("should show pending transactions for AI add-on users", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: true,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(
        <SyncStatusIndicator pendingCount={5} onViewPending={jest.fn()} />
      );

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator pendingCount={5} onViewPending={jest.fn()} />);

      // Should show "X transactions found" with Review Now button
      expect(screen.getByText("5 transactions found")).toBeInTheDocument();
      expect(screen.getByText("Review Now")).toBeInTheDocument();
    });

    it("should show generic completion for AI users with 0 pending", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: true,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(
        <SyncStatusIndicator pendingCount={0} />
      );

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator pendingCount={0} />);

      // Should show generic completion
      expect(screen.getByText("Sync Complete")).toBeInTheDocument();
      expect(screen.queryByText("Review Now")).not.toBeInTheDocument();
    });

    it("should auto-dismiss completion after 5 seconds", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(<SyncStatusIndicator />);

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator />);

      expect(screen.getByTestId("sync-status-complete")).toBeInTheDocument();

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(screen.queryByTestId("sync-status-complete")).not.toBeInTheDocument();
    });

    it("should allow manual dismiss of completion message", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(<SyncStatusIndicator />);

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator />);

      expect(screen.getByTestId("sync-status-complete")).toBeInTheDocument();

      // Click dismiss button
      fireEvent.click(screen.getByLabelText("Dismiss notification"));

      expect(screen.queryByTestId("sync-status-complete")).not.toBeInTheDocument();
    });
  });

  describe("Review Now button", () => {
    it("should call onViewPending when Review Now is clicked", () => {
      const onViewPending = jest.fn();
      mockUseLicense.mockReturnValue({
        hasAIAddon: true,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(
        <SyncStatusIndicator pendingCount={3} onViewPending={onViewPending} />
      );

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(
        <SyncStatusIndicator pendingCount={3} onViewPending={onViewPending} />
      );

      fireEvent.click(screen.getByText("Review Now"));

      expect(onViewPending).toHaveBeenCalledTimes(1);
    });
  });

  describe("Progress persistence", () => {
    it("should reset dismissed state when new sync starts", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });
      // Start with running state
      const runningQueue = [
        createSyncItem('contacts', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(runningQueue, true, 50));

      const { rerender } = render(<SyncStatusIndicator />);

      // Transition to not syncing
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState([], false, 0));
      rerender(<SyncStatusIndicator />);

      // Dismiss manually
      fireEvent.click(screen.getByLabelText("Dismiss notification"));
      expect(screen.queryByTestId("sync-status-complete")).not.toBeInTheDocument();

      // Start syncing again
      const newRunningQueue = [
        createSyncItem('contacts', 'running', 30),
        createSyncItem('messages', 'pending', 0),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(newRunningQueue, true, 15));
      rerender(<SyncStatusIndicator />);

      // Progress indicator should show again
      expect(screen.getByTestId("sync-status-indicator")).toBeInTheDocument();
    });
  });

  describe("Progress display", () => {
    it("should show progress percentage for running sync", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'running', 65),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 82));

      render(<SyncStatusIndicator />);

      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("should show active item progress in progress bar (matches % text)", () => {
      const queue = [
        createSyncItem('contacts', 'complete', 100),
        createSyncItem('messages', 'running', 50),
      ];
      mockUseSyncOrchestrator.mockReturnValue(createOrchestratorState(queue, true, 75));

      render(<SyncStatusIndicator />);

      // Progress bar should show activeProgress (50%) to match the displayed % text
      const progressBar = screen.getByTestId("sync-status-indicator").querySelector('.bg-blue-500');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });
});
