/**
 * Tests for TransactionToolbar component
 * Verifies AI gating behavior for Rejected filter tab (BACKLOG-462)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransactionToolbar from "../TransactionToolbar";
import type { TransactionToolbarProps } from "../TransactionToolbar";

// Mock the LicenseContext
jest.mock("@/contexts/LicenseContext", () => ({
  useLicense: jest.fn(),
}));

import { useLicense } from "@/contexts/LicenseContext";

const mockUseLicense = useLicense as jest.MockedFunction<typeof useLicense>;

// Helper to create default props
function createDefaultProps(overrides: Partial<TransactionToolbarProps> = {}): TransactionToolbarProps {
  return {
    transactionCount: 10,
    onClose: jest.fn(),
    filter: "all",
    onFilterChange: jest.fn(),
    filterCounts: {
      all: 10,
      pending: 2,
      active: 5,
      closed: 2,
      rejected: 1,
    },
    searchQuery: "",
    onSearchChange: jest.fn(),
    scanning: false,
    scanProgress: null,
    onStartScan: jest.fn(),
    onStopScan: jest.fn(),
    selectionMode: false,
    onToggleSelectionMode: jest.fn(),
    showStatusInfo: false,
    onToggleStatusInfo: jest.fn(),
    onNewTransaction: jest.fn(),
    error: null,
    quickExportSuccess: null,
    bulkActionSuccess: null,
    ...overrides,
  };
}

// Helper to create mock license context value
function createMockLicenseContext(hasAIAddon: boolean) {
  return {
    licenseType: "individual" as const,
    hasAIAddon,
    organizationId: null,
    canExport: true,
    canSubmit: false,
    canAutoDetect: hasAIAddon,
    isLoading: false,
    refresh: jest.fn(),
  };
}

describe("TransactionToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rejected filter tab AI gating (BACKLOG-462)", () => {
    it("should show Rejected tab when user has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(<TransactionToolbar {...createDefaultProps()} />);

      // Find the Rejected button
      const rejectedButton = screen.getByRole("button", { name: /rejected/i });
      expect(rejectedButton).toBeInTheDocument();
    });

    it("should hide Rejected tab when user does not have AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));

      render(<TransactionToolbar {...createDefaultProps()} />);

      // Rejected button should not be present
      const rejectedButton = screen.queryByRole("button", { name: /rejected/i });
      expect(rejectedButton).not.toBeInTheDocument();
    });

    it("should show rejected count badge when count > 0 and has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(
        <TransactionToolbar
          {...createDefaultProps({
            filterCounts: {
              all: 10,
              pending: 2,
              active: 5,
              closed: 2,
              rejected: 3,
            },
          })}
        />
      );

      // Find the Rejected button and check for count badge
      const rejectedButton = screen.getByRole("button", { name: /rejected/i });
      expect(rejectedButton).toHaveTextContent("3");
    });
  });

  describe("Pending Review filter tab AI gating", () => {
    it("should show Pending Review tab when user has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(<TransactionToolbar {...createDefaultProps()} />);

      const pendingButton = screen.getByRole("button", { name: /pending review/i });
      expect(pendingButton).toBeInTheDocument();
    });

    it("should hide Pending Review tab when user does not have AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));

      render(<TransactionToolbar {...createDefaultProps()} />);

      const pendingButton = screen.queryByRole("button", { name: /pending review/i });
      expect(pendingButton).not.toBeInTheDocument();
    });
  });

  describe("Auto Detect button AI gating", () => {
    it("should show Auto Detect button when user has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(<TransactionToolbar {...createDefaultProps()} />);

      const autoDetectButton = screen.getByRole("button", { name: /auto detect/i });
      expect(autoDetectButton).toBeInTheDocument();
    });

    it("should hide Auto Detect button when user does not have AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));

      render(<TransactionToolbar {...createDefaultProps()} />);

      const autoDetectButton = screen.queryByRole("button", { name: /auto detect/i });
      expect(autoDetectButton).not.toBeInTheDocument();
    });
  });

  describe("Non-gated filter tabs", () => {
    it("should always show All tab regardless of AI add-on", () => {
      // Without AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));
      const { rerender } = render(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();

      // With AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));
      rerender(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
    });

    it("should always show Active tab regardless of AI add-on", () => {
      // Without AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));
      const { rerender } = render(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^active/i })).toBeInTheDocument();

      // With AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));
      rerender(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^active/i })).toBeInTheDocument();
    });

    it("should always show Closed tab regardless of AI add-on", () => {
      // Without AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));
      const { rerender } = render(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^closed/i })).toBeInTheDocument();

      // With AI
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));
      rerender(<TransactionToolbar {...createDefaultProps()} />);
      expect(screen.getByRole("button", { name: /^closed/i })).toBeInTheDocument();
    });
  });

  describe("Status info tooltip AI gating", () => {
    it("should show Rejected explanation in tooltip only when user has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(
        <TransactionToolbar
          {...createDefaultProps({
            showStatusInfo: true,
          })}
        />
      );

      // Tooltip should contain Rejected explanation (unique text, not the button text)
      expect(screen.getByText("Not a real transaction (false positive)")).toBeInTheDocument();
    });

    it("should not show Rejected explanation in tooltip when user does not have AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));

      render(
        <TransactionToolbar
          {...createDefaultProps({
            showStatusInfo: true,
          })}
        />
      );

      // Tooltip should NOT contain Rejected explanation
      expect(screen.queryByText("Not a real transaction (false positive)")).not.toBeInTheDocument();
    });

    it("should show Pending Review explanation in tooltip only when user has AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(true));

      render(
        <TransactionToolbar
          {...createDefaultProps({
            showStatusInfo: true,
          })}
        />
      );

      // Tooltip should contain Pending Review explanation (unique text, not the button text)
      expect(screen.getByText("Auto-detected transaction awaiting your approval")).toBeInTheDocument();
    });

    it("should not show Pending Review explanation in tooltip when user does not have AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext(false));

      render(
        <TransactionToolbar
          {...createDefaultProps({
            showStatusInfo: true,
          })}
        />
      );

      // Tooltip should NOT contain Pending Review explanation
      expect(screen.queryByText("Auto-detected transaction awaiting your approval")).not.toBeInTheDocument();
    });
  });
});
