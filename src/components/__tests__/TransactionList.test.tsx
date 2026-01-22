/**
 * Tests for TransactionList.tsx
 * Covers pending review UI and badge display
 *
 * Note: Approve/Reject actions are now in TransactionDetails modal, not on cards
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import TransactionList from "../TransactionList";

// Mock useAppStateMachine to return isDatabaseInitialized: true
// This allows tests to render the actual component content
jest.mock("../../appCore", () => ({
  ...jest.requireActual("../../appCore"),
  useAppStateMachine: () => ({
    isDatabaseInitialized: true,
  }),
}));

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
    closed_at: "2024-03-15",
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
    closed_at: "2024-01-20",
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
    closed_at: null,
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
    window.api.transactions.getDetails.mockResolvedValue({
      success: true,
      transaction: {
        ...pendingTransaction,
        communications: [],
        contact_assignments: [],
      },
    });
    window.api.feedback.recordTransaction.mockResolvedValue({ success: true });
    window.api.onTransactionScanProgress.mockReturnValue(jest.fn());
  });

  describe("Pending Review UI", () => {
    it("should show Review & Edit button only for pending transactions", async () => {
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

      // Pending transaction should have "Review & Edit" button in wrapper
      const reviewButtons = screen.getAllByRole("button", { name: /review & edit/i });
      expect(reviewButtons.length).toBeGreaterThan(0);

      // Confirmed and manual transactions should have Export button (not Review)
      expect(screen.getAllByRole("button", { name: /export/i }).length).toBeGreaterThan(0);
    });

    it("should open TransactionDetails in pending review mode when Review & Edit is clicked", async () => {
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

      // Click Review & Edit button
      const reviewButton = screen.getByRole("button", { name: /review & edit/i });
      await user.click(reviewButton);

      // TransactionDetails modal should open with approve/reject buttons
      await waitFor(() => {
        expect(screen.getByText("Review Transaction")).toBeInTheDocument();
      });

      // Should show Approve and Reject buttons in the modal header
      // Using getAllByRole since there may be multiple buttons with similar names
      const approveButtons = screen.getAllByRole("button", { name: /approve/i });
      const rejectButtons = screen.getAllByRole("button", { name: /reject/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });

    it("should show pending review wrapper with confidence bar", async () => {
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

      // Should show confidence label
      expect(screen.getByText("Confidence")).toBeInTheDocument();

      // Should show confidence percentage (85% from mock data)
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should open TransactionDetails modal when clicking on pending transaction", async () => {
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

      // Click on the pending transaction card itself (not the Review button)
      const pendingCard = screen.getByText("123 Pending Street");
      await user.click(pendingCard);

      // TransactionDetails modal should open
      await waitFor(() => {
        expect(screen.getByText("Review Transaction")).toBeInTheDocument();
      });

      // Verify getDetails was called
      expect(window.api.transactions.getDetails).toHaveBeenCalledWith("txn-pending");
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

      // Pending transaction should have Pending Review label in wrapper
      const pendingReviewElements = screen.getAllByText("Pending Review");
      expect(pendingReviewElements.length).toBeGreaterThan(0);
    });

    it("should show Manual badge for manually entered transactions", async () => {
      render(
        <TransactionList
          userId={mockUserId}
          provider={mockProvider}
          onClose={mockOnClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("789 Manual Road")).toBeInTheDocument();
      });

      // Manual transaction should have Manual badge
      const manualBadges = screen.getAllByText("Manual");
      expect(manualBadges.length).toBeGreaterThan(0);
    });

    it("should NOT show Manual badge for auto-detected transactions", async () => {
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

      // Get the pending transaction card (auto-detected)
      const pendingCard = screen
        .getByText("123 Pending Street")
        .closest(".bg-white");

      // Auto-detected transactions should NOT have Manual badge
      expect(within(pendingCard!).queryByText("Manual")).not.toBeInTheDocument();
    });
  });

  describe("Filter Tabs", () => {
    it("should show all filter tabs", async () => {
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

      // All filter tabs should be present
      expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pending review/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^active/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /closed/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /rejected/i })).toBeInTheDocument();
    });

    it("should filter transactions when filter tab is clicked", async () => {
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

      // Click Active filter
      const activeFilter = screen.getByRole("button", { name: /^active/i });
      await user.click(activeFilter);

      // Should show active transactions (confirmed and manual are both "active" status)
      await waitFor(() => {
        expect(screen.getByText("456 Confirmed Avenue")).toBeInTheDocument();
        expect(screen.getByText("789 Manual Road")).toBeInTheDocument();
      });

      // Pending transaction should NOT be visible (it's filtered out)
      expect(screen.queryByText("123 Pending Street")).not.toBeInTheDocument();
    });
  });
});
