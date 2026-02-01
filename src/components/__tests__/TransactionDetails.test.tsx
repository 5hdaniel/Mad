/**
 * Tests for TransactionDetails.tsx
 * Covers AI-suggested contacts display and accept/reject functionality
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import TransactionDetails from "../TransactionDetails";

// Mock the LicenseContext for LicenseGate
jest.mock("../../contexts/LicenseContext", () => ({
  useLicense: () => ({
    licenseType: "team" as const,
    hasAIAddon: true, // Enable AI features for testing
    organizationId: "org-123",
    canExport: false,
    canSubmit: true, // Team can submit
    canAutoDetect: true,
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

describe("TransactionDetails", () => {
  const mockOnClose = jest.fn();
  const mockOnTransactionUpdated = jest.fn();

  // Base transaction without suggested contacts
  const baseTransaction = {
    id: "txn-123",
    user_id: "user-456",
    property_address: "123 Main Street",
    transaction_type: "purchase",
    status: "active" as const,
    sale_price: 450000,
    closed_at: "2024-03-15",
    message_count: 10,
    attachment_count: 5,
    export_status: "not_exported" as const,
    export_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  // Transaction with suggested contacts
  const transactionWithSuggestions = {
    ...baseTransaction,
    suggested_contacts: JSON.stringify([
      { role: "buyer", contact_id: "contact-1", is_primary: true },
      { role: "lender", contact_id: "contact-2", is_primary: false },
    ]),
  };

  // Mock contacts for resolution
  const mockContacts = [
    {
      id: "contact-1",
      user_id: "user-456",
      display_name: "John Buyer",
      email: "john@buyer.com",
      company: "Buyers Inc",
      source: "manual",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    {
      id: "contact-2",
      user_id: "user-456",
      display_name: "Jane Lender",
      email: "jane@lender.com",
      company: "First Bank",
      source: "manual",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    window.api.transactions.getDetails.mockResolvedValue({
      success: true,
      transaction: {
        ...baseTransaction,
        communications: [],
        contact_assignments: [],
      },
    });
    window.api.contacts.getAll.mockResolvedValue({
      success: true,
      contacts: mockContacts,
    });
    window.api.transactions.assignContact.mockResolvedValue({ success: true });
    window.api.transactions.update.mockResolvedValue({ success: true });
    window.api.feedback.recordRole.mockResolvedValue({ success: true });
  });

  describe("AI Suggested Contacts Section", () => {
    it("should not show suggestions section when no suggested_contacts", async () => {
      render(
        <TransactionDetails
          transaction={baseTransaction}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText("Key Contacts")).toBeInTheDocument();
      });

      // Should not show AI Suggested Contacts section
      expect(screen.queryByText("AI Suggested Contacts")).not.toBeInTheDocument();
    });

    it("should display suggested contacts when present", async () => {
      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Wait for suggested contacts to resolve and render
      await waitFor(() => {
        expect(screen.getByText("AI Suggested Contacts")).toBeInTheDocument();
      });

      // Should show both suggestions
      expect(screen.getByText("John Buyer")).toBeInTheDocument();
      expect(screen.getByText("Jane Lender")).toBeInTheDocument();

      // Should show roles (formatted with title case)
      expect(screen.getByText("Buyer")).toBeInTheDocument();
      expect(screen.getByText("Lender")).toBeInTheDocument();

      // Should show Primary badge for first suggestion
      expect(screen.getByText("Primary")).toBeInTheDocument();

      // Should show Accept All button
      expect(screen.getByRole("button", { name: /Accept All/i })).toBeInTheDocument();
    });

    it("should show suggestion count badge", async () => {
      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("2 suggestions")).toBeInTheDocument();
      });
    });

    it("should display contact email and company", async () => {
      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("john@buyer.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Buyers Inc")).toBeInTheDocument();
      expect(screen.getByText("jane@lender.com")).toBeInTheDocument();
      expect(screen.getByText("First Bank")).toBeInTheDocument();
    });
  });

  describe("Accept Suggestion", () => {
    it("should call assignContact and recordRole when accepting a suggestion", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("John Buyer")).toBeInTheDocument();
      });

      // Find and click the accept button for the first suggestion
      const acceptButtons = screen.getAllByTitle("Accept suggestion");
      await user.click(acceptButtons[0]);

      // Verify assignContact was called
      await waitFor(() => {
        expect(window.api.transactions.assignContact).toHaveBeenCalledWith(
          "txn-123",
          "contact-1",
          "buyer",
          undefined,
          true, // is_primary
          undefined, // notes
        );
      });

      // Verify feedback was recorded
      expect(window.api.feedback.recordRole).toHaveBeenCalledWith(
        "user-456",
        expect.objectContaining({
          transactionId: "txn-123",
          contactId: "contact-1",
          originalRole: "buyer",
          correctedRole: "buyer",
        }),
      );

      // Verify suggested_contacts was updated (to remove accepted one)
      expect(window.api.transactions.update).toHaveBeenCalledWith(
        "txn-123",
        expect.objectContaining({
          suggested_contacts: expect.any(String),
        }),
      );
    });

    it("should remove suggestion from UI after accepting", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("John Buyer")).toBeInTheDocument();
      });

      // Accept first suggestion
      const acceptButtons = screen.getAllByTitle("Accept suggestion");
      await user.click(acceptButtons[0]);

      // Wait for suggestion to be removed from UI
      await waitFor(() => {
        expect(screen.queryByText("John Buyer")).not.toBeInTheDocument();
      });

      // Second suggestion should still be visible
      expect(screen.getByText("Jane Lender")).toBeInTheDocument();
    });
  });

  describe("Reject Suggestion", () => {
    it("should call recordRole with empty correctedRole when rejecting", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("John Buyer")).toBeInTheDocument();
      });

      // Find and click the reject button for the first suggestion
      const rejectButtons = screen.getAllByTitle("Reject suggestion");
      await user.click(rejectButtons[0]);

      // Verify feedback was recorded with empty correctedRole (rejection)
      await waitFor(() => {
        expect(window.api.feedback.recordRole).toHaveBeenCalledWith(
          "user-456",
          expect.objectContaining({
            transactionId: "txn-123",
            contactId: "contact-1",
            originalRole: "buyer",
            correctedRole: "", // Empty indicates rejection
          }),
        );
      });

      // Verify assignContact was NOT called (we're rejecting, not accepting)
      expect(window.api.transactions.assignContact).not.toHaveBeenCalled();
    });

    it("should remove suggestion from UI after rejecting", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("John Buyer")).toBeInTheDocument();
      });

      // Reject first suggestion
      const rejectButtons = screen.getAllByTitle("Reject suggestion");
      await user.click(rejectButtons[0]);

      // Wait for suggestion to be removed from UI
      await waitFor(() => {
        expect(screen.queryByText("John Buyer")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accept All", () => {
    it("should call assignContact for all suggestions when Accept All is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("AI Suggested Contacts")).toBeInTheDocument();
      });

      // Click Accept All button
      const acceptAllButton = screen.getByRole("button", { name: /Accept All/i });
      await user.click(acceptAllButton);

      // Verify both contacts were assigned
      await waitFor(() => {
        expect(window.api.transactions.assignContact).toHaveBeenCalledTimes(2);
      });

      // Verify first contact was assigned
      expect(window.api.transactions.assignContact).toHaveBeenCalledWith(
        "txn-123",
        "contact-1",
        "buyer",
        undefined,
        true,
        undefined,
      );

      // Verify second contact was assigned
      expect(window.api.transactions.assignContact).toHaveBeenCalledWith(
        "txn-123",
        "contact-2",
        "lender",
        undefined,
        false,
        undefined,
      );

      // Verify feedback was recorded for both
      expect(window.api.feedback.recordRole).toHaveBeenCalledTimes(2);
    });

    it("should hide suggestions section after Accept All completes", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("AI Suggested Contacts")).toBeInTheDocument();
      });

      // Click Accept All button
      const acceptAllButton = screen.getByRole("button", { name: /Accept All/i });
      await user.click(acceptAllButton);

      // Wait for section to be hidden
      await waitFor(() => {
        expect(screen.queryByText("AI Suggested Contacts")).not.toBeInTheDocument();
      });
    });

    it("should call onTransactionUpdated after Accept All", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to switch tabs

      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByText("AI Suggested Contacts")).toBeInTheDocument();
      });

      // Click Accept All button
      const acceptAllButton = screen.getByRole("button", { name: /Accept All/i });
      await user.click(acceptAllButton);

      // Verify callback was called
      await waitFor(() => {
        expect(mockOnTransactionUpdated).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid JSON in suggested_contacts gracefully", async () => {
      const transactionWithInvalidJSON = {
        ...baseTransaction,
        suggested_contacts: "invalid json {",
      };

      render(
        <TransactionDetails
          transaction={transactionWithInvalidJSON}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Should not crash and should not show suggestions section
      await waitFor(() => {
        expect(screen.getByText("Key Contacts")).toBeInTheDocument();
      });

      expect(screen.queryByText("AI Suggested Contacts")).not.toBeInTheDocument();
    });

    it("should handle empty suggested_contacts array", async () => {
      const transactionWithEmptyArray = {
        ...baseTransaction,
        suggested_contacts: "[]",
      };

      render(
        <TransactionDetails
          transaction={transactionWithEmptyArray}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Should not show suggestions section for empty array
      await waitFor(() => {
        expect(screen.getByText("Key Contacts")).toBeInTheDocument();
      });

      expect(screen.queryByText("AI Suggested Contacts")).not.toBeInTheDocument();
    });

    it("should handle contact resolution failure gracefully", async () => {
      // Mock contacts API to fail
      window.api.contacts.getAll.mockRejectedValue(new Error("Failed to fetch"));

      render(
        <TransactionDetails
          transaction={transactionWithSuggestions}
          onClose={mockOnClose}
          onTransactionUpdated={mockOnTransactionUpdated}
        />,
      );

      // Switch to contacts tab
      // Contacts are now shown in the Overview tab by default
      // No need to click a separate tab

      // Should still show suggestions section (with "Unknown Contact")
      await waitFor(() => {
        expect(screen.getByText("AI Suggested Contacts")).toBeInTheDocument();
      });

      // Should show "Unknown Contact" for unresolved contacts
      const unknownContacts = screen.getAllByText("Unknown Contact");
      expect(unknownContacts.length).toBeGreaterThan(0);
    });
  });
});
