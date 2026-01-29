/**
 * SyncStatusIndicator Tests
 *
 * TASK-1740: Tests for sync progress indicators on Dashboard
 *
 * Key test cases:
 * 1. Progress shows for ALL users (not gated by license)
 * 2. AI-specific features (pending count, Review Now) only show with AI add-on
 * 3. All three sync types display correctly
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncStatusIndicator } from "../SyncStatusIndicator";
import type { SyncStatus } from "../../../hooks/useAutoRefresh";

// Mock the useLicense hook
const mockUseLicense = jest.fn();
jest.mock("../../../contexts/LicenseContext", () => ({
  useLicense: () => mockUseLicense(),
}));

describe("SyncStatusIndicator", () => {
  // Default sync status (all idle)
  const idleSyncStatus: SyncStatus = {
    emails: { isSyncing: false, progress: null, message: null, error: null },
    messages: { isSyncing: false, progress: null, message: null, error: null },
    contacts: { isSyncing: false, progress: null, message: null, error: null },
  };

  // Active sync status (messages syncing)
  const messagesSyncingStatus: SyncStatus = {
    emails: { isSyncing: false, progress: 100, message: "Done", error: null },
    messages: { isSyncing: true, progress: 50, message: "Importing...", error: null },
    contacts: { isSyncing: false, progress: null, message: null, error: null },
  };

  // All syncing status
  const allSyncingStatus: SyncStatus = {
    emails: { isSyncing: true, progress: 30, message: "Syncing...", error: null },
    messages: { isSyncing: true, progress: 50, message: "Importing...", error: null },
    contacts: { isSyncing: true, progress: 70, message: "Syncing...", error: null },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default: no AI add-on
    mockUseLicense.mockReturnValue({
      hasAIAddon: false,
      licenseType: "individual",
      isLoading: false,
    });
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

      render(
        <SyncStatusIndicator
          status={messagesSyncingStatus}
          isAnySyncing={true}
          currentMessage="Importing messages..."
        />
      );

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

      render(
        <SyncStatusIndicator
          status={messagesSyncingStatus}
          isAnySyncing={true}
          currentMessage="Importing messages..."
        />
      );

      expect(screen.getByTestId("sync-status-indicator")).toBeInTheDocument();
      expect(screen.getByText("Syncing:")).toBeInTheDocument();
    });

    it("should not render when not syncing and not dismissed", () => {
      render(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
        />
      );

      expect(screen.queryByTestId("sync-status-indicator")).not.toBeInTheDocument();
    });
  });

  describe("All three sync types display correctly", () => {
    it("should show all three sync type pills", () => {
      render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
        />
      );

      expect(screen.getByText("Emails")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("Contacts")).toBeInTheDocument();
    });

    it("should show completed status for finished sync types", () => {
      const partiallyCompleteStatus: SyncStatus = {
        emails: { isSyncing: false, progress: 100, message: "Done", error: null },
        messages: { isSyncing: true, progress: 50, message: "Importing...", error: null },
        contacts: { isSyncing: false, progress: 100, message: "Done", error: null },
      };

      render(
        <SyncStatusIndicator
          status={partiallyCompleteStatus}
          isAnySyncing={true}
          currentMessage="Importing messages..."
        />
      );

      // All three labels should be present
      expect(screen.getByText("Emails")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("Contacts")).toBeInTheDocument();
    });
  });

  describe("Completion state", () => {
    it("should show generic completion message for non-AI users", () => {
      mockUseLicense.mockReturnValue({
        hasAIAddon: false,
        licenseType: "individual",
        isLoading: false,
      });

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
          pendingCount={5}
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
          pendingCount={5}
        />
      );

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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
          pendingCount={5}
          onViewPending={jest.fn()}
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
          pendingCount={5}
          onViewPending={jest.fn()}
        />
      );

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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
          pendingCount={0}
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
          pendingCount={0}
        />
      );

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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
        />
      );

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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
        />
      );

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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
          pendingCount={3}
          onViewPending={onViewPending}
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
          pendingCount={3}
          onViewPending={onViewPending}
        />
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

      const { rerender } = render(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
        />
      );

      // Transition to not syncing
      rerender(
        <SyncStatusIndicator
          status={idleSyncStatus}
          isAnySyncing={false}
          currentMessage={null}
        />
      );

      // Dismiss manually
      fireEvent.click(screen.getByLabelText("Dismiss notification"));
      expect(screen.queryByTestId("sync-status-complete")).not.toBeInTheDocument();

      // Start syncing again
      rerender(
        <SyncStatusIndicator
          status={allSyncingStatus}
          isAnySyncing={true}
          currentMessage="Syncing..."
        />
      );

      // Progress indicator should show again
      expect(screen.getByTestId("sync-status-indicator")).toBeInTheDocument();
    });
  });
});
