/**
 * Tests for TransactionList.tsx
 * Covers approve/reject actions for AI-detected pending transactions
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import TransactionList from "../TransactionList";

describe("TransactionList", () => {
  const mockUserId = "user-123";
  const mockProvider = "google";
  const mockOnClose = jest.fn();

  // Transaction with pending detection status (AI-detected, awaiting review)
  const pendingTransaction = {
    id: "txn-pending",
    user_id: mockUserId,
    property_address: "123 Pending Street",
    transaction_type: "purchase",
    status: "active",
    sale_price: 450000,
    closing_date: "2024-03-15",
    total_communications_count: 25,
    extraction_confidence: 85,
    detection_source: "auto",
    detection_status: "pending",
    detection_confidence: 0.85,
  };

  // Transaction with confirmed detection status
  const confirmedTransaction = {
    id: "txn-confirmed",
    user_id: mockUserId,
    property_address: "456 Confirmed Avenue",
    transaction_type: "sale",
    status: "active",
    sale_price: 325000,
    closing_date: "2024-01-20",
    total_communications_count: 18,
    extraction_confidence: 92,
    detection_source: "auto",
    detection_status: "confirmed",
    detection_confidence: 0.92,
  };

  // Manual transaction (no detection status)
  const manualTransaction = {
    id: "txn-manual",
    user_id: mockUserId,
    property_address: "789 Manual Road",
    transaction_type: "purchase",
    status: "active",
    sale_price: 550000,
    closing_date: null,
    total_communications_count: 12,
    extraction_confidence: 78,
    detection_source: "manual",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: return transactions with different detection statuses
    window.api.transactions.getAll.mockResolvedValue({
      success: true,
      transactions: [pendingTransaction, confirmedTransaction, manualTransaction],
    });
    window.api.transactions.update.mockResolvedValue({ success: true });
    window.api.feedback.recordTransaction.mockResolvedValue({ success: true });
    window.api.onTransactionScanProgress.mockReturnValue(jest.fn());
  });

  describe("Approve/Reject Action Buttons", () => {
    it("should show approve and reject buttons only for pending transactions", async () => {
      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Get all transaction cards
      const pendingCard = screen
        .getByText("123 Pending Street")
        .closest(".bg-white");
      const confirmedCard = screen
        .getByText("456 Confirmed Avenue")
        .closest(".bg-white");
      const manualCard = screen
        .getByText("789 Manual Road")
        .closest(".bg-white");

      // Pending transaction should have approve/reject buttons
      expect(
        within(pendingCard!).getByTitle("Approve transaction"),
      ).toBeInTheDocument();
      expect(
        within(pendingCard!).getByTitle("Reject transaction"),
      ).toBeInTheDocument();

      // Confirmed transaction should NOT have approve/reject buttons
      expect(
        within(confirmedCard!).queryByTitle("Approve transaction"),
      ).not.toBeInTheDocument();
      expect(
        within(confirmedCard!).queryByTitle("Reject transaction"),
      ).not.toBeInTheDocument();

      // Manual transaction should NOT have approve/reject buttons
      expect(
        within(manualCard!).queryByTitle("Approve transaction"),
      ).not.toBeInTheDocument();
      expect(
        within(manualCard!).queryByTitle("Reject transaction"),
      ).not.toBeInTheDocument();
    });

    it("should call APIs when approve button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Click approve button
      const approveButton = screen.getByTitle("Approve transaction");
      await user.click(approveButton);

      // Verify transaction update was called
      await waitFor(() => {
        expect(window.api.transactions.update).toHaveBeenCalledWith(
          "txn-pending",
          expect.objectContaining({
            detection_status: "confirmed",
            reviewed_at: expect.any(String),
          }),
        );
      });

      // Verify feedback was recorded
      expect(window.api.feedback.recordTransaction).toHaveBeenCalledWith(
        mockUserId,
        {
          detectedTransactionId: "txn-pending",
          action: "confirm",
        },
      );

      // Verify transactions were reloaded
      expect(window.api.transactions.getAll).toHaveBeenCalledTimes(2);
    });

    it("should open reject modal when reject button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Click reject button
      const rejectButton = screen.getByTitle("Reject transaction");
      await user.click(rejectButton);

      // Verify modal appears
      await waitFor(() => {
        expect(screen.getByText("Reject Transaction")).toBeInTheDocument();
      });

      // Verify modal has required elements
      expect(
        screen.getByPlaceholderText(
          /not a real estate transaction/i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      // Use more specific selector for the submit button (type="submit")
      const modal = screen.getByText("Reject Transaction").closest("div");
      expect(within(modal!).getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    });

    it("should call APIs when reject is submitted with reason", async () => {
      const user = userEvent.setup();

      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Open reject modal
      const rejectButton = screen.getByTitle("Reject transaction");
      await user.click(rejectButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Reject Transaction")).toBeInTheDocument();
      });

      // Enter reason
      const textarea = screen.getByPlaceholderText(
        /not a real estate transaction/i,
      );
      await user.type(textarea, "This is spam");

      // Submit rejection - find submit button within modal
      const modal = screen.getByText("Reject Transaction").closest("div")?.parentElement;
      const submitButton = within(modal!).getByRole("button", { name: /^reject$/i });
      await user.click(submitButton);

      // Verify transaction update was called with rejection
      await waitFor(() => {
        expect(window.api.transactions.update).toHaveBeenCalledWith(
          "txn-pending",
          expect.objectContaining({
            detection_status: "rejected",
            rejection_reason: "This is spam",
            reviewed_at: expect.any(String),
          }),
        );
      });

      // Verify feedback was recorded with reason
      expect(window.api.feedback.recordTransaction).toHaveBeenCalledWith(
        mockUserId,
        {
          detectedTransactionId: "txn-pending",
          action: "reject",
          corrections: { reason: "This is spam" },
        },
      );
    });

    it("should close reject modal when cancel is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Open reject modal
      const rejectButton = screen.getByTitle("Reject transaction");
      await user.click(rejectButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Reject Transaction")).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText("Reject Transaction")).not.toBeInTheDocument();
      });

      // APIs should not have been called
      expect(window.api.transactions.update).not.toHaveBeenCalled();
      expect(window.api.feedback.recordTransaction).not.toHaveBeenCalled();
    });

    it("should allow rejection without providing a reason", async () => {
      const user = userEvent.setup();

      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Open reject modal
      const rejectButton = screen.getByTitle("Reject transaction");
      await user.click(rejectButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Reject Transaction")).toBeInTheDocument();
      });

      // Submit without entering a reason - find submit button within modal
      const modal = screen.getByText("Reject Transaction").closest("div")?.parentElement;
      const submitButton = within(modal!).getByRole("button", { name: /^reject$/i });
      await user.click(submitButton);

      // Verify transaction update was called without rejection_reason
      await waitFor(() => {
        expect(window.api.transactions.update).toHaveBeenCalledWith(
          "txn-pending",
          expect.objectContaining({
            detection_status: "rejected",
            rejection_reason: undefined,
            reviewed_at: expect.any(String),
          }),
        );
      });

      // Verify feedback was recorded without reason in corrections
      expect(window.api.feedback.recordTransaction).toHaveBeenCalledWith(
        mockUserId,
        {
          detectedTransactionId: "txn-pending",
          action: "reject",
          corrections: undefined,
        },
      );
    });
  });

  describe("Detection Status Badges", () => {
    it("should show Pending Review badge for pending transactions", async () => {
      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // Pending transaction should have Pending Review badge - use getAllByText since there's also a filter tab
      const pendingReviewElements = screen.getAllByText("Pending Review");
      expect(pendingReviewElements.length).toBeGreaterThan(0);
    });

    it("should show AI Detected badge for auto-detected transactions", async () => {
      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("123 Pending Street")).toBeInTheDocument();
      });

      // AI-detected transactions should have AI Detected badge
      const aiDetectedBadges = screen.getAllByText("AI Detected");
      expect(aiDetectedBadges.length).toBeGreaterThan(0);
    });
  });
});
