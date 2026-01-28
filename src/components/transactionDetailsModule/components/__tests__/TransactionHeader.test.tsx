/**
 * Tests for TransactionHeader component
 * Verifies action button visibility based on license type (BACKLOG-459)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { TransactionHeader } from "../TransactionHeader";
import type { Transaction } from "@/types";

// Mock the useLicense hook
jest.mock("@/contexts/LicenseContext", () => ({
  useLicense: jest.fn(),
}));

import { useLicense } from "@/contexts/LicenseContext";

const mockUseLicense = useLicense as jest.MockedFunction<typeof useLicense>;

// Helper to create mock license context value
function createMockLicenseContext(licenseType: "individual" | "team" | "enterprise", hasAIAddon = false, isLoading = false) {
  return {
    licenseType,
    hasAIAddon,
    organizationId: licenseType === "individual" ? null : "org-123",
    canExport: licenseType === "individual",
    canSubmit: licenseType === "team" || licenseType === "enterprise",
    canAutoDetect: hasAIAddon,
    isLoading,
    refresh: jest.fn(),
  };
}

// Create mock transaction
function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-123",
    user_id: "user-123",
    property_address: "123 Main St",
    status: "active",
    export_status: "not_exported",
    export_count: 0,
    message_count: 5,
    attachment_count: 2,
    submission_status: "not_submitted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Default props for TransactionHeader
const defaultProps = {
  isPendingReview: false,
  isRejected: false,
  isApproving: false,
  isRejecting: false,
  isRestoring: false,
  isSubmitting: false,
  onClose: jest.fn(),
  onShowRejectReasonModal: jest.fn(),
  onShowEditModal: jest.fn(),
  onApprove: jest.fn(),
  onRestore: jest.fn(),
  onShowExportModal: jest.fn(),
  onShowDeleteConfirm: jest.fn(),
  onShowSubmitModal: jest.fn(),
};

describe("TransactionHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("BACKLOG-459: Team License Export After Submission", () => {
    it("should show both Submit and Export buttons for team license users", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));
      const transaction = createMockTransaction({ submission_status: "not_submitted" });

      render(<TransactionHeader {...defaultProps} transaction={transaction} />);

      // Team should see Submit button
      expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
      // Team should also see Export button (BACKLOG-459)
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
      // Team should see Edit button
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      // Team should see Delete button
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should show only Export button for individual license users (no Submit)", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));
      const transaction = createMockTransaction();

      render(<TransactionHeader {...defaultProps} transaction={transaction} />);

      // Individual should NOT see Submit button
      expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
      // Individual should see Export button
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
      // Individual should see Edit button
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      // Individual should see Delete button
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should show Export button for team users even after submission", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));
      const transaction = createMockTransaction({ submission_status: "submitted" });

      render(<TransactionHeader {...defaultProps} transaction={transaction} />);

      // Team should see Submitted badge instead of Submit button
      expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
      expect(screen.getByText(/submitted/i)).toBeInTheDocument();
      // Team should still see Export button (BACKLOG-459: available after submission)
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });

    it("should show Resubmit button for team users when needs_changes", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));
      const transaction = createMockTransaction({ submission_status: "needs_changes" });

      render(<TransactionHeader {...defaultProps} transaction={transaction} />);

      // Team should see Resubmit button
      expect(screen.getByRole("button", { name: /resubmit/i })).toBeInTheDocument();
      // Team should also see Export button
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });

    it("should show both Submit and Export for enterprise license users", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("enterprise", false, false));
      const transaction = createMockTransaction({ submission_status: "not_submitted" });

      render(<TransactionHeader {...defaultProps} transaction={transaction} />);

      // Enterprise should see Submit button (same as team)
      expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
      // Enterprise should also see Export button
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });
  });

  describe("Pending Review Mode", () => {
    it("should show Approve/Reject/Edit buttons in pending review mode", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));
      const transaction = createMockTransaction();

      render(
        <TransactionHeader
          {...defaultProps}
          transaction={transaction}
          isPendingReview={true}
        />
      );

      // Pending review should show Approve, Reject, Edit
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      // Should NOT show Export/Submit/Delete in pending review mode
      expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe("Rejected Mode", () => {
    it("should show Restore/Delete buttons in rejected mode", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));
      const transaction = createMockTransaction();

      render(
        <TransactionHeader
          {...defaultProps}
          transaction={transaction}
          isRejected={true}
        />
      );

      // Rejected should show Restore and Delete
      expect(screen.getByRole("button", { name: /restore to active/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      // Should NOT show Export/Submit/Edit in rejected mode
      expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    });
  });
});
