/**
 * Tests for IPhoneSyncFlow component
 * TASK-2116: Tests re-open modal redirect message during active sync
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { IPhoneSyncFlow } from "../IPhoneSyncFlow";
import type { UseIPhoneSyncReturn } from "../../../types/iphone";

// Mock the context
const mockSyncReturn: UseIPhoneSyncReturn = {
  isConnected: true,
  device: {
    udid: "test-udid",
    name: "Test iPhone",
    productType: "iPhone14,2",
    productVersion: "17.0",
    serialNumber: "ABC123",
    isConnected: true,
  },
  syncStatus: "idle",
  progress: null,
  error: null,
  needsPassword: false,
  lastSyncTime: null,
  isWaitingForPasscode: false,
  syncLocked: false,
  lockReason: null,
  startSync: jest.fn(),
  submitPassword: jest.fn(),
  cancelSync: jest.fn(),
  checkSyncStatus: jest.fn(),
};

let mockContextValue: UseIPhoneSyncReturn = { ...mockSyncReturn };

jest.mock("../../../contexts/IPhoneSyncContext", () => ({
  useIPhoneSyncContext: () => mockContextValue,
}));

// Mock sub-components to simplify tests
jest.mock("../ConnectionStatus", () => ({
  ConnectionStatus: ({ isConnected }: { isConnected: boolean }) => (
    <div data-testid="connection-status">
      {isConnected ? "Connected" : "Disconnected"}
    </div>
  ),
}));

jest.mock("../SyncProgress", () => ({
  SyncProgress: () => <div data-testid="sync-progress">Progress</div>,
}));

jest.mock("../BackupPasswordModal", () => ({
  BackupPasswordModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="password-modal">Password</div> : null,
}));

jest.mock("../../sync/SyncLockBanner", () => ({
  SyncLockBanner: () => <div data-testid="sync-lock-banner">Locked</div>,
}));

describe("IPhoneSyncFlow", () => {
  beforeEach(() => {
    mockContextValue = { ...mockSyncReturn };
  });

  it("shows connection status when idle", () => {
    render(<IPhoneSyncFlow />);
    expect(screen.getByTestId("connection-status")).toBeInTheDocument();
  });

  it("shows redirect message when re-opening modal during active sync", () => {
    const onClose = jest.fn();

    // Simulate state after sync has started and modal was auto-closed:
    // - syncStatus is "syncing"
    // - progress is in backing_up phase
    // - The component has already called onSyncStarted (hasCalledSyncStarted.current = true)
    mockContextValue = {
      ...mockSyncReturn,
      syncStatus: "syncing",
      progress: {
        phase: "backing_up",
        percent: 30,
        message: "Exporting...",
      },
    };

    // First render triggers the onSyncStarted callback (simulating auto-close)
    const onSyncStarted = jest.fn();
    const { rerender } = render(
      <IPhoneSyncFlow onClose={onClose} onSyncStarted={onSyncStarted} />
    );

    // onSyncStarted should have been called (triggering modal auto-close)
    expect(onSyncStarted).toHaveBeenCalledTimes(1);

    // Re-render (simulating user re-opening the modal while sync is still running)
    rerender(
      <IPhoneSyncFlow onClose={onClose} onSyncStarted={onSyncStarted} />
    );

    // Should show the redirect message
    expect(screen.getByText("Sync in progress")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check the status bar at the top of the screen for progress details."
      )
    ).toBeInTheDocument();

    // Close button should be present
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("shows redirect message during extracting phase after auto-close", () => {
    const onClose = jest.fn();
    const onSyncStarted = jest.fn();

    // Start in backing_up to trigger onSyncStarted
    mockContextValue = {
      ...mockSyncReturn,
      syncStatus: "syncing",
      progress: {
        phase: "backing_up",
        percent: 30,
      },
    };

    const { rerender } = render(
      <IPhoneSyncFlow onClose={onClose} onSyncStarted={onSyncStarted} />
    );

    expect(onSyncStarted).toHaveBeenCalledTimes(1);

    // Progress moves to extracting phase
    mockContextValue = {
      ...mockSyncReturn,
      syncStatus: "syncing",
      progress: {
        phase: "extracting",
        percent: 50,
        message: "Reading messages...",
      },
    };

    rerender(
      <IPhoneSyncFlow onClose={onClose} onSyncStarted={onSyncStarted} />
    );

    // Should still show redirect message (not SyncProgress)
    expect(screen.getByText("Sync in progress")).toBeInTheDocument();
  });
});
