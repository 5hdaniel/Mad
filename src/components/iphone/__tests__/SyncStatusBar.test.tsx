/**
 * Tests for SyncStatusBar component
 * TASK-2116: Persistent sync status bar
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncStatusBar } from "../SyncStatusBar";
import type { BackupProgress, SyncStatus } from "../../../types/iphone";

// Helper to render with default props
function renderBar(overrides: {
  syncStatus?: SyncStatus;
  progress?: BackupProgress | null;
  error?: string | null;
  onCancel?: () => void;
} = {}) {
  const props = {
    syncStatus: "idle" as SyncStatus,
    progress: null as BackupProgress | null,
    error: null as string | null,
    onCancel: jest.fn(),
    ...overrides,
  };
  return { ...render(<SyncStatusBar {...props} />), props };
}

describe("SyncStatusBar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when idle", () => {
    renderBar({ syncStatus: "idle" });
    expect(screen.queryByTestId("sync-status-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-status-bar-complete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-status-bar-error")).not.toBeInTheDocument();
  });

  it("shows progress bar during syncing", () => {
    renderBar({
      syncStatus: "syncing",
      progress: {
        phase: "backing_up",
        percent: 0,
        message: "Exporting...",
      },
    });
    expect(screen.getByTestId("sync-status-bar")).toBeInTheDocument();
    expect(screen.getByText("Exporting iPhone data...")).toBeInTheDocument();
  });

  it("shows bytes and file count during sync", () => {
    renderBar({
      syncStatus: "syncing",
      progress: {
        phase: "backing_up",
        percent: 0,
        bytesProcessed: 148897792, // ~142 MB
        processedFiles: 1204,
      },
    });
    expect(screen.getByText(/142\.0 MB transferred/)).toBeInTheDocument();
    expect(screen.getByText(/1,204 files/)).toBeInTheDocument();
  });

  it("shows determinate progress for extracting phase", () => {
    renderBar({
      syncStatus: "syncing",
      progress: {
        phase: "extracting",
        percent: 45,
        message: "Reading messages...",
      },
    });
    expect(screen.getByTestId("sync-status-bar")).toBeInTheDocument();
    expect(screen.getByText("Reading messages...")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows completion message briefly after sync completes", () => {
    const { rerender } = render(
      <SyncStatusBar
        syncStatus="syncing"
        progress={{ phase: "backing_up", percent: 50 }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    // Transition to complete
    rerender(
      <SyncStatusBar
        syncStatus="complete"
        progress={{ phase: "complete", percent: 100, message: "Saved 2,847 messages" }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("sync-status-bar-complete")).toBeInTheDocument();
    expect(screen.getByText("Saved 2,847 messages")).toBeInTheDocument();
  });

  it("auto-dismisses completion after 5 seconds", () => {
    const { rerender } = render(
      <SyncStatusBar
        syncStatus="syncing"
        progress={{ phase: "backing_up", percent: 50 }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    // Transition to complete
    rerender(
      <SyncStatusBar
        syncStatus="complete"
        progress={{ phase: "complete", percent: 100 }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("sync-status-bar-complete")).toBeInTheDocument();

    // Advance past auto-dismiss timeout
    act(() => {
      jest.advanceTimersByTime(5100);
    });

    expect(screen.queryByTestId("sync-status-bar-complete")).not.toBeInTheDocument();
  });

  it("shows error with dismiss button (no auto-dismiss)", () => {
    const { rerender } = render(
      <SyncStatusBar
        syncStatus="syncing"
        progress={{ phase: "backing_up", percent: 50 }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    // Transition to error
    rerender(
      <SyncStatusBar
        syncStatus="error"
        progress={{ phase: "error", percent: 0 }}
        error="Device disconnected"
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("sync-status-bar-error")).toBeInTheDocument();
    expect(screen.getByText(/Device disconnected/)).toBeInTheDocument();

    // Should NOT auto-dismiss
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByTestId("sync-status-bar-error")).toBeInTheDocument();
  });

  it("dismisses error on click", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const { rerender } = render(
      <SyncStatusBar
        syncStatus="syncing"
        progress={{ phase: "backing_up", percent: 50 }}
        error={null}
        onCancel={jest.fn()}
      />
    );

    rerender(
      <SyncStatusBar
        syncStatus="error"
        progress={{ phase: "error", percent: 0 }}
        error="Device disconnected"
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("sync-status-bar-error")).toBeInTheDocument();

    await user.click(screen.getByTestId("sync-status-bar-dismiss"));

    expect(screen.queryByTestId("sync-status-bar-error")).not.toBeInTheDocument();
  });

  it("cancel button calls onCancel", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onCancel = jest.fn();

    renderBar({
      syncStatus: "syncing",
      progress: {
        phase: "backing_up",
        percent: 30,
      },
      onCancel,
    });

    await user.click(screen.getByTestId("sync-status-bar-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows storing phase label", () => {
    renderBar({
      syncStatus: "syncing",
      progress: {
        phase: "storing",
        percent: 60,
        message: "Saving to database...",
      },
    });
    expect(screen.getByText("Saving to database...")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
