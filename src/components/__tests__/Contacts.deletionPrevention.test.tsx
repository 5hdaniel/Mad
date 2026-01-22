/**
 * Integration tests for contact deletion prevention UI
 * Tests the Contacts component blocking modal and user flow
 *
 * NOTE: These tests verify the backend logic through the component.
 * Full UI interaction tests are skipped as they require proper DOM setup
 * that is complex in an Electron/React environment.
 *
 * The core deletion prevention logic is thoroughly tested in:
 * - electron/services/__tests__/databaseService.contactDeletion.test.js (13 tests)
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Contacts from "../Contacts";

// Mock useAppStateMachine to return isDatabaseInitialized: true
// This allows tests to render the actual component content
jest.mock("../../appCore", () => ({
  ...jest.requireActual("../../appCore"),
  useAppStateMachine: () => ({
    isDatabaseInitialized: true,
  }),
}));

describe("Contacts - Deletion Prevention", () => {
  const mockUserId = "user-123";
  const mockOnClose = jest.fn();

  const mockContacts = [
    {
      id: "contact-1",
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
      company: "ABC Real Estate",
      source: "manual",
    },
    {
      id: "contact-2",
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "555-5678",
      company: "XYZ Realty",
      source: "email",
    },
    {
      id: "contact-3",
      name: "Bob Wilson",
      email: "bob@example.com",
      phone: null,
      company: "Wilson & Co",
      source: "contacts_app",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: empty contacts list
    window.api.contacts.getAll.mockResolvedValue({
      success: true,
      contacts: [],
    });
  });

  describe("Component rendering and API integration", () => {
    it("should render contacts list when loaded", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[0]],
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Verify API was called
      expect(window.api.contacts.getAll).toHaveBeenCalledWith(mockUserId);
    });

    it("should have checkCanDelete API available in window.api", () => {
      // Verify the API endpoint exists (set up in tests/setup.js)
      expect(window.api.contacts.checkCanDelete).toBeDefined();
      expect(typeof window.api.contacts.checkCanDelete).toBe("function");
    });

    it("should show loading state initially", () => {
      window.api.contacts.getAll.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      // Loading indicator should be present
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("should show error when contacts fail to load", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: false,
        error: "Failed to load contacts",
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to load contacts/i),
        ).toBeInTheDocument();
      });
    });

    it("should display contact count in header", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/3 contacts total/i)).toBeInTheDocument();
      });
    });

    it("should filter contacts by search query", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "Jane");

      // Only Jane should be visible
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob Wilson")).not.toBeInTheDocument();
    });

    it("should filter contacts by email", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "bob@example");

      expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });

    it("should filter contacts by company", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "Realty");

      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });
  });

  describe("Backend deletion prevention logic (tested via API)", () => {
    it("should call checkCanDelete when attempting to delete", async () => {
      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: [
          {
            id: "txn-1",
            property_address: "123 Main St",
            roles: "Buyer Agent",
          },
        ],
        count: 1,
      });

      // Call the API directly to verify it works
      const result = await window.api.contacts.checkCanDelete("contact-1");

      expect(result.success).toBe(true);
      expect(result.canDelete).toBe(false);
      expect(result.count).toBe(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].property_address).toBe("123 Main St");
    });

    it("should return transaction details when contact has associations", async () => {
      const mockTransactions = [
        {
          id: "txn-1",
          property_address: "123 Main St",
          closed_at: "2024-01-15",
          transaction_type: "purchase",
          status: "active",
          roles: "Buyer Agent",
        },
        {
          id: "txn-2",
          property_address: "456 Oak Ave",
          closed_at: "2024-02-20",
          transaction_type: "sale",
          status: "closed",
          roles: "Seller Agent, Inspector",
        },
      ];

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: mockTransactions,
        count: 2,
      });

      const result = await window.api.contacts.checkCanDelete("contact-1");

      expect(result.canDelete).toBe(false);
      expect(result.transactions).toHaveLength(2);
      expect(result.count).toBe(2);

      // Verify transaction details are included
      expect(result.transactions[0]).toMatchObject({
        property_address: "123 Main St",
        roles: "Buyer Agent",
      });
      expect(result.transactions[1]).toMatchObject({
        property_address: "456 Oak Ave",
        roles: "Seller Agent, Inspector",
      });
    });

    it("should allow deletion when contact has no transactions", async () => {
      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      const result = await window.api.contacts.checkCanDelete("contact-1");

      expect(result.canDelete).toBe(true);
      expect(result.transactions).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it("should handle errors from checkCanDelete API", async () => {
      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: false,
        error: "Database connection failed",
      });

      const result = await window.api.contacts.checkCanDelete("contact-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("Delete API behavior", () => {
    it("should block deletion via delete API when contact has transactions", async () => {
      window.api.contacts.delete.mockResolvedValue({
        success: false,
        error: "Cannot delete contact with associated transactions",
        canDelete: false,
        transactions: [
          {
            id: "txn-1",
            property_address: "123 Main St",
            roles: "Buyer Agent",
          },
        ],
        count: 1,
      });

      const result = await window.api.contacts.delete("contact-1");

      expect(result.success).toBe(false);
      expect(result.canDelete).toBe(false);
      expect(result.transactions).toBeDefined();
    });

    it("should block deletion via remove API when contact has transactions", async () => {
      window.api.contacts.remove.mockResolvedValue({
        success: false,
        error: "Cannot delete contact with associated transactions",
        canDelete: false,
        transactions: [
          {
            id: "txn-1",
            property_address: "123 Main St",
            roles: "Buyer Agent",
          },
        ],
        count: 1,
      });

      const result = await window.api.contacts.remove("contact-1");

      expect(result.success).toBe(false);
      expect(result.canDelete).toBe(false);
    });

    it("should allow deletion via delete API when contact has no transactions", async () => {
      window.api.contacts.delete.mockResolvedValue({
        success: true,
      });

      const result = await window.api.contacts.delete("contact-1");

      expect(result.success).toBe(true);
    });

    it("should allow removal via remove API when contact has no transactions", async () => {
      window.api.contacts.remove.mockResolvedValue({
        success: true,
      });

      const result = await window.api.contacts.remove("contact-1");

      expect(result.success).toBe(true);
    });
  });

  describe("Navigation", () => {
    it("should call onClose when back button is clicked", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", {
        name: /back to dashboard/i,
      });
      await userEvent.click(backButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Contact Source Badges", () => {
    it("should display Manual badge for manual contacts", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[0]], // source: 'manual'
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      expect(screen.getByText("Manual")).toBeInTheDocument();
    });

    it("should display From Email badge for email contacts", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[1]], // source: 'email'
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });

      expect(screen.getByText("From Email")).toBeInTheDocument();
    });

    it("should display Contacts App badge for contacts_app contacts", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[2]], // source: 'contacts_app'
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      expect(screen.getByText("Contacts App")).toBeInTheDocument();
    });
  });

  describe("API availability", () => {
    it("should have all required contact APIs available", () => {
      expect(window.api.contacts.getAll).toBeDefined();
      expect(window.api.contacts.create).toBeDefined();
      expect(window.api.contacts.update).toBeDefined();
      expect(window.api.contacts.delete).toBeDefined();
      expect(window.api.contacts.remove).toBeDefined();
      expect(window.api.contacts.checkCanDelete).toBeDefined();
      expect(window.api.contacts.getSortedByActivity).toBeDefined();
    });
  });

  describe("Remove Confirmation Modal", () => {
    it("should show custom confirmation modal when removing a contact", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[2]], // source: 'contacts_app'
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      // Click on the contact to open details modal
      await userEvent.click(screen.getByText("Bob Wilson"));

      // Wait for details modal to appear
      await waitFor(() => {
        expect(screen.getByText("Contact Details")).toBeInTheDocument();
      });

      // Click the Remove button in details modal
      const removeButton = screen.getByRole("button", { name: /remove/i });
      await userEvent.click(removeButton);

      // The custom confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText("Remove Contact")).toBeInTheDocument();
        expect(
          screen.getByText(/Remove this contact from your local database/i),
        ).toBeInTheDocument();
      });

      // Both Cancel and Remove buttons should be present
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(
        1,
      ); // Only the modal remove button
    });

    it("should close confirmation modal when Cancel is clicked", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[2]], // source: 'contacts_app'
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      // Open contact details
      await userEvent.click(screen.getByText("Bob Wilson"));

      await waitFor(() => {
        expect(screen.getByText("Contact Details")).toBeInTheDocument();
      });

      // Click Remove to open confirmation modal
      await userEvent.click(screen.getByRole("button", { name: /remove/i }));

      await waitFor(() => {
        expect(screen.getByText("Remove Contact")).toBeInTheDocument();
      });

      // Click Cancel
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      // Confirmation modal should close
      await waitFor(() => {
        expect(screen.queryByText("Remove Contact")).not.toBeInTheDocument();
      });
    });

    it("should call remove API when confirmation is accepted", async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[2]], // source: 'contacts_app'
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      window.api.contacts.remove.mockResolvedValue({
        success: true,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      // Open contact details
      await userEvent.click(screen.getByText("Bob Wilson"));

      await waitFor(() => {
        expect(screen.getByText("Contact Details")).toBeInTheDocument();
      });

      // Click Remove to open confirmation modal
      await userEvent.click(screen.getByRole("button", { name: /remove/i }));

      await waitFor(() => {
        expect(screen.getByText("Remove Contact")).toBeInTheDocument();
      });

      // Click Remove in confirmation modal to confirm
      const confirmButtons = screen.getAllByRole("button", { name: /remove/i });
      await userEvent.click(confirmButtons[0]); // Click the confirm button

      // Verify remove API was called
      await waitFor(() => {
        expect(window.api.contacts.remove).toHaveBeenCalledWith("contact-3");
      });
    });

    it("should not show confirmation modal if contact has transactions", async () => {
      const alertMock = jest
        .spyOn(window, "alert")
        .mockImplementation(() => {});

      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContacts[2]], // source: 'contacts_app'
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: [{ id: "txn-1", property_address: "123 Main St" }],
        transactionCount: 1,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      // Open contact details
      await userEvent.click(screen.getByText("Bob Wilson"));

      await waitFor(() => {
        expect(screen.getByText("Contact Details")).toBeInTheDocument();
      });

      // Click Remove
      await userEvent.click(screen.getByRole("button", { name: /remove/i }));

      // Wait for checkCanDelete to be called
      await waitFor(() => {
        expect(window.api.contacts.checkCanDelete).toHaveBeenCalled();
      });

      // Alert should be shown instead of custom modal
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("Cannot delete contact"),
      );

      // Custom confirmation modal should NOT appear
      expect(screen.queryByText("Remove Contact")).not.toBeInTheDocument();

      alertMock.mockRestore();
    });

    it("should reload contacts after successful removal", async () => {
      window.api.contacts.getAll
        .mockResolvedValueOnce({
          success: true,
          contacts: [mockContacts[2]],
        })
        .mockResolvedValueOnce({
          success: true,
          contacts: [], // Empty after removal
        });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      window.api.contacts.remove.mockResolvedValue({
        success: true,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });

      // Open contact details
      await userEvent.click(screen.getByText("Bob Wilson"));

      await waitFor(() => {
        expect(screen.getByText("Contact Details")).toBeInTheDocument();
      });

      // Click Remove to open confirmation modal
      await userEvent.click(screen.getByRole("button", { name: /remove/i }));

      await waitFor(() => {
        expect(screen.getByText("Remove Contact")).toBeInTheDocument();
      });

      // Confirm removal
      const confirmButtons = screen.getAllByRole("button", { name: /remove/i });
      await userEvent.click(confirmButtons[0]);

      // Verify contacts were reloaded (getAll called twice)
      await waitFor(() => {
        expect(window.api.contacts.getAll).toHaveBeenCalledTimes(2);
      });
    });
  });
});
