/**
 * Tests for Sync Progress UI Components
 * Covers SyncProgressBar, SyncStatus, SyncComplete, SyncError, CancelSyncModal
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  SyncProgressBar,
  SyncStatus,
  SyncComplete,
  SyncError,
  CancelSyncModal,
} from "../sync";
import type { BackupProgress, SyncResult } from "../sync";

describe("SyncProgressBar", () => {
  describe("Rendering", () => {
    it("should render with 0% progress", () => {
      render(<SyncProgressBar percent={0} phase="Preparing" />);

      expect(screen.getByText("Preparing")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should render with 50% progress", () => {
      render(<SyncProgressBar percent={50} phase="Transferring" />);

      expect(screen.getByText("Transferring")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should render with 100% progress", () => {
      render(<SyncProgressBar percent={100} phase="Complete" />);

      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should round decimal percentages to whole numbers", () => {
      render(<SyncProgressBar percent={45.7} phase="Transferring" />);

      expect(screen.getByText("46%")).toBeInTheDocument();
    });

    it("should clamp progress to 0-100 range", () => {
      const { rerender } = render(
        <SyncProgressBar percent={-10} phase="Test" />,
      );
      expect(screen.getByText("0%")).toBeInTheDocument();

      rerender(<SyncProgressBar percent={150} phase="Test" />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should apply animation class when animated is true", () => {
      const { container } = render(
        <SyncProgressBar percent={50} phase="Test" animated={true} />,
      );
      const progressFill = container.querySelector(".progress-fill");
      expect(progressFill).toHaveClass("animate-pulse");
    });

    it("should not apply animation class when animated is false", () => {
      const { container } = render(
        <SyncProgressBar percent={50} phase="Test" animated={false} />,
      );
      const progressFill = container.querySelector(".progress-fill");
      expect(progressFill).not.toHaveClass("animate-pulse");
    });
  });
});

describe("SyncStatus", () => {
  const mockProgress: BackupProgress = {
    phase: "transferring",
    percentComplete: 45,
    currentFile: "Library/SMS/sms.db",
    filesTransferred: 450,
    totalFiles: 1000,
  };

  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render syncing title", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      expect(screen.getByText("Syncing Your iPhone")).toBeInTheDocument();
    });

    it("should display correct phase label", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      expect(screen.getByText("Transferring data...")).toBeInTheDocument();
    });

    it("should display current file", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      expect(screen.getByText("Library/SMS/sms.db")).toBeInTheDocument();
    });

    it("should display file count", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      expect(screen.getByText("450 of 1000 files")).toBeInTheDocument();
    });

    it("should show reminder message", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      expect(
        screen.getByText("Keep your iPhone connected and unlocked"),
      ).toBeInTheDocument();
    });

    it("should not show file info when not provided", () => {
      const minimalProgress: BackupProgress = {
        phase: "preparing",
        percentComplete: 10,
      };
      render(<SyncStatus progress={minimalProgress} onCancel={mockOnCancel} />);

      expect(screen.queryByText(/of.*files/)).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onCancel when cancel button clicked", () => {
      render(<SyncStatus progress={mockProgress} onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByText("Cancel Sync"));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});

describe("SyncComplete", () => {
  const mockResult: SyncResult = {
    messagesCount: 1234,
    contactsCount: 56,
    duration: 180000, // 3 minutes
  };

  const mockOnContinue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render success title", () => {
      render(<SyncComplete result={mockResult} onContinue={mockOnContinue} />);

      expect(screen.getByText("Sync Complete!")).toBeInTheDocument();
    });

    it("should display message count with locale formatting", () => {
      render(<SyncComplete result={mockResult} onContinue={mockOnContinue} />);

      expect(screen.getByText("1,234 messages")).toBeInTheDocument();
    });

    it("should display contact count", () => {
      render(<SyncComplete result={mockResult} onContinue={mockOnContinue} />);

      expect(screen.getByText("56 contacts")).toBeInTheDocument();
    });

    it("should display duration in minutes", () => {
      render(<SyncComplete result={mockResult} onContinue={mockOnContinue} />);

      expect(screen.getByText("Completed in 3 minutes")).toBeInTheDocument();
    });

    it("should use singular minute for 1 minute duration", () => {
      const oneMinuteResult = { ...mockResult, duration: 60000 };
      render(
        <SyncComplete result={oneMinuteResult} onContinue={mockOnContinue} />,
      );

      expect(screen.getByText("Completed in 1 minute")).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onContinue when View Messages clicked", () => {
      render(<SyncComplete result={mockResult} onContinue={mockOnContinue} />);

      fireEvent.click(screen.getByText("View Messages"));
      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });
  });
});

describe("SyncError", () => {
  const mockOnRetry = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render error title", () => {
      render(
        <SyncError
          error="DEVICE_DISCONNECTED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByText("Sync Failed")).toBeInTheDocument();
    });

    it("should display friendly error for DEVICE_DISCONNECTED", () => {
      render(
        <SyncError
          error="DEVICE_DISCONNECTED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText(
          "Your iPhone was disconnected. Please reconnect and try again.",
        ),
      ).toBeInTheDocument();
    });

    it("should display friendly error for DEVICE_LOCKED", () => {
      render(
        <SyncError
          error="DEVICE_LOCKED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText("Please unlock your iPhone and try again."),
      ).toBeInTheDocument();
    });

    it("should display friendly error for BACKUP_FAILED", () => {
      render(
        <SyncError
          error="BACKUP_FAILED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText("The sync could not be completed. Please try again."),
      ).toBeInTheDocument();
    });

    it("should display friendly error for PASSWORD_INCORRECT", () => {
      render(
        <SyncError
          error="PASSWORD_INCORRECT"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText(
          "The backup password was incorrect. Please try again.",
        ),
      ).toBeInTheDocument();
    });

    it("should display generic error for unknown error codes", () => {
      render(
        <SyncError
          error="UNKNOWN_ERROR"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText("An unexpected error occurred. Please try again."),
      ).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onRetry when Try Again clicked", () => {
      render(
        <SyncError
          error="BACKUP_FAILED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      fireEvent.click(screen.getByText("Try Again"));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("should call onCancel when Cancel clicked", () => {
      render(
        <SyncError
          error="BACKUP_FAILED"
          onRetry={mockOnRetry}
          onCancel={mockOnCancel}
        />,
      );

      fireEvent.click(screen.getByText("Cancel"));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});

describe("CancelSyncModal", () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(
        <CancelSyncModal
          isOpen={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.queryByText("Cancel Sync?")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(
        <CancelSyncModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByText("Cancel Sync?")).toBeInTheDocument();
    });

    it("should display warning message", () => {
      render(
        <CancelSyncModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />,
      );

      expect(
        screen.getByText(/sync is still in progress/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/no data will be saved/i)).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onConfirm when Cancel Sync button clicked", () => {
      render(
        <CancelSyncModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />,
      );

      // There are two "Cancel Sync" texts - one in header and one button
      const cancelButton = screen
        .getAllByText("Cancel Sync")
        .find((el) => el.tagName === "BUTTON");
      fireEvent.click(cancelButton!);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("should call onCancel when Continue Sync button clicked", () => {
      render(
        <CancelSyncModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />,
      );

      fireEvent.click(screen.getByText("Continue Sync"));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
