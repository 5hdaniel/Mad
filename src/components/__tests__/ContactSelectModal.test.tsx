/**
 * Tests for ContactSelectModal.tsx
 * Covers contact selection, multi-select mode, search filtering, and initial selection state
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ContactSelectModal from "../ContactSelectModal";
import type { ExtendedContact } from "../../types/components";

describe("ContactSelectModal", () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();

  const mockContacts: ExtendedContact[] = [
    {
      id: "contact-1",
      user_id: "user-1",
      name: "John Smith",
      email: "john@example.com",
      company: "Smith Corp",
      source: "email",
    },
    {
      id: "contact-2",
      user_id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      company: "Doe LLC",
      source: "email",
    },
    {
      id: "contact-3",
      user_id: "user-1",
      name: "Bob Johnson",
      email: "bob@realty.com",
      company: "Realty Partners",
      source: "email",
      address_mention_count: 5,
      last_communication_at: "2024-01-15T10:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render modal with correct title for single select", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Select Contact")).toBeInTheDocument();
    });

    it("should render modal with correct title for multi-select", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Select Contacts")).toBeInTheDocument();
    });

    it("should display all contacts", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("John Smith")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
    });

    it("should display contact emails", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });

    it("should display contact companies", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Smith Corp")).toBeInTheDocument();
      expect(screen.getByText("Doe LLC")).toBeInTheDocument();
    });

    it("should show empty state when no contacts available", () => {
      render(
        <ContactSelectModal
          contacts={[]}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("No contacts available")).toBeInTheDocument();
    });

    it("should show property address badge when propertyAddress is provided", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          propertyAddress="123 Main St"
        />
      );

      // Bob Johnson has address_mention_count of 5
      expect(screen.getByText("5 related emails")).toBeInTheDocument();
    });
  });

  describe("Contact Selection - Single Mode", () => {
    it("should select a contact when clicked", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);

      // Should show 1 selected in header
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });
    });

    it("should replace selection when clicking another contact in single mode", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          multiple={false}
        />
      );

      // Select John first
      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      // Then select Jane - should replace John
      const janeButton = screen.getByText("Jane Doe").closest("button");
      await userEvent.click(janeButton!);

      // Still only 1 selected
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });
    });

    it("should call onSelect with selected contact when Add is clicked", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Select John
      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);

      // Wait for selection to update
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      // Click Add button
      const addButton = screen.getByRole("button", { name: /add/i });
      await userEvent.click(addButton);

      expect(mockOnSelect).toHaveBeenCalledWith([mockContacts[0]]);
    });
  });

  describe("Contact Selection - Multi-Select Mode", () => {
    it("should allow selecting multiple contacts", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Select John
      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      // Select Jane too
      const janeButton = screen.getByText("Jane Doe").closest("button");
      await userEvent.click(janeButton!);
      await waitFor(() => {
        expect(screen.getByText("2 selected")).toBeInTheDocument();
      });
    });

    it("should deselect a contact when clicked again in multi-select mode", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const johnButton = screen.getByText("John Smith").closest("button");

      // Select John
      await userEvent.click(johnButton!);
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      // Deselect John
      await userEvent.click(johnButton!);
      await waitFor(() => {
        expect(screen.getByText("Choose from your contacts")).toBeInTheDocument();
      });
    });

    it("should call onSelect with all selected contacts when Add is clicked", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Select John and Jane
      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);
      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      const janeButton = screen.getByText("Jane Doe").closest("button");
      await userEvent.click(janeButton!);
      await waitFor(() => {
        expect(screen.getByText("2 selected")).toBeInTheDocument();
      });

      // Click Add button
      const addButton = screen.getByRole("button", { name: /add/i });
      await userEvent.click(addButton);

      expect(mockOnSelect).toHaveBeenCalledWith([mockContacts[0], mockContacts[1]]);
    });
  });

  describe("Initial Selection", () => {
    it("should pre-select contacts when initialSelectedIds is provided", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["contact-1", "contact-2"]}
        />
      );

      // Should show 2 selected
      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("should show pre-selected contacts with checked state", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["contact-1"]}
        />
      );

      // John should be visually selected (has purple background class)
      const johnButton = screen.getByText("John Smith").closest("button");
      expect(johnButton).toHaveClass("border-purple-500");
      expect(johnButton).toHaveClass("bg-purple-50");
    });

    it("should enable Add button when initialSelectedIds has values", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["contact-1"]}
        />
      );

      const addButton = screen.getByRole("button", { name: /add/i });
      expect(addButton).not.toBeDisabled();
    });

    it("should update selection state when initialSelectedIds changes", async () => {
      const { rerender } = render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["contact-1"]}
        />
      );

      expect(screen.getByText("1 selected")).toBeInTheDocument();

      // Rerender with different initial selection
      rerender(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["contact-2", "contact-3"]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("2 selected")).toBeInTheDocument();
      });
    });

    it("should handle empty initialSelectedIds gracefully", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={[]}
        />
      );

      expect(screen.getByText("Choose from your contacts")).toBeInTheDocument();
    });

    it("should ignore invalid contact IDs in initialSelectedIds", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          initialSelectedIds={["non-existent-id"]}
        />
      );

      // Add button should be disabled since no valid contacts are selected
      const addButton = screen.getByRole("button", { name: /add/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe("Search Filtering", () => {
    it("should filter contacts by name", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "John");

      await waitFor(() => {
        expect(screen.getByText("John Smith")).toBeInTheDocument();
        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });
    });

    it("should filter contacts by email", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "realty.com");

      await waitFor(() => {
        expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
        expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
      });
    });

    it("should filter contacts by company", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "Smith Corp");

      await waitFor(() => {
        expect(screen.getByText("John Smith")).toBeInTheDocument();
        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });
    });

    it("should show no results message when search has no matches", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText("No matching contacts found")).toBeInTheDocument();
      });
    });

    it("should be case insensitive", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await userEvent.type(searchInput, "JOHN");

      await waitFor(() => {
        expect(screen.getByText("John Smith")).toBeInTheDocument();
      });
    });
  });

  describe("Exclude IDs", () => {
    it("should exclude contacts with excludeIds", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          excludeIds={["contact-1"]}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    it("should show empty state when all contacts are excluded", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          excludeIds={["contact-1", "contact-2", "contact-3"]}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("No contacts available")).toBeInTheDocument();
    });
  });

  describe("Cancel and Close", () => {
    it("should call onClose when Cancel is clicked", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should call onClose when X button is clicked", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Find X close button by its SVG path
      const closeButtons = screen.getAllByRole("button");
      const xButton = closeButtons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      );

      if (xButton) {
        await userEvent.click(xButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe("Add Button State", () => {
    it("should disable Add button when no contact is selected", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const addButton = screen.getByRole("button", { name: /add/i });
      expect(addButton).toBeDisabled();
    });

    it("should enable Add button when a contact is selected", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);

      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add/i });
        expect(addButton).not.toBeDisabled();
      });
    });

    it("should show selection count in Add button", async () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          multiple={true}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const johnButton = screen.getByText("John Smith").closest("button");
      await userEvent.click(johnButton!);

      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });

      const janeButton = screen.getByText("Jane Doe").closest("button");
      await userEvent.click(janeButton!);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add \(2\)/i })).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have accessible search input", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      expect(searchInput).toBeInTheDocument();
    });

    it("should auto-focus search input", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      expect(searchInput).toHaveFocus();
    });

    it("should have accessible buttons", () => {
      render(
        <ContactSelectModal
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });
  });
});
